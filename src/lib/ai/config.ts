/**
 * Centralized AI model configuration.
 * All model defaults and env var references live here.
 */

/** Default model for all Hack Club AI calls (chat, vision, free-tier generation) */
export const HACKCLUB_MODEL = process.env.HACKCLUB_AI_MODEL || 'google/gemini-2.5-flash';

/** Premium image generation model via OpenRouter */
export const OPENROUTER_IMAGE_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-3-pro-image-preview';

/** Fast/cheap model for help-needed classification */
export const HELP_DETECTION_MODEL = 'openai/gpt-4.1-mini';
