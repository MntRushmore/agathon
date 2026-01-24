import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkAndDeductCredits } from '@/lib/ai/credits';
import { callHackClubAI, buildHackClubRequest } from '@/lib/ai/hackclub';

interface CanvasContext {
  subject?: string;
  gradeLevel?: string;
  instructions?: string;
  description?: string;
  imageBase64?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    // Auth check - require login for all AI features
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required', code: 'AUTH_REQUIRED' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { messages, canvasContext, isSocratic } = (await req.json()) as {
      messages: ChatMessage[];
      canvasContext: CanvasContext;
      isSocratic?: boolean;
    };

    // Build the base system prompt
    let systemPrompt = `You are a helpful AI tutor on an educational whiteboard app. Your role is to help students learn by guiding them through problems.

Context about the student's work:
- Subject: ${canvasContext.subject || 'General'}
- Grade level: ${canvasContext.gradeLevel || 'Not specified'}
- Assignment instructions: ${canvasContext.instructions || 'None provided'}

IMPORTANT: You can see the student's whiteboard/canvas in the image attached to their first message. Analyze their work, drawings, equations, and steps shown on the canvas to provide helpful feedback.

Guidelines for your responses:
1. Be encouraging and patient - celebrate small wins
2. Give hints and guide thinking before giving direct answers
3. Use LaTeX for math expressions: $inline$ for inline and $$block$$ for displayed equations
4. Break down complex problems into steps
5. Ask clarifying questions if the student's question is unclear
6. Keep explanations clear and age-appropriate
7. If you need to show worked examples, use clear step-by-step formatting

Remember: Your goal is to help the student LEARN, not just get answers.`;

    if (isSocratic) {
      systemPrompt += `

CRITICAL - SOCRATIC TUTORING MODE:
You are currently in Socratic Mode. Your goal is to lead the student to the answer by asking probing, guiding questions based on their work.
- NEVER provide the final answer or a complete step.
- Focus on identifying what the student already knows and where they are stuck.
- Ask 1-2 targeted questions at a time to nudge them toward the next logical step.
- If they are completely stuck, provide a very small hint and ask a question about it.`;
    }

    // Check credits to determine which AI to use
    const { usePremium, creditBalance } = await checkAndDeductCredits(
      user.id,
      'chat',
      'AI chat assistance'
    );

    // Common response headers
    const baseHeaders = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Credits-Remaining': String(creditBalance),
    };

    // Build messages with image content for vision model
    const userMessages = messages.map((m, index) => {
      if (m.role === 'user' && index === 0 && canvasContext.imageBase64) {
        return {
          role: m.role,
          content: [
            { type: 'image_url', image_url: { url: canvasContext.imageBase64 } },
            { type: 'text', text: m.content },
          ],
        };
      }
      return { role: m.role, content: m.content };
    });

    if (usePremium) {
      // Premium: Use OpenRouter with Nano Banana Pro
      const openrouterApiKey = process.env.OPENROUTER_API_KEY;
      const model = process.env.OPENROUTER_MODEL || 'google/gemini-3-pro-image-preview';

      if (!openrouterApiKey) {
        return new Response(
          JSON.stringify({ error: 'OPENROUTER_API_KEY not configured' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const apiMessages: any[] = [{ role: 'system', content: systemPrompt }, ...userMessages];

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openrouterApiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
          'X-Title': 'Whiteboard AI Tutor',
        },
        body: JSON.stringify({
          model,
          messages: apiMessages,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenRouter API error:', errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to get response from AI' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(response.body, {
        headers: {
          ...baseHeaders,
          'X-AI-Provider': 'openrouter',
          'X-Image-Supported': 'true',
          'X-Is-Premium': 'true',
        },
      });
    } else {
      // Free tier: Use Hack Club AI
      const hackclubRequest = buildHackClubRequest(systemPrompt, userMessages, true);

      try {
        const response = await callHackClubAI(hackclubRequest);

        return new Response(response.body, {
          headers: {
            ...baseHeaders,
            'X-AI-Provider': 'hackclub',
            'X-Image-Supported': 'true',
            'X-Is-Premium': 'false',
          },
        });
      } catch (hackclubError) {
        console.error('Hack Club AI error:', hackclubError);
        return new Response(
          JSON.stringify({ error: 'Failed to get response from AI' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
