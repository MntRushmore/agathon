import { NextRequest, NextResponse } from 'next/server';
import { solutionLogger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkAndDeductCredits } from '@/lib/ai/credits';
import { callHackClubAI } from '@/lib/ai/hackclub';

// Response structure for text-based feedback that can be rendered on canvas
interface FeedbackAnnotation {
  type: 'correction' | 'hint' | 'encouragement' | 'step' | 'answer';
  content: string;
  position?: 'above' | 'below' | 'right' | 'inline';
}

interface StructuredFeedback {
  summary: string;
  annotations: FeedbackAnnotation[];
  nextStep?: string;
  isCorrect?: boolean;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  solutionLogger.info({ requestId }, 'Solution generation request started');

  try {
    // Auth check - require login for all AI features
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    // Parse the request body
    const {
      image,
      prompt,
      mode = 'suggest',
      source = 'auto',
    } = await req.json();

    if (!image) {
      solutionLogger.warn({ requestId }, 'No image provided in request');
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    // Validate image format
    if (typeof image !== 'string' || !image.startsWith('data:image/')) {
      solutionLogger.warn({ requestId }, 'Invalid image format');
      return NextResponse.json(
        { error: 'Image must be a valid base64 data URL (data:image/...)' },
        { status: 400 }
      );
    }

    // Validate mode
    const validModes = ['feedback', 'suggest', 'answer'];
    if (!validModes.includes(mode)) {
      solutionLogger.warn({ requestId, mode }, 'Invalid mode');
      return NextResponse.json(
        { error: `Mode must be one of: ${validModes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate source
    if (source !== 'auto' && source !== 'voice') {
      solutionLogger.warn({ requestId, source }, 'Invalid source');
      return NextResponse.json(
        { error: 'Source must be either "auto" or "voice"' },
        { status: 400 }
      );
    }

    // Validate prompt if provided
    if (prompt && typeof prompt !== 'string') {
      solutionLogger.warn({ requestId }, 'Invalid prompt format');
      return NextResponse.json(
        { error: 'Prompt must be a string' },
        { status: 400 }
      );
    }

    if (prompt && prompt.length > 5000) {
      solutionLogger.warn({ requestId, promptLength: prompt.length }, 'Prompt too long');
      return NextResponse.json(
        { error: 'Prompt exceeds maximum length of 5000 characters' },
        { status: 400 }
      );
    }

    solutionLogger.debug({
      requestId,
      imageSize: image.length
    }, 'Request payload received');

    // Check credits to determine which AI to use
    const { usePremium, creditBalance } = await checkAndDeductCredits(
      user.id,
      'generate-solution',
      `Generate solution (${mode} mode)`
    );

    // Generate mode-specific prompt for text-based feedback
    const getModePrompt = (mode: string): string => {
      const baseAnalysis = `You are a helpful math tutor analyzing a student's handwritten work on a whiteboard.

CRITICAL MATH EVALUATION RULES:
1. CAREFULLY read the handwritten numbers. Handwriting can be messy - look closely at each digit.
2. ALWAYS CALCULATE the correct answer yourself before evaluating. For example, 50 + 2 = 52 (not 39).
3. DO NOT assume the student is wrong. Verify by computing: if they wrote "50 + 2 = 52", that IS CORRECT.
4. If there's a question mark (?) next to the answer, the student is asking if their answer is right.
5. Common errors to avoid: misreading "5" as "3", "0" as "6", etc.

Look at the image carefully and identify:
1. What problem or equation the student is working on
2. The actual numbers written (be very careful with handwriting recognition)
3. Calculate the correct answer yourself
4. Compare your calculation with what the student wrote

IMPORTANT: You must respond with a valid JSON object only. No markdown, no code fences, just pure JSON.`;

      const jsonFormat = `
Response format (JSON only, no markdown):
{
  "summary": "Brief description of what the student is working on",
  "isCorrect": true/false,
  "annotations": [
    {
      "type": "correction|hint|encouragement|step|answer",
      "content": "The feedback text",
      "position": "below"
    }
  ],
  "nextStep": "Optional suggestion for what to do next"
}`;

      switch (mode) {
        case 'feedback':
          return `${baseAnalysis}

TASK: Provide light, encouraging feedback.
- FIRST calculate the correct answer yourself
- If the student's answer matches your calculation, mark it as CORRECT with encouragement (use "✓ Correct!" or "✓ Great work!")
- If the student has a question mark (?), answer whether their work is correct
- Only point out errors if the answer is ACTUALLY WRONG
- Keep feedback minimal and non-intrusive
- Use "correction" type ONLY for actual errors, "encouragement" type for correct work

${jsonFormat}`;

        case 'suggest':
          return `${baseAnalysis}

TASK: Provide a helpful hint to guide the student.
- FIRST verify if their current work is correct before suggesting changes
- If they're correct, encourage them and suggest next steps
- If there's an error, give a hint that helps them figure it out WITHOUT giving the full answer
- Ask guiding questions or suggest an approach
- Use "hint" type for suggestions

${jsonFormat}`;

        case 'answer':
          return `${baseAnalysis}

TASK: Provide the complete solution with all steps.
- FIRST calculate the correct answer yourself
- Show the full worked solution step by step
- Explain each step briefly
- If their work is already correct, confirm it with "✓ Your answer is correct!"
- Use "step" type for solution steps, "answer" type for the final answer

${jsonFormat}`;

        default:
          return `${baseAnalysis}

TASK: Provide helpful assistance.
${jsonFormat}`;
      }
    };

    const basePrompt = getModePrompt(mode);
    const finalPrompt = prompt
      ? `${basePrompt}\n\nAdditional context from tutor: ${prompt}`
      : basePrompt;

    let feedback: StructuredFeedback;
    let provider: string;

    if (usePremium) {
      // Premium: Use OpenRouter with Nano Banana Pro (can write on whiteboard)
      solutionLogger.info({ requestId, mode }, 'Using OpenRouter (Premium) for solution feedback');

      const openrouterApiKey = process.env.OPENROUTER_API_KEY;
      const model = process.env.OPENROUTER_MODEL || 'google/gemini-3-pro-image-preview';

      if (!openrouterApiKey) {
        solutionLogger.error({ requestId }, 'OpenRouter API key missing');
        return NextResponse.json(
          { error: 'OPENROUTER_API_KEY not configured' },
          { status: 500 }
        );
      }

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
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: image } },
                { type: 'text', text: finalPrompt },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        solutionLogger.error({ requestId, status: response.status, error: errorText }, 'OpenRouter API error');
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      const textContent = data.choices?.[0]?.message?.content || '';

      // Parse JSON response
      try {
        let jsonStr = textContent.trim();
        if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
        else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
        if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
        feedback = JSON.parse(jsonStr.trim());
      } catch {
        feedback = {
          summary: 'AI Feedback',
          annotations: [{ type: mode === 'answer' ? 'answer' : 'hint', content: textContent, position: 'below' }],
        };
      }
      provider = 'openrouter';
    } else {
      // Free tier: Use Hack Club AI
      solutionLogger.info({ requestId, mode }, 'Using Hack Club AI (Free) for solution feedback');

      try {
        const hackclubResponse = await callHackClubAI({
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: image } },
                { type: 'text', text: finalPrompt },
              ],
            },
          ],
          stream: false,
        });

        const data = await hackclubResponse.json();
        const textContent = data.choices?.[0]?.message?.content || '';

        // Parse JSON response
        try {
          let jsonStr = textContent.trim();
          if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
          else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
          if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
          feedback = JSON.parse(jsonStr.trim());
        } catch {
          feedback = {
            summary: 'AI Feedback',
            annotations: [{ type: mode === 'answer' ? 'answer' : 'hint', content: textContent, position: 'below' }],
          };
        }
        provider = 'hackclub';
      } catch (hackclubError) {
        solutionLogger.error({ requestId, error: hackclubError }, 'Hack Club AI error');
        return NextResponse.json(
          { error: 'Failed to generate solution', details: hackclubError instanceof Error ? hackclubError.message : 'Unknown error' },
          { status: 500 }
        );
      }
    }

    const duration = Date.now() - startTime;
    solutionLogger.info({ requestId, duration, provider }, 'Solution generation completed');

    return NextResponse.json({
      success: true,
      feedback,
      textContent: feedback.summary || '',
      provider,
      creditsRemaining: creditBalance,
      imageSupported: true,
      isPremium: usePremium,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    solutionLogger.error({
      requestId,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Error generating solution');

    return NextResponse.json(
      { error: 'Failed to generate solution', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
