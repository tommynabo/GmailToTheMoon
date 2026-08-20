import { NextResponse } from 'next/server';
import { classifyIntent, generateSetterReply } from '@/lib/setter/openai';
import { createClient } from '@supabase/supabase-js';

// Esto simula la recepción de un webhook de Instantly cuando alguien responde
export async function POST(req: Request) {
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
      // TODO: Actualizar status en Instantly/Supabase a 'DNC' (Do Not Contact)
      return NextResponse.json({ success: true, action: 'ignored', intent });
    }

    // 2. Generar respuesta
    const aiReply = await generateSetterReply(reply_text, thread_history || []);
    
    // 3. Registrar interacción en Supabase (Opcional, pero recomendado)
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      
      // Buscar lead
      const { data: lead } = await supabase
        .from('leads')
        .select('id')
        .eq('email', email)
        .single();
        
      if (lead) {
        await supabase.from('ai_interactions').insert({
          lead_id: lead.id,
          intent_type: intent,
          user_reply: reply_text,
          ai_response: aiReply,
          status: 'replied'
        });
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
  }
}
