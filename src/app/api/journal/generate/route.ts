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

  notes: `You are an expert educational content creator teaching with the Feynman technique. Create comprehensive, beautifully structured study notes that explain concepts simply.

Format your response with clear markdown:

# [Topic] Fundamentals

[Introduction paragraph. Use $...$ for inline math like $a + b = b + a$ for commutative property and $(a + b) + c = a + (b + c)$ for associative property.]

## [Subtopic 1]

[Explain clearly with simple language. Include math equations using $...$ notation when relevant.]

Key strategies include:

- **[Strategy name]**: [clear explanation]
- **[Strategy name]**: [clear explanation]  
- **[Strategy name]**: [clear explanation]

## [Subtopic 2]

[Continue with another aspect of the topic]

1. [Step or point]
2. [Step or point]
3. [Step or point]

## Examples

[Provide clear worked examples]

## Key Takeaways

- [Main point 1]
- [Main point 2]
- [Main point 3]

IMPORTANT FORMATTING RULES:
- Use # for main title, ## for sections, ### for subsections
- Use $...$ for ALL math expressions (e.g., $4 + 4 = 8$, $a + b$)
- Use **bold** for key terms
- Use - for bullet points
- Use 1. 2. 3. for numbered lists
- Keep explanations simple like explaining to a child
- Be thorough but concise`,
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
