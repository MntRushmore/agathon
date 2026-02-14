import { HACKCLUB_MODEL } from '@/lib/ai/config';
import { callHackClubAI, type HackClubMessage } from '@/lib/ai/hackclub';

const SYSTEM_PROMPT = `You are the Agathon assistant — a helpful AI built into an educational learning platform called Agathon.

Agathon helps students learn by doing: they draw problems on an interactive whiteboard, get AI-powered hints and guidance, and build deep understanding through Socratic tutoring.

Key features you can help with:
- **Boards**: Interactive whiteboard spaces where students draw, write, and solve problems with AI tutoring
- **Journals**: AI-powered study notes with flashcards, summaries, and practice problems
- **Knowledge Base**: Students can connect Google Drive/Classroom to get personalized tutoring from their own notes
- **PDF Annotator**: Mark up PDFs and images
- **Classes**: Teachers can create classes, assignments, and track student progress

When answering questions:
- Be concise and helpful
- If the user asks about a feature, explain how to use it in Agathon
- For navigation questions, guide them to the right page
- For study/learning questions, give a brief helpful answer and suggest they open a Board for deeper help
- Use markdown for formatting`;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const hackclubMessages: HackClubMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  const response = await callHackClubAI({
    messages: hackclubMessages,
    model: HACKCLUB_MODEL,
    stream: true,
    temperature: 0.5,
    max_tokens: 1024,
  });

  // Transform OpenAI SSE → AI SDK data stream format
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const transform = new TransformStream({
    transform(chunk, controller) {
      const text = decoder.decode(chunk, { stream: true });
      const lines = text.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') {
          controller.enqueue(encoder.encode('d:{"finishReason":"stop"}\n'));
          return;
        }
        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            controller.enqueue(encoder.encode(`0:${JSON.stringify(content)}\n`));
          }
        } catch {
          // skip unparseable lines
        }
      }
    },
  });

  const stream = response.body!.pipeThrough(transform);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Vercel-AI-Data-Stream': 'v1',
    },
  });
}
