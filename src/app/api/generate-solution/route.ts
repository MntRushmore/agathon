import { NextRequest, NextResponse } from 'next/server';
import { solutionLogger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkAndDeductCredits } from '@/lib/ai/credits';
import { callHackClubAI } from '@/lib/ai/hackclub';
import sharp from 'sharp';

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
  solution?: string;
}

/**
 * Generates a transparent PNG image of text that looks like handwriting
 */
async function generateHandwrittenImage(annotations: FeedbackAnnotation[]): Promise<string> {
  const width = 800;
  const height = 600;
  
  // Combine all annotations into a single block of text for the image
  const textContent = annotations.map(a => a.content).join('\n\n');
  
  // Create an SVG with handwriting style
  // We use a wobbly filter to make it look more hand-drawn
  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="pencil">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" />
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="none" />
      <text 
        x="40" 
        y="60" 
        fill="#2563eb" 
        style="font-family: 'Comic Sans MS', 'cursive', 'Chalkboard SE', 'Marker Felt', sans-serif; font-size: 28px; filter: url(#pencil);"
      >
        ${textContent.split('\n').map((line, i) => `<tspan x="40" dy="${i === 0 ? 0 : 40}">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</tspan>`).join('')}
      </text>
    </svg>
  `;

  try {
    const buffer = await sharp(Buffer.from(svg))
      .png()
      .toBuffer();
    
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch (error) {
    solutionLogger.error({ error }, 'Failed to generate handwritten image');
    return '';
  }
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
      isSocratic = false,
    } = await req.json();

    if (!image) {
      solutionLogger.warn({ requestId }, 'No image provided in request');
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    // Enforce Socratic mode if requested (Roadmap Item 8)
    let effectiveMode = mode;
    if (isSocratic && mode === 'answer') {
      solutionLogger.info({ requestId }, 'Socratic mode enforced: degrading "answer" to "suggest"');
      effectiveMode = 'suggest';
    }

    // Validate effectiveMode
    const validModes = ['feedback', 'suggest', 'answer'];
    if (!validModes.includes(effectiveMode)) {
      solutionLogger.warn({ requestId, mode: effectiveMode }, 'Invalid mode');
      return NextResponse.json(
        { error: `Mode must be one of: ${validModes.join(', ')}` },
        { status: 400 }
      );
    }

    // Check plan tier — only enterprise users get handwritten visual feedback
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan_tier, plan_status')
      .eq('id', user.id)
      .single();

    const isEnterprisePlan = (profile?.plan_tier === 'premium' || profile?.plan_tier === 'enterprise')
      && profile?.plan_status === 'active';

    // Only attempt credit deduction for enterprise users
    let shouldShowPremiumHandwriting = false;
    let creditBalance = 0;
    if (isEnterprisePlan) {
      const result = await checkAndDeductCredits(user.id, 'generate-solution');
      shouldShowPremiumHandwriting = result.usePremium;
      creditBalance = result.creditBalance;
    }

    // Generate mode-specific prompt
    const getModePrompt = (
      mode: string,
      source: 'auto' | 'voice' = 'auto',
      isSocratic: boolean = false
    ): string => {
      const effectiveSource = source === 'voice' ? 'voice' : 'auto';

      const baseAnalysis = 'Analyze the user\'s writing in the image carefully. Look for incomplete work or any indication that the user is working through something challenging and might benefit from some form of assistance.';
      
      const noHelpInstruction = '\n\nIf the user does NOT seem to need help:\n- Simply respond concisely with text explaining why help isn\'t needed. Do not generate an image.\n\nBe thoughtful about when to offer help - look for clear signs of incomplete problems or questions.';
      
      const alwaysImageRule =
        effectiveSource === 'voice'
          ? '\n- ALWAYS generate an updated image of the canvas; do not respond with text-only.'
          : '';

      const coreRules = 
        '\n\n**CRITICAL:**\n- DO NOT remove, modify, move, transform, edit, or touch ANY of the image\'s existing content. Leave EVERYTHING in the image EXACTLY as it is in its current state, and *only* add to it.\n- Try to match the user\'s exact handwriting style.\n- NEVER update the background color of the image. Keep it white, unless directed otherwise.' +
        (isSocratic ? '\n- SOCRATIC MODE: Do not give the answer directly. Use hints and questions to guide the student.' : '') +
        alwaysImageRule;

      const noHelpBlock = effectiveSource === 'auto' ? noHelpInstruction : '';

      switch (mode) {
        case 'feedback':
          return `${baseAnalysis}\n\nIf the user needs help:\n- Provide the least intrusive assistance - think of adding visual annotations\n- Add visual feedback elements: highlighting, underlining, arrows, circles, light margin notes, etc.\n- Try to use colors that stand out but complement the work\n- Write in a natural style that matches the user\'s handwriting${coreRules}${noHelpBlock}`;
        
        case 'suggest':
          return `${baseAnalysis}\n\nIf the user needs help:\n- Provide a HELPFUL HINT or guide them to the next step - don\'t give them the end solution.\n- Add suggestions for what to try next, guiding questions, etc.\n- Point out which direction to go without giving the full answer${coreRules}${noHelpBlock}`;
        
        case 'answer':
          return `${baseAnalysis}\n\nIf the user needs help:\n- Provide COMPLETE, DETAILED assistance - fully solve the problem or answer the question\n- Try to make it comprehensive and educational${coreRules}${noHelpBlock}`;
        
        default:
          return `${baseAnalysis}\n\nIf the user needs help:\n- Provide a helpful hint or guide them to the next step${coreRules}${noHelpBlock}`;
      }
    };

    const effectiveSource: 'auto' | 'voice' = source === 'voice' ? 'voice' : 'auto';
    const basePrompt = getModePrompt(effectiveMode, effectiveSource, isSocratic);
    const finalPrompt = prompt
      ? `${basePrompt}\n\nAdditional drawing instructions from the tutor:\n${prompt}`
      : basePrompt;

    let feedback: StructuredFeedback | null = null;
    let provider: string;
    let imageUrl = '';
    let textContent = '';

    if (shouldShowPremiumHandwriting) {
      // Premium: Use OpenRouter with image generation model
      solutionLogger.info({ requestId, mode: effectiveMode, isSocratic, source: effectiveSource }, 'Using OpenRouter (Premium) for image-based solution');

      const openrouterApiKey = process.env.OPENROUTER_API_KEY;
      const model = process.env.OPENROUTER_MODEL || 'google/gemini-3-pro-image-preview';

      if (!openrouterApiKey) {
        solutionLogger.error({ requestId }, 'OpenRouter API key missing');
        return NextResponse.json(
          { error: 'OPENROUTER_API_KEY not configured' },
          { status: 500 }
        );
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for image gen

      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openrouterApiKey}`,
            'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
            'X-Title': 'Madhacks AI Canvas',
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
            modalities: ['image', 'text'],
            reasoning_effort: 'minimal',
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          solutionLogger.error({ requestId, status: response.status, error: errorData }, 'OpenRouter API error');
          throw new Error(errorData.error?.message || `OpenRouter API error: ${response.status}`);
        }

        const data = await response.json();
        const message = data.choices?.[0]?.message;

        // Extract text content — handle both string and array (multimodal) responses
        const rawContent = message?.content;
        if (typeof rawContent === 'string') {
          textContent = rawContent;
        } else if (Array.isArray(rawContent)) {
          textContent = rawContent
            .filter((part: any) => part?.type === 'text' && part.text)
            .map((part: any) => part.text)
            .join('\n');
        } else {
          textContent = '';
        }

        // Extract image from response (flexible extraction logic from snippet)
        let aiImageUrl: string | null = null;

        // 1) Legacy / hypothetical format
        const legacyImages = (message as any)?.images;
        if (Array.isArray(legacyImages) && legacyImages.length > 0) {
          const first = legacyImages[0];
          aiImageUrl = first?.image_url?.url ?? first?.url ?? null;
        }

        // 2) Content array
        if (!aiImageUrl) {
          const content = (message as any)?.content;
          if (Array.isArray(content)) {
            for (const part of content) {
              if ((part?.type === 'image_url' || part?.type === 'output_image') && (part.url || part.image_url?.url)) {
                aiImageUrl = part.url || part.image_url?.url;
                break;
              }
            }
          } else if (typeof content === 'string') {
            // 3) Fallback scan
            const dataUrlMatch = content.match(/data:image\/[a-zA-Z+]+;base64,[^\s")'}]+/);
            const httpUrlMatch = content.match(/https?:\/\/[^\s")'}]+?\.(?:png|jpg|jpeg|gif|webp)/i);
            if (dataUrlMatch) aiImageUrl = dataUrlMatch[0];
            else if (httpUrlMatch) aiImageUrl = httpUrlMatch[0];
          }
        }

        imageUrl = aiImageUrl || '';
        provider = 'openrouter';
        
        // Mock feedback object for compatibility if image returned
        if (imageUrl) {
          feedback = {
            summary: textContent || 'Handwritten feedback generated',
            annotations: [],
          };
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } else {
      // Free tier: Use Hack Club AI with helpful math feedback
      solutionLogger.info({ requestId, mode: effectiveMode, isSocratic }, 'Using Hack Club AI (Free) for solution feedback');

      // System prompt with accuracy-first instructions
      const freeSystemPrompt = `You are a precise, encouraging math tutor analyzing a student's handwritten work on a whiteboard.

ACCURACY IS YOUR TOP PRIORITY. Before responding:
1. Read every digit and symbol in the image carefully — do not rush.
2. Double-check your own arithmetic. Verify each calculation step before including it.
3. If you cannot read a digit or symbol clearly, say so rather than guessing.

HANDWRITING RECOGNITION (common confusions to watch for):
- 1 vs 7 (look for serifs or crossbars)
- 6 vs 0 vs b (look for closure of the loop)
- 3 vs 8 (look for whether loops are closed)
- 5 vs S, 2 vs Z
- Decimal points vs stray marks
- Negative signs vs hyphens vs subtraction

MODE: ${
  effectiveMode === 'answer'
    ? 'SOLVE — Show the complete solution with every step worked out clearly. Verify your final answer by substitution or estimation before responding.'
    : effectiveMode === 'feedback'
    ? 'FEEDBACK — Check their work carefully for errors. If something is wrong, point out exactly what is wrong and why. If everything is correct, confirm it with a brief explanation of why it works.'
    : 'HINT — Guide them toward the next step WITHOUT giving the answer. Ask a question or give a small nudge in the right direction. Do not reveal the solution.'
}
${isSocratic ? '\nSOCRATIC MODE: Never give the answer directly. Use guiding questions to lead the student to discover it themselves.' : ''}

FORMATTING:
- Use LaTeX for ALL math: $x = 5$ (inline), $$x^2 + 3x + 2 = 0$$ (display)
- Common LaTeX: $\\frac{a}{b}$, $\\sqrt{x}$, $x^{n}$, $\\sum$, $\\int$
- Be concise and student-friendly
- If uncertain about what you see, include a note like "I'm reading this as ___; let me know if that's wrong"

OUTPUT: Respond ONLY with valid JSON matching this schema:
{
  "summary": "One sentence: what you see and your overall assessment",
  "isCorrect": true | false | null,
  "annotations": [
    {
      "type": "correction | hint | encouragement | step | answer",
      "content": "Your feedback here with $LaTeX$ math"
    }
  ],
  "solution": "Full worked solution (only when mode is SOLVE, otherwise omit this field)"
}

EXAMPLE (student wrote 3 + 5 = 9):
{
  "summary": "Small arithmetic error in the addition.",
  "isCorrect": false,
  "annotations": [
    {
      "type": "correction",
      "content": "It looks like you wrote $3 + 5 = 9$, but $3 + 5 = 8$. Quick check: count up 5 from 3 → 4, 5, 6, 7, 8."
    },
    {
      "type": "encouragement",
      "content": "You set up the problem correctly — just a small slip in the final step!"
    }
  ]
}

No text before or after the JSON object.`;

      const freeUserPrompt = `Analyze this student's handwritten math work. Mode: ${effectiveMode}.${
        prompt ? `\nAdditional context: ${prompt}` : ''
      }`;

      try {
        const hackclubResponse = await callHackClubAI({
          temperature: 0.3,
          messages: [
            {
              role: 'system',
              content: freeSystemPrompt,
            },
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: image } },
                { type: 'text', text: freeUserPrompt },
              ],
            },
          ],
          stream: false,
        });

        const data = await hackclubResponse.json();
        textContent = data.choices?.[0]?.message?.content || '';

        // Robust JSON extraction helper
        const extractJSON = (text: string): any => {
          try {
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start === -1 || end === -1) return null;
            return JSON.parse(text.substring(start, end + 1));
          } catch {
            return null;
          }
        };

        const parsed = extractJSON(textContent);
        if (parsed) {
          feedback = {
            summary: parsed.summary || 'AI Feedback',
            annotations: Array.isArray(parsed.annotations) ? parsed.annotations : [],
            isCorrect: parsed.isCorrect,
            solution: parsed.solution,
          };
        } else {
          // Fallback: use raw text
          feedback = {
            summary: 'AI Feedback',
            annotations: [{ type: effectiveMode === 'answer' ? 'answer' : 'hint', content: textContent, position: 'below' }],
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
    solutionLogger.info({ requestId, duration, provider, mode: effectiveMode, isSocratic }, 'Solution generation completed');

    // For premium users, we already have the imageUrl from the AI model (if successful)
    // For free users, we might want to generate a simple one if needed, but the current logic
    // only does it for premium. However, since we now use the AI's image for premium,
    // we should only call generateHandwrittenImage if we don't already have an imageUrl.
    
    if (shouldShowPremiumHandwriting && !imageUrl && feedback && feedback.annotations.length > 0) {
      imageUrl = await generateHandwrittenImage(feedback.annotations);
    }

    return NextResponse.json({
      success: !!imageUrl || (feedback && feedback.annotations.length > 0),
      feedback,
      textContent: textContent || (feedback ? feedback.summary : ''),
      provider,
      creditsRemaining: creditBalance,
      imageSupported: true,
      isPremium: shouldShowPremiumHandwriting,
      imageUrl,
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
