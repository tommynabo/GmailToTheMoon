import { NextResponse } from 'next/server';

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

    const resolvedCampaignId = body.campaignId?.trim() || campaignId;

    const payload: Record<string, any> = {
      campaign: resolvedCampaignId,
      email: body.email.toLowerCase().trim(),
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

    console.log('[INSTANTLY] Lead added:', payload.email, '| campaign:', resolvedCampaignId);
    return NextResponse.json({ success: true, email: payload.email, data: responseData });

  } catch (e: any) {
    console.error('[INSTANTLY] Network error:', e.message);
    return NextResponse.json({ error: 'Network error: ' + e.message }, { status: 500 });
  }
}
