import { NextRequest, NextResponse } from 'next/server';
import { quickSolve, canQuickSolve } from '@/lib/cas-solver';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { callHackClubAI } from '@/lib/ai/hackclub';

export async function POST(req: NextRequest) {
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

    const { expression, image, variables, quick } = await req.json();

    // Input validation
    if (!expression && !image) {
      return NextResponse.json(
        { error: 'Either expression or image is required' },
        { status: 400 }
      );
    }
    if (expression && (typeof expression !== 'string' || expression.length > 10000)) {
      return NextResponse.json(
        { error: 'Expression must be a string under 10000 characters' },
        { status: 400 }
      );
    }
    if (image && (typeof image !== 'string' || image.length > 10_000_000)) {
      return NextResponse.json(
        { error: 'Image data too large (max ~7.5MB base64)' },
        { status: 400 }
      );
    }

    // If image is provided, use vision AI to recognize and solve
    if (image && typeof image === 'string' && image.startsWith('data:image/')) {
      const visionPrompt = `Look at this handwritten content. If it contains a math expression or equation, recognize it and solve it.

IMPORTANT RULES:
1. First, determine if this is a math problem. If it's NOT a math problem (just text, drawing, etc.), respond with exactly: NOT_MATH
2. If it IS math, respond in this exact format:
   EXPRESSION: [the math expression you see, e.g., "36 + 15" or "9 + 18"]
   ANSWER: [the computed answer, e.g., "51" or "27"]
3. Be very careful reading handwritten numbers - common confusions:
   - 1 vs 7 vs l
   - 6 vs 0 vs 9
   - 8 vs 0
   - 4 vs 9
   - + vs × vs ÷
4. If the math is incomplete (e.g., "3 +" with nothing after), respond: INCOMPLETE
5. If you can't read it clearly, respond: UNCLEAR
6. Only give the final numerical answer, no steps or explanation.

Examples:
- "36 + 15" → EXPRESSION: 36 + 15, ANSWER: 51
- "9 + 18" → EXPRESSION: 9 + 18, ANSWER: 27
- "hello world" → NOT_MATH
- "2x + 5 = 15" → EXPRESSION: 2x + 5 = 15, ANSWER: x = 5`;

      let content = '';

      try {
        const hackclubResponse = await callHackClubAI({
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: image } },
              { type: 'text', text: visionPrompt },
            ],
          }],
          stream: false,
          max_tokens: 150,
        });

        const data = await hackclubResponse.json();
        content = data.choices?.[0]?.message?.content?.trim() || '';
      } catch (hackclubError) {
        console.error('Hack Club AI vision error:', hackclubError);
        return NextResponse.json(
          { error: 'Vision API error', details: hackclubError instanceof Error ? hackclubError.message : 'Unknown error' },
          { status: 500 }
        );
      }

      // Parse the response
      if (content === 'NOT_MATH' || content === 'INCOMPLETE' || content === 'UNCLEAR') {
        return NextResponse.json({
          success: false,
          answer: null,
          recognized: null,
          reason: content.toLowerCase(),
          provider: 'hackclub',
        });
      }

      // Parse EXPRESSION and ANSWER from response
      const expressionMatch = content.match(/EXPRESSION:\s*(.+?)(?:,|\n|ANSWER)/i);
      const answerMatch = content.match(/ANSWER:\s*(.+)/i);

      const recognized = expressionMatch?.[1]?.trim() || '';
      let answer = answerMatch?.[1]?.trim() || '';
      answer = answer.replace(/\*\*/g, '').replace(/`/g, '').trim();

      if (!answer || answer === '?') {
        return NextResponse.json({
          success: false,
          answer: null,
          recognized,
          reason: 'could_not_solve',
          provider: 'hackclub',
        });
      }

      return NextResponse.json({
        success: true,
        answer,
        recognized,
        source: 'gemini-vision',
        provider: 'hackclub',
      });
    }

    if (!expression) {
      return NextResponse.json(
        { error: 'No expression or image provided' },
        { status: 400 }
      );
    }

    // Quick mode: use CAS for instant computation (no credits needed - local computation)
    if (quick) {
      if (canQuickSolve(expression)) {
        const result = quickSolve(expression);
        if (result.success) {
          return NextResponse.json({
            success: true,
            answer: result.answer,
            source: 'cas',
            provider: 'local',
          });
        }
        console.log('CAS failed, falling back to LLM:', result.error);
      }
    }

    // Text-based solving
    let variableContext = '';
    if (variables && Object.keys(variables).length > 0) {
      variableContext = '\n\nKnown variables:\n' +
        Object.entries(variables)
          .map(([name, value]) => `${name} = ${value}`)
          .join('\n');
    }

    const mathPrompt = `You are a math solver. Given a mathematical expression or equation (may be in LaTeX format), compute the answer.

RULES:
1. Return ONLY the final numerical answer or simplified result
2. Do NOT show work or steps
3. Do NOT include explanations
4. Understand LaTeX notation: \\frac{a}{b} means a/b, ^{n} means power, \\sqrt{x} means square root, \\int means integral, etc.
5. If it's an equation to solve (like "2x + 5 = 15"), return the solution (like "x = 5")
6. If it's an expression to evaluate (like "3 + 5"), return the result (like "8")
7. Round decimals to 4 places max
8. If you cannot solve it or it's incomplete, return "?"

Examples:
- Input: "2 + 3" → Output: "5"
- Input: "\\frac{1}{2} + \\frac{1}{4}" → Output: "3/4"
- Input: "2x + 5 = 15" → Output: "x = 5"
- Input: "\\sqrt{144}" → Output: "12"`;

    let answer = '';

    try {
      const hackclubResponse = await callHackClubAI({
        messages: [
          { role: 'system', content: mathPrompt },
          { role: 'user', content: `Solve: ${expression}${variableContext}` },
        ],
        stream: false,
        max_tokens: 100,
      });

      const hackclubData = await hackclubResponse.json();
      answer = hackclubData.choices?.[0]?.message?.content || '';
    } catch (hackclubError) {
      console.error('Hack Club AI error:', hackclubError);
      return NextResponse.json(
        { error: 'Failed to solve', details: 'AI service unavailable' },
        { status: 500 }
      );
    }

    answer = answer.trim().replace(/\*\*/g, '').replace(/`/g, '');
    answer = answer.replace(/^(Answer|Result|Solution):\s*/i, '');

    return NextResponse.json({
      success: true,
      answer: answer || '?',
      source: 'llm',
      provider: 'hackclub',
    });
  } catch (error) {
    console.error('Error solving math:', error);
    return NextResponse.json(
      { error: 'Failed to solve', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
