import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { callHackClubAI, buildHackClubRequest } from '@/lib/ai/hackclub';
import { searchKnowledgeBase, buildKnowledgeAwarePrompt, hasKnowledgeBase, getUpcomingAssignmentsContext } from '@/lib/ai/knowledge-agent';

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

type MessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

interface APIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | MessageContentPart[];
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

    const body = await req.json();
    const { messages, canvasContext, isSocratic } = body as {
      messages: ChatMessage[];
      canvasContext: CanvasContext;
      isSocratic?: boolean;
    };

    // Input validation
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (messages.length > 50) {
      return new Response(
        JSON.stringify({ error: 'Too many messages (max 50)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    for (const msg of messages) {
      if (!msg.role || !msg.content || typeof msg.content !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Each message must have a role and content string' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (msg.content.length > 50000) {
        return new Response(
          JSON.stringify({ error: 'Message content too long (max 50000 chars)' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Build the base system prompt
    let systemPrompt = `You are a helpful AI tutor on an educational whiteboard app. Your role is to help students learn by guiding them through problems.

Context about the student's work:
- Subject: ${canvasContext.subject || 'General'}
- Grade level: ${canvasContext.gradeLevel || 'Not specified'}
- Assignment instructions: ${canvasContext.instructions || 'None provided'}

IMPORTANT: You can see the student's whiteboard/canvas in the image attached to their first message. Analyze their work, drawings, equations, and steps shown on the canvas to provide helpful feedback.

ACCURACY IS CRITICAL:
- Always verify your own math before presenting it to the student. They trust your corrections.
- If you cannot read something in their handwriting, ask rather than guess.
- Common handwriting confusions: 1 vs 7, 6 vs 0, 3 vs 8, 5 vs S, 2 vs Z, b vs 6.

Guidelines for your responses:
1. Be encouraging and patient - celebrate small wins
2. Give hints and guide thinking before giving direct answers
3. Use LaTeX for math: $inline$ for inline and $$block$$ for displayed equations (e.g. $\\frac{a}{b}$, $\\sqrt{x}$, $x^n$)
4. Break down complex problems into steps
5. Ask clarifying questions if the student's question is unclear
6. Keep explanations clear and age-appropriate
7. If you need to show worked examples, use clear step-by-step formatting
8. If you are unsure about something, say so honestly

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

    // Knowledge Base Agent: search the student's connected notes for relevant context
    const latestUserMessage = messages.filter(m => m.role === 'user').pop();
    if (latestUserMessage) {
      try {
        const hasKB = await hasKnowledgeBase(user.id);
        if (hasKB) {
          const [knowledgeContext, upcomingContext] = await Promise.all([
            searchKnowledgeBase(user.id, latestUserMessage.content),
            getUpcomingAssignmentsContext(user.id),
          ]);
          systemPrompt = buildKnowledgeAwarePrompt(systemPrompt, knowledgeContext);
          if (upcomingContext) {
            systemPrompt += upcomingContext;
          }
        }
      } catch (kbError) {
        // Knowledge base search is non-critical — continue without it
        console.error('Knowledge base search error:', kbError);
      }
    }

    // Build messages with image content for vision model
    const userMessages: APIMessage[] = messages.map((m, index) => {
      if (m.role === 'user' && index === 0 && canvasContext.imageBase64) {
        return {
          role: m.role,
          content: [
            { type: 'image_url' as const, image_url: { url: canvasContext.imageBase64 } },
            { type: 'text' as const, text: m.content },
          ],
        };
      }
      return { role: m.role, content: m.content };
    });

    // All users get Hack Club AI — no credit gating
    const hackclubRequest = buildHackClubRequest(systemPrompt, userMessages, true, 0.4);

    try {
      const response = await callHackClubAI(hackclubRequest);

      return new Response(response.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    } catch (hackclubError) {
      console.error('Hack Club AI error:', hackclubError);
      return new Response(
        JSON.stringify({ error: 'Failed to get response from AI' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
