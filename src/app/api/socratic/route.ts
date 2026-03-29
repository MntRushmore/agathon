import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { callHackClubAI } from '@/lib/ai/hackclub';

interface SocraticMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Rate limit: 60 requests/minute per user
    const rateLimitKey = `socratic:${user.id}`;
    const { success } = await checkRateLimit(rateLimitKey, 'chat');
    if (!success) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please slow down.' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json() as { messages: SocraticMessage[]; mode: string };
    const { messages, mode } = body;

    if (!messages?.length) {
      return new Response(
        JSON.stringify({ error: 'No messages provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Temperature varies by mode: socratic is more creative, answer is precise
    const temperatureByMode: Record<string, number> = {
      socratic: 0.85,
      explain: 0.7,
      hint: 0.75,
      answer: 0.3,
    };

    const response = await callHackClubAI({
      messages,
      stream: true,
      temperature: temperatureByMode[mode] ?? 0.75,
      max_tokens: 1024,
    });

    // Pipe the SSE stream directly back to the client
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    console.error('[socratic] Error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
