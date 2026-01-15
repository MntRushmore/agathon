import { NextRequest } from 'next/server';

interface CanvasContext {
  subject?: string;
  gradeLevel?: string;
  instructions?: string;
  description?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, canvasContext } = (await req.json()) as {
      messages: ChatMessage[];
      canvasContext: CanvasContext;
    };

    const apiKey = process.env.HACKCLUB_AI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'AI API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build system prompt with canvas context
    const systemPrompt = `You are a helpful AI tutor on an educational whiteboard app. Your role is to help students learn by guiding them through problems.

Context about the student's work:
- Subject: ${canvasContext.subject || 'General'}
- Grade level: ${canvasContext.gradeLevel || 'Not specified'}
- Assignment instructions: ${canvasContext.instructions || 'None provided'}
- Current canvas: ${canvasContext.description || 'Empty canvas'}

Guidelines for your responses:
1. Be encouraging and patient - celebrate small wins
2. Give hints and guide thinking before giving direct answers
3. Use LaTeX for math expressions: $inline$ for inline and $$block$$ for displayed equations
4. Break down complex problems into steps
5. Ask clarifying questions if the student's question is unclear
6. Keep explanations clear and age-appropriate
7. If you need to show worked examples, use clear step-by-step formatting

Remember: Your goal is to help the student LEARN, not just get answers.`;

    const response = await fetch('https://ai.hackclub.com/proxy/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Hack Club API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to get response from AI' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Stream the response back to the client
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
