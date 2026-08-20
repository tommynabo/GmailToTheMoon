import { NextResponse } from 'next/server';
import { classifyIntent, generateSetterReply } from '@/lib/setter/openai';
import { Client } from 'pg';

// Esto simula la recepción de un webhook de Instantly cuando alguien responde
export async function POST(req: Request) {
  let dbClient;
  try {
    const body = await req.json();
    const { email, lead_id, reply_text, thread_history } = body;

    if (!email || !reply_text) {
      return NextResponse.json({ error: 'Missing email or reply_text' }, { status: 400 });
    }

    // 1. Clasificar intención
    const intent = await classifyIntent(reply_text);
    console.log(`[AI Setter] Intent classified as: ${intent} for email: ${email}`);

    // Si no está interesado, no respondemos
    if (intent === 'NOT_INTERESTED' || intent === 'OUT_OF_OFFICE') {
      // TODO: Actualizar status en Instantly/Neon a 'DNC' (Do Not Contact)
      return NextResponse.json({ success: true, action: 'ignored', intent });
    }

    // 2. Generar respuesta
    const aiReply = await generateSetterReply(reply_text, thread_history || []);
    
    // 3. Registrar interacción en Neon DB
    if (process.env.DATABASE_URL) {
      dbClient = new Client({ connectionString: process.env.DATABASE_URL });
      await dbClient.connect();
      
      // Buscar lead
      const result = await dbClient.query('SELECT id FROM leads WHERE email = $1 LIMIT 1', [email]);
        
      if (result.rows.length > 0) {
        const lead = result.rows[0];
        await dbClient.query(
          'INSERT INTO ai_interactions (lead_id, intent_type, user_reply, ai_response, status) VALUES ($1, $2, $3, $4, $5)',
          [lead.id, intent, reply_text, aiReply, 'replied']
        );
      }
    }

    // En producción, aquí haríamos una llamada a Instantly (o Gmail API) para enviar el 'aiReply'
    // POST https://api.instantly.ai/api/v1/campaign/reply ...
    
    return NextResponse.json({ 
      success: true, 
      intent, 
      generated_reply: aiReply 
    });

  } catch (error: any) {
    console.error('[API Setter] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (dbClient) {
      await dbClient.end();
    }
  }
}
