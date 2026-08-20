import OpenAI from 'openai';
import { SYSTEM_PROMPT, INTENT_CLASSIFIER_PROMPT } from './prompts';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key_for_build',
});

export async function classifyIntent(prospectReply: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: INTENT_CLASSIFIER_PROMPT.replace('{prospect_reply}', prospectReply)
        }
      ],
      temperature: 0.1,
      max_tokens: 20,
    });
    
    return response.choices[0].message.content?.trim().toUpperCase() || 'QUESTION';
  } catch (error) {
    console.error('[AI Setter] Error classifying intent:', error);
    return 'QUESTION'; // Fallback
  }
}

export async function generateSetterReply(
  prospectReply: string,
  history: { role: 'user' | 'assistant', content: string }[] = []
): Promise<string> {
  try {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: prospectReply }
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // Usamos el modelo más capaz para la redacción final
      messages,
      temperature: 0.7,
      max_tokens: 150,
    });

    return response.choices[0].message.content?.trim() || '';
  } catch (error) {
    console.error('[AI Setter] Error generating reply:', error);
    throw error;
  }
}
