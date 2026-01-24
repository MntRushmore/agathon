/**
 * Hack Club AI Provider - Free tier with vision support
 * Uses https://ai.hackclub.com/proxy/v1/chat/completions for model selection
 */

export interface HackClubMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export interface HackClubCompletionOptions {
  messages: HackClubMessage[];
  stream?: boolean;
  max_tokens?: number;
  model?: string;
}

// Use the proxy endpoint for model selection and vision support
const HACKCLUB_API_URL = 'https://ai.hackclub.com/proxy/v1/chat/completions';

/**
 * Call Hack Club AI for completions (supports vision models)
 * Returns a streaming or non-streaming response
 */
export async function callHackClubAI(options: HackClubCompletionOptions): Promise<Response> {
  const apiKey = process.env.HACKCLUB_AI_API_KEY;
  const model = options.model || process.env.HACKCLUB_AI_MODEL || 'google/gemini-2.5-flash';

  if (!apiKey) {
    throw new Error('HACKCLUB_AI_API_KEY not configured');
  }

  const response = await fetch(HACKCLUB_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: options.messages,
      stream: options.stream ?? true,
      ...(options.max_tokens && { max_tokens: options.max_tokens }),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Hack Club AI error:', response.status, errorText);
    throw new Error(`Hack Club AI error: ${response.status}`);
  }

  return response;
}

/**
 * System prompt addition for text-only mode (legacy, kept for compatibility)
 */
export const TEXT_ONLY_SYSTEM_ADDITION = `
IMPORTANT: You are currently in text-only mode and cannot see any images or the student's canvas.
If the student mentions their work on a whiteboard or canvas, ask them to describe what they've written or drawn.
You can still provide helpful math tutoring and guidance, but you cannot provide visual feedback on handwritten work.
Be helpful and acknowledge that you cannot see their canvas when relevant.`;

/**
 * Create a text-only system prompt by adding the limitation notice
 */
export function createTextOnlySystemPrompt(originalSystemPrompt: string): string {
  return `${originalSystemPrompt}\n${TEXT_ONLY_SYSTEM_ADDITION}`;
}

/**
 * Transform messages to remove image content for text-only mode
 * Converts multimodal messages to text-only
 */
export function transformMessagesForTextOnly(
  messages: Array<{
    role: string;
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  }>
): HackClubMessage[] {
  return messages.map((msg) => {
    // If content is already a string, use it directly
    if (typeof msg.content === 'string') {
      return {
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      };
    }

    // If content is an array (multimodal), extract only text parts
    const textParts = msg.content
      .filter((part) => part.type === 'text' && part.text)
      .map((part) => part.text!)
      .join('\n');

    // Check if there was an image that we're ignoring
    const hadImage = msg.content.some((part) => part.type === 'image_url');

    let content = textParts;
    if (hadImage && msg.role === 'user') {
      content = `${textParts}\n\n(Note: I shared an image of my whiteboard, but I understand you can't see images in this mode.)`;
    }

    return {
      role: msg.role as 'user' | 'assistant' | 'system',
      content: content || 'I shared something on my whiteboard.',
    };
  });
}

/**
 * Build a complete Hack Club AI request with vision support
 * Now passes through images instead of stripping them
 */
export function buildHackClubRequest(
  systemPrompt: string,
  userMessages: Array<{
    role: string;
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  }>,
  stream = true
): HackClubCompletionOptions {
  // Pass through messages with images intact for vision models
  const messages: HackClubMessage[] = userMessages.map((msg) => ({
    role: msg.role as 'user' | 'assistant' | 'system',
    content: msg.content,
  }));

  return {
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    stream,
  };
}

/**
 * Build a text-only request (strips images)
 */
export function buildHackClubTextOnlyRequest(
  systemPrompt: string,
  userMessages: Array<{
    role: string;
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  }>,
  stream = true
): HackClubCompletionOptions {
  const textOnlySystemPrompt = createTextOnlySystemPrompt(systemPrompt);
  const textOnlyMessages = transformMessagesForTextOnly(userMessages);

  return {
    messages: [
      { role: 'system', content: textOnlySystemPrompt },
      ...textOnlyMessages,
    ],
    stream,
  };
}
