import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { callHackClubAI } from '@/lib/ai/hackclub';

interface Step {
  number: number;
  explanation: string;
  latex?: string;
}

interface SocraticQuestion {
  question: string;
  hint: string;
  followUp: string;
}

interface GoDeepResponse {
  steps: Step[];
  socraticQuestions: SocraticQuestion[];
  conceptsInvolved: string[];
}

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { image, originalAnswer, mode = 'both', conversationHistory, goDeepContext } = await req.json();

    if (!image) {
      return NextResponse.json(
        { error: 'Image is required' },
        { status: 400 }
      );
    }

    // Follow-up conversation mode — stream responses
    if (conversationHistory && Array.isArray(conversationHistory)) {
      if (conversationHistory.length > 20) {
        return NextResponse.json(
          { error: 'Conversation limit reached. Please start a new Go Deeper session.' },
          { status: 400 }
        );
      }

      const imageData = image.startsWith('data:')
        ? image.split(',')[1]
        : image;

      const systemPrompt = `You are a thoughtful, encouraging math tutor continuing a conversation with a student about a problem they're working on.

Here is the analysis you already provided for this problem:
${goDeepContext || 'No prior analysis available.'}

The student's original answer: ${originalAnswer || 'see the image'}

Guidelines:
- Be conversational, warm, and encouraging
- Use LaTeX ($...$) for any math expressions
- Keep responses focused and concise (2-4 paragraphs max)
- If the student asks for an example, give a concrete one
- If they want to try again, guide them without giving the answer directly
- Ask a follow-up question at the end to keep the learning going
- Never be condescending or overly verbose`;

      const messages = [
        {
          role: 'system' as const,
          content: systemPrompt,
        },
        {
          role: 'user' as const,
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${imageData}` },
            },
            {
              type: 'text',
              text: 'This is the problem image for context.',
            },
          ],
        },
        ...conversationHistory.map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ];

      const response = await callHackClubAI({
        model: 'google/gemini-2.5-flash',
        messages,
        stream: true,
        max_tokens: 1500,
      });

      // Forward the streaming response
      return new Response(response.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // Initial analysis mode — structured JSON response (existing behavior)
    const prompt = `You are a thoughtful math tutor having a real conversation with a student. Help them understand this problem more deeply.

The student solved this: ${originalAnswer || 'see the image'}

Your job:

${mode === 'steps' || mode === 'both' ? `
## STEPS
Give 3-4 clear steps. Write like you're talking to the student:
- Short, friendly explanations (not robotic)
- Include the math using LaTeX ($...$)
- Focus on the "why", not just the "what"
` : ''}

${mode === 'socratic' || mode === 'both' ? `
## SOCRATIC QUESTIONS (Important!)
Create 2-3 genuine questions that make the student THINK. Each question needs:
1. A thought-provoking question (not obvious, makes them pause)
2. A hint they can reveal if stuck
3. A follow-up to extend their thinking

Good questions:
- "What if we changed one number? How would that affect your approach?"
- "Why does breaking this into smaller parts actually work?"
- "Could you solve this a completely different way?"

Bad questions (avoid these):
- "What is 5 + 3?" (too simple, just asking for computation)
- "Did you check your work?" (generic)
- "What strategy did you use?" (too open-ended)
` : ''}

## CONCEPTS
2-3 math ideas involved (just the names, lowercase).

JSON format:
{
  "steps": [
    { "number": 1, "explanation": "Let's start by...", "latex": "$15 = 10 + 5$" }
  ],
  "socraticQuestions": [
    {
      "question": "If you had to explain this to a friend who's confused, what's the ONE key insight they need?",
      "hint": "Think about what makes this problem easier when you break it apart...",
      "followUp": "Try applying that same insight to 27 + 8"
    }
  ],
  "conceptsInvolved": ["number decomposition", "mental math"]
}

Only output JSON.`;

    // Extract base64 data from data URL if present
    const imageData = image.startsWith('data:')
      ? image.split(',')[1]
      : image;

    const response = await callHackClubAI({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${imageData}`,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
      stream: false,
      max_tokens: 2000,
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON from response
    let parsed: GoDeepResponse;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse Go Deeper response:', parseError, content);
      // Return a fallback response
      parsed = {
        steps: [
          { number: 1, explanation: 'Let\'s think about this step by step...', latex: '' }
        ],
        socraticQuestions: [
          {
            question: 'What was the trickiest part of this problem for you?',
            hint: 'Think about where you had to make a decision or choice.',
            followUp: 'How might you approach that part differently next time?'
          }
        ],
        conceptsInvolved: ['problem solving', 'mathematical thinking']
      };
    }

    // Validate and clean up the response
    const result: GoDeepResponse = {
      steps: Array.isArray(parsed.steps) ? parsed.steps.map((step, i) => ({
        number: step.number || i + 1,
        explanation: step.explanation || '',
        latex: step.latex || ''
      })) : [],
      socraticQuestions: Array.isArray(parsed.socraticQuestions)
        ? parsed.socraticQuestions.map(q => {
            // Handle both string format (old) and object format (new)
            if (typeof q === 'string') {
              return {
                question: q,
                hint: 'Think about what makes this problem unique...',
                followUp: 'Can you apply this to a similar problem?'
              };
            }
            return {
              question: q.question || '',
              hint: q.hint || '',
              followUp: q.followUp || ''
            };
          }).filter(q => q.question)
        : [],
      conceptsInvolved: Array.isArray(parsed.conceptsInvolved)
        ? parsed.conceptsInvolved.filter(c => typeof c === 'string')
        : []
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Go Deeper API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate deeper explanation' },
      { status: 500 }
    );
  }
}
