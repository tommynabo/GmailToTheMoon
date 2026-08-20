import { NextResponse } from 'next/server';
import { Client } from 'pg';

export async function POST(req: Request) {
  try {
    const instantlyKey = process.env.INSTANTLY_API_KEY;
    const campaignId = process.env.INSTANTLY_CAMPAIGN_ID;

    if (!instantlyKey || !campaignId) {
      console.error('[INSTANTLY] Missing API Key or Campaign ID');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const body = await req.json();

    if (!body.email || typeof body.email !== 'string' || !body.email.includes('@')) {
      return NextResponse.json({ error: 'Missing or invalid email' }, { status: 400 });
    }

    const fullName = ((body.firstName || '') + ' ' + (body.lastName || '')).trim();
    const nameParts = fullName.split(' ');
    const firstName = body.firstName || nameParts[0] || '';
    const lastName = body.lastName || nameParts.slice(1).join(' ') || '';
    const email = body.email.toLowerCase().trim();
    const igHandle = body.igHandle || '';

    // ── 0. Credit Optimization: Comprobar duplicados y límite diario en Neon DB ──
    if (process.env.DATABASE_URL) {
      const dbClient = new Client({ connectionString: process.env.DATABASE_URL });
      try {
        await dbClient.connect();
        
        // Comprobar límite diario (150 leads)
        const limitRes = await dbClient.query("SELECT COUNT(*) FROM leads WHERE created_at >= CURRENT_DATE");
        if (parseInt(limitRes.rows[0].count) >= 150) {
          console.log('[CREDIT OPTIMIZATION] Daily limit of 150 leads reached. Skipping.');
          return NextResponse.json({ success: false, reason: 'daily_limit_reached' }, { status: 429 });
        }

        // Comprobar si ya existe el lead (por email o ig_handle)
        const dupRes = await dbClient.query(
          "SELECT id FROM leads WHERE email = $1 OR (ig_handle = $2 AND ig_handle != '') LIMIT 1", 
          [email, igHandle]
        );
        if (dupRes.rows.length > 0) {
          console.log(`[CREDIT OPTIMIZATION] Lead already exists: ${email}. Skipping.`);
          return NextResponse.json({ success: false, reason: 'duplicate' }, { status: 200 });
        }
      } catch (err) {
        console.error('[DB] Error checking limits/duplicates:', err);
      } finally {
        await dbClient.end();
      }
    }

    const resolvedCampaignId = body.campaignId?.trim() || campaignId;

    const payload: Record<string, any> = {
      campaign: resolvedCampaignId,
      email: email,
      first_name: firstName,
      last_name: lastName,
      company_name: body.companyName || '',
      skip_if_in_workspace: true // Anti-duplicados
    };

    const customVars: Record<string, string> = {};
    if (body.igHandle) customVars['ig_handle'] = body.igHandle;
    if (body.niche) customVars['niche'] = body.niche;
    if (body.aiSummary) customVars['ai_summary'] = body.aiSummary;
    if (body.followerCount) customVars['follower_count'] = String(body.followerCount);
    
    if (Object.keys(customVars).length > 0) {
      payload['custom_variables'] = customVars;
    }

    // ── 1. Validar Email con MillionVerifier (Opcional) ──
    const mvApiKey = process.env.MILLIONVERIFIER_API_KEY;
    if (mvApiKey) {
      try {
        const url = `https://api.millionverifier.com/api/v3/?api=${encodeURIComponent(mvApiKey)}&email=${encodeURIComponent(payload.email)}&timeout=10`;
        const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
        if (res.ok) {
          const data = await res.json();
          const result = data.result;
          
          if (result === 'invalid' || result === 'disposable') {
            console.log('[MV] ❌ Email descartado:', payload.email, '| reason:', result);
            return NextResponse.json({ verified: false, reason: result, email: payload.email }, { status: 422 });
          }
        }
      } catch (e: any) {
        console.warn('[MV] Verification failed for', payload.email, e.message);
      }
    }

    // ── 2. Enviar a Instantly (API v2) ──
    const response = await fetch('https://api.instantly.ai/api/v2/leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${instantlyKey}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (!response.ok) {
      console.error('[INSTANTLY] Add lead failed:', response.status, responseText.substring(0, 500));
      return NextResponse.json({
        error: 'Instantly API error',
        status: response.status,
        details: responseData,
      }, { status: response.status });
    }

    // ── 3. Guardar en Neon DB ──
    if (process.env.DATABASE_URL) {
      const dbClient = new Client({ connectionString: process.env.DATABASE_URL });
      try {
        await dbClient.connect();
        await dbClient.query(
          `INSERT INTO leads (email, first_name, last_name, company_name, ig_handle, follower_count, niche, instantly_status, campaign_id, ai_summary)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (email) DO NOTHING`,
          [
            email, firstName, lastName, body.companyName || '', igHandle, 
            body.followerCount || 0, body.niche || '', 'pushed', resolvedCampaignId, body.aiSummary || ''
          ]
        );
      } catch (err) {
        console.error('[DB] Error saving lead:', err);
      } finally {
        await dbClient.end();
      }
    }

    console.log('[INSTANTLY] Lead added:', payload.email, '| campaign:', resolvedCampaignId);
    return NextResponse.json({ success: true, email: payload.email, data: responseData });

  } catch (e: any) {
    console.error('[INSTANTLY] Network error:', e.message);
    return NextResponse.json({ error: 'Network error: ' + e.message }, { status: 500 });
  }
}
