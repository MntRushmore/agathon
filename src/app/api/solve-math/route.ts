import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { expression, variables } = await req.json();

    if (!expression) {
      return NextResponse.json(
        { error: 'No expression provided' },
        { status: 400 }
      );
    }

    // Build context about known variables
    let variableContext = '';
    if (variables && Object.keys(variables).length > 0) {
      variableContext = '\n\nKnown variables:\n' +
        Object.entries(variables)
          .map(([name, value]) => `${name} = ${value}`)
          .join('\n');
    }

    // Call Hack Club API (Gemini) for solving
    const response = await fetch('https://ai.hackclub.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-preview-05-20',
        messages: [
          {
            role: 'system',
            content: `You are a math solver. Given a mathematical expression or equation, compute the answer.

RULES:
1. Return ONLY the final numerical answer or simplified result
2. Do NOT show work or steps
3. Do NOT include explanations
4. If it's an equation to solve (like "2x + 5 = 15"), return the solution (like "x = 5")
5. If it's an expression to evaluate (like "3 + 5"), return the result (like "8")
6. If it's a simplification (like "x^2 - 4" to factor), return simplified form (like "(x-2)(x+2)")
7. For trig, use degrees unless radians specified
8. Round decimals to 4 places max
9. If you cannot solve it, return "?"

Examples:
- Input: "2 + 3" → Output: "5"
- Input: "2x + 5 = 15" → Output: "x = 5"
- Input: "sin(30)" → Output: "0.5"
- Input: "sqrt(144)" → Output: "12"
- Input: "x^2 - 9" (factor) → Output: "(x-3)(x+3)"
- Input: "log(100)" → Output: "2"`,
          },
          {
            role: 'user',
            content: `Solve: ${expression}${variableContext}`,
          },
        ],
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('AI API error:', errorData);
      throw new Error(errorData.error?.message || 'AI API error');
    }

    const data = await response.json();
    let answer = data.choices?.[0]?.message?.content || '';

    // Clean up the answer
    answer = answer.trim();

    // Remove any markdown formatting
    answer = answer.replace(/\*\*/g, '').replace(/`/g, '');

    // If it starts with "Answer:" or similar, remove it
    answer = answer.replace(/^(Answer|Result|Solution):\s*/i, '');

    return NextResponse.json({
      success: true,
      answer: answer || '?',
    });
  } catch (error) {
    console.error('Error solving math:', error);
    return NextResponse.json(
      {
        error: 'Failed to solve',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
