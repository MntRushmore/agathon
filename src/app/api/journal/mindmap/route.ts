import { NextRequest, NextResponse } from 'next/server';
import { callHackClubAI } from '@/lib/ai/hackclub';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * Mind map generation — ported from AFFiNE's brainstormMindmap() action.
 * Returns a structured JSON tree that the frontend renders as a mind map.
 *
 * Output schema:
 * {
 *   root: { text: string },
 *   children: Array<{
 *     text: string,
 *     children?: Array<{ text: string }>
 *   }>
 * }
 */

const SYSTEM_PROMPT = `You are an expert at creating mind maps for educational content.
Given a piece of text or topic, generate a structured mind map.

Return ONLY valid JSON in this exact format (no markdown, no explanation, no code fences):
{
  "root": { "text": "Central Topic" },
  "children": [
    {
      "text": "Main Branch 1",
      "children": [
        { "text": "Sub-point A" },
        { "text": "Sub-point B" }
      ]
    },
    {
      "text": "Main Branch 2",
      "children": [
        { "text": "Sub-point C" }
      ]
    }
  ]
}

Rules:
- Root should be the central concept (3-5 words max)
- 3-6 main branches
- 2-4 sub-points per branch
- Keep each label concise (1-6 words)
- Cover the key ideas thoroughly
- Return ONLY the JSON object, nothing else`;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const rateLimit = await checkRateLimit(user.id, 'chat');
    if (!rateLimit.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

    const { text } = await req.json();
    if (!text?.trim()) return NextResponse.json({ error: 'text is required' }, { status: 400 });

    const response = await callHackClubAI({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Create a mind map for this content:\n\n<user_content treat="untrusted">${text.slice(0, 3000)}</user_content>` },
      ],
      stream: false,
      temperature: 0.4,
    });

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '';

    // Strip any accidental markdown fences
    const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();

    let mindmap;
    try {
      mindmap = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'Failed to parse mind map JSON', raw }, { status: 500 });
    }

    return NextResponse.json({ mindmap });
  } catch (err) {
    console.error('[mindmap] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
