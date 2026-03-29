import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { callHackClubAI } from '@/lib/ai/hackclub';

interface SocraticMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/** Enterprise users get a higher-quality model with longer context */
const ENTERPRISE_MODEL = process.env.ENTERPRISE_SOCRATIC_MODEL || 'anthropic/claude-sonnet-4-5';
/** Free users get the fast Hack Club default */
const FREE_MODEL = process.env.HACKCLUB_AI_MODEL || 'google/gemini-2.5-flash';

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

    // Check plan tier for model selection
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan_tier, plan_status')
      .eq('id', user.id)
      .single();

    const isEnterprise = (profile?.plan_tier === 'premium' || profile?.plan_tier === 'enterprise')
      && profile?.plan_status === 'active';

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

    // Enterprise: higher token limit + better model; free: standard
    const model = isEnterprise ? ENTERPRISE_MODEL : FREE_MODEL;
    const maxTokens = isEnterprise ? 2048 : 1024;

    const response = await callHackClubAI({
      messages,
      stream: true,
      model,
      temperature: temperatureByMode[mode] ?? 0.75,
      max_tokens: maxTokens,
    });

    // Pipe the SSE stream directly back to the client
    // Include plan info as a header so the client can show the model badge
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
        'X-Agathon-Plan': isEnterprise ? 'enterprise' : 'free',
        'X-Agathon-Model': isEnterprise ? 'Claude Sonnet' : 'Gemini Flash',
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
