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

    // Check and deduct credits
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

    if (usePremium) {
      // Use Vertex AI (premium with image support)
    const projectId = process.env.VERTEX_PROJECT_ID;
    const location = process.env.VERTEX_LOCATION || 'us-central1';
    const accessToken = process.env.VERTEX_ACCESS_TOKEN;
    const apiKey = process.env.VERTEX_API_KEY;
    const model = process.env.VERTEX_MODEL_ID || 'google/gemini-3-pro-image-preview';

    if (!accessToken && !apiKey) {
      return new Response(
        JSON.stringify({ error: 'Vertex credentials missing (set VERTEX_ACCESS_TOKEN or VERTEX_API_KEY)' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (accessToken && !projectId) {
      return new Response(
        JSON.stringify({ error: 'VERTEX_PROJECT_ID not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // For API key, use query param; for OAuth token, use Bearer auth
    const baseUrl = accessToken
      ? `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/endpoints/openapi/chat/completions`
      : `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions?key=${apiKey}`;

    // For API key flow, use simpler model name without google/ prefix
    const effectiveModel = accessToken ? model : model.replace('google/', '');

      const apiMessages: { role: string; content: string | { type: string; text?: string; image_url?: { url: string } }[] }[] = [
        { role: 'system', content: systemPrompt },
      ];

      messages.forEach((m, index) => {
        if (m.role === 'user' && index === 0 && canvasContext.imageBase64) {
          apiMessages.push({
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: canvasContext.imageBase64 },
              },
              {
                type: 'text',
                text: m.content,
              },
            ],
          });
        } else {
          apiMessages.push({ role: m.role, content: m.content });
        }
      });

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Google AI Studio OpenAI endpoint requires Authorization header even with API key
        Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: effectiveModel,
        messages: apiMessages,
        stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google API error:', errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to get response from AI' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(response.body, {
        headers: {
          ...baseHeaders,
          'X-AI-Provider': 'vertex',
          'X-Image-Supported': 'true',
        },
      });
    } else {
      // Use Hack Club AI (free, text-only fallback)
      // Build messages with image content converted to text
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

      const hackclubRequest = buildHackClubRequest(systemPrompt, userMessages, true);

      try {
        const response = await callHackClubAI(hackclubRequest);

        return new Response(response.body, {
          headers: {
            ...baseHeaders,
            'X-AI-Provider': 'hackclub',
            'X-Image-Supported': 'false',
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
