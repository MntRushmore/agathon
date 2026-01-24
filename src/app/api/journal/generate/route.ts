import { NextRequest, NextResponse } from 'next/server';
import { callHackClubAI } from '@/lib/ai/hackclub';

export const runtime = 'edge';

const PROMPTS = {
  video: `You are an educational content creator. Based on the user's notes/topic, create a detailed video script that explains the concept using the Feynman technique (explain it simply as if teaching a child).

Format your response as:
## Video Script: [Topic]

### Introduction (30 seconds)
[Hook and overview]

### Main Content (3-5 minutes)
[Break down the concept step by step with simple analogies]

### Key Takeaways (30 seconds)
[Summarize the main points]

### Practice Question
[One question to test understanding]

Be engaging, use simple language, and include analogies.`,

  practice: `You are an expert educator. Based on the user's notes/topic, generate practice problems to help them learn.

Format your response as:
## Practice Problems: [Topic]

### Easy (2 problems)
1. [Problem]
   - Hint: [Small hint]

2. [Problem]
   - Hint: [Small hint]

### Medium (2 problems)
3. [Problem]
   - Hint: [Small hint]

4. [Problem]
   - Hint: [Small hint]

### Challenge (1 problem)
5. [Problem]
   - Hint: [Small hint]

---
## Answer Key
[Provide detailed solutions for each problem]`,

  flashcards: `You are a study assistant. Based on the user's notes/topic, create flashcards for effective studying.

Format your response as:
## Flashcards: [Topic]

### Card 1
**Front:** [Question or term]
**Back:** [Answer or definition]

### Card 2
**Front:** [Question or term]
**Back:** [Answer or definition]

[Continue for 8-10 cards covering key concepts]

---
## Study Tips
[2-3 tips for memorizing these concepts]`,

  image: `You are a visual learning assistant. Based on the user's notes/topic, describe a detailed educational diagram or illustration that would help them understand the concept.

Format your response as:
## Visual Diagram: [Topic]

### Description
[Detailed description of what the diagram should show]

### Key Elements
1. [Element 1 and what it represents]
2. [Element 2 and what it represents]
3. [Element 3 and what it represents]

### How to Draw It
[Step-by-step instructions for creating this diagram]

### Why This Helps
[Explain why visualizing it this way aids understanding]`,

  notes: `You are an expert educational content creator. Create beautifully structured study notes using the Feynman technique (explain simply).

CRITICAL: For ALL mathematical expressions, equations, and formulas, wrap them in dollar signs for LaTeX rendering:
- Inline math: $a + b = c$ renders as proper math
- Variables: $x$, $y$, $n$ 
- Equations: $7 + 3 = 10$, $a + b = b + a$
- Complex: $(a + b) + c = a + (b + c)$

Example of correct formatting:
"The **Commutative Property** states that $a + b = b + a$. For example, $7 + 3 = 3 + 7 = 10$."

Format your response with clear markdown:

# [Topic Title]

[Brief introduction. Use $...$ for any math.]

## [Section Name]

[Clear explanation with $math$ inline.]

- **[Term]**: [explanation with $equations$ as needed]
- **[Term]**: [explanation]

## Examples

### Example 1: [Title]
[Problem using $math notation$]
[Solution with $step = by = step$ equations]

## Key Takeaways

- [Point with $math$ if needed]
- [Point]

FORMATTING RULES:
- ALWAYS use $...$ for ANY numbers in equations or math context (e.g., write $4 + 3 = 7$ not 4 + 3 = 7)
- Use # for title, ## for sections, ### for subsections
- Use **bold** for key terms
- Use - for bullet points, 1. 2. 3. for numbered lists
- Keep explanations simple`,
};

export async function POST(req: NextRequest) {
  try {
    const { type, content, topic } = await req.json();

    if (!type || !PROMPTS[type as keyof typeof PROMPTS]) {
      return NextResponse.json({ error: 'Invalid generation type' }, { status: 400 });
    }

    const systemPrompt = PROMPTS[type as keyof typeof PROMPTS];
    const userContent = content || topic || 'General study topic';

    const response = await callHackClubAI({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Please generate content based on: ${userContent}` },
      ],
      stream: false,
      model: 'google/gemini-2.5-flash',
    });

    const data = await response.json();
    const generatedContent = data.choices?.[0]?.message?.content || 'Unable to generate content';

    return NextResponse.json({ content: generatedContent });
  } catch (error) {
    console.error('Journal generate error:', error);
    return NextResponse.json(
      { error: 'Failed to generate content' },
      { status: 500 }
    );
  }
}
