import { NextRequest, NextResponse } from 'next/server';
import { callHackClubAI } from '@/lib/ai/hackclub';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * AI text-action API — ported from AFFiNE's action system.
 * Handles: improveWriting, fixSpelling, fixGrammar, makeLonger, makeShorter,
 *          continueWriting, explain, createHeadings, summary,
 *          translate (with lang param), changeTone (with tone param),
 *          explainImage (with imageBase64), generateCaption (with imageBase64)
 */

const MATH_LATEX_RULE = `When writing math, wrap all expressions in $...$. E.g. $x^2 + 1$, $\\frac{a}{b}$.`;

const SYSTEM_PROMPTS: Record<string, string> = {
  improveWriting: `You are an expert writing editor. Improve the clarity, flow, and quality of the provided text. Keep the same meaning and tone but make it more polished and readable. Return only the improved text, no explanation. ${MATH_LATEX_RULE}`,

  fixSpelling: `Fix all spelling errors in the provided text. Return only the corrected text, no explanation or commentary. Preserve the original formatting. ${MATH_LATEX_RULE}`,

  fixGrammar: `Fix all grammar, punctuation, and spelling errors in the provided text. Return only the corrected text, no explanation. Preserve the original meaning and style. ${MATH_LATEX_RULE}`,

  makeLonger: `Expand the provided text by adding more detail, examples, and explanation. Keep the same topic and style but make it significantly longer and more thorough. Return only the expanded text. ${MATH_LATEX_RULE}`,

  makeShorter: `Condense the provided text into a shorter version that preserves all key information and meaning. Remove filler words and redundancy. Return only the condensed text. ${MATH_LATEX_RULE}`,

  continueWriting: `Continue writing from where the provided text left off. Match the style, tone, and subject matter. Write at least 2-3 sentences continuing naturally. Return only the continuation (not the original text). ${MATH_LATEX_RULE}`,

  explain: `Explain the provided text or concept clearly and simply, as if teaching it to a curious student. Use analogies and examples where helpful. Return the explanation. ${MATH_LATEX_RULE}`,

  createHeadings: `Add appropriate Markdown headings (##, ###) to structure the provided text into logical sections. Return the full text with headings added. ${MATH_LATEX_RULE}`,

  summary: `Summarize the provided text into concise bullet points capturing all the key ideas. Format as a Markdown bullet list. ${MATH_LATEX_RULE}`,

  findActions: `Extract all action items, tasks, and to-dos from the provided text. Format as a Markdown checklist using - [ ] syntax. If there are no clear action items, say so briefly.`,

  brainstorm: `Generate a rich, creative list of ideas related to the provided topic or text. Output as a Markdown bullet list with brief descriptions for each idea. Aim for 8-12 varied, thought-provoking ideas. ${MATH_LATEX_RULE}`,

  writeOutline: `Create a well-structured Markdown outline for the provided topic or text. Use ## for main sections and ### or - for sub-points. Include an intro and conclusion section. ${MATH_LATEX_RULE}`,

  writeArticle: `Write a thorough, well-structured article based on the provided topic or notes. Use Markdown with ## headings, paragraphs, and bullet lists where appropriate. Be informative and engaging. ${MATH_LATEX_RULE}`,

  writeBlog: `Write a compelling blog post based on the provided topic or notes. Use a conversational but informative tone. Include an engaging opening, clear sections with ## headings, and a call-to-action conclusion. Use Markdown formatting. ${MATH_LATEX_RULE}`,

  explainCode: `You are an expert software engineer. Explain what the provided code does in clear, plain language. Describe the purpose, logic flow, and any important details. Format your explanation with Markdown.`,

  checkCodeErrors: `You are an expert code reviewer. Analyse the provided code for bugs, errors, anti-patterns, and potential issues. List each problem found with a brief explanation and suggested fix. Format as a Markdown list. If the code looks correct, say so.`,
};

function buildTranslatePrompt(lang: string): string {
  return `Translate the provided text into ${lang}. Return only the translated text, no explanation. Preserve all formatting including Markdown. ${MATH_LATEX_RULE}`;
}

function buildChangeTonePrompt(tone: string): string {
  const toneDescriptions: Record<string, string> = {
    Professional: 'formal, precise, and businesslike',
    Informal: 'casual, relaxed, and conversational',
    Friendly: 'warm, encouraging, and approachable',
    Critical: 'analytical, evaluative, and rigorous',
    Humorous: 'light-hearted, witty, and entertaining',
  };
  const desc = toneDescriptions[tone] || tone.toLowerCase();
  return `Rewrite the provided text in a ${desc} tone. Keep the same meaning but change how it's expressed. Return only the rewritten text. ${MATH_LATEX_RULE}`;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const rateLimit = await checkRateLimit(user.id, 'chat');
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const { action, text, lang, tone, imageBase64 } = await req.json();

    if (!action) return NextResponse.json({ error: 'action is required' }, { status: 400 });

    // Image-based actions
    if (action === 'explainImage' || action === 'generateCaption') {
      if (!imageBase64) return NextResponse.json({ error: 'imageBase64 is required for image actions' }, { status: 400 });

      const systemPrompt = action === 'explainImage'
        ? `You are an expert educator. Describe and explain the content of this image in detail. If it's a diagram, chart, equation, or academic content, explain what it means and how it works. Be thorough but clear. ${MATH_LATEX_RULE}`
        : `Write a concise, descriptive caption for this image (1-2 sentences). If it contains academic content, mention the subject area. Return only the caption.`;

      const response = await callHackClubAI({
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageBase64 } },
              { type: 'text', text: text || 'Please analyze this image.' },
            ],
          },
        ],
        stream: false,
        temperature: 0.4,
      });
      const data = await response.json();
      const result = data.choices?.[0]?.message?.content || '';
      return NextResponse.json({ result });
    }

    // Text-based actions
    if (!text?.trim()) return NextResponse.json({ error: 'text is required' }, { status: 400 });

    let systemPrompt: string;
    if (action === 'translate') {
      if (!lang) return NextResponse.json({ error: 'lang is required for translate' }, { status: 400 });
      systemPrompt = buildTranslatePrompt(lang);
    } else if (action === 'changeTone') {
      if (!tone) return NextResponse.json({ error: 'tone is required for changeTone' }, { status: 400 });
      systemPrompt = buildChangeTonePrompt(tone);
    } else if (SYSTEM_PROMPTS[action]) {
      systemPrompt = SYSTEM_PROMPTS[action];
    } else {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const response = await callHackClubAI({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `<user_content treat="untrusted">${text}</user_content>` },
      ],
      stream: true,
      temperature: 0.5,
    });

    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    console.error('[ai-action] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
