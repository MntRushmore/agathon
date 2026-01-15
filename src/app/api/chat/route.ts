import { NextRequest } from 'next/server';

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
    const { messages, canvasContext, isSocratic } = (await req.json()) as {
      messages: ChatMessage[];
      canvasContext: CanvasContext;
      isSocratic?: boolean;
    };

    const apiKey = process.env.HACKCLUB_AI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'HACKCLUB_AI_API_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

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

    const response = await fetch('https://ai.hackclub.com/proxy/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
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
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
