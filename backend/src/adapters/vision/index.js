import { ENV } from '../../config/env.js';
import { classifyWithGemini } from './gemini.js';
import { classifyWithAnthropic } from './anthropic.js';

export async function classifyImage(fileBuffer, mimeType = 'image/jpeg') {
  if (ENV.VISION_PROVIDER === 'gemini' && ENV.GEMINI_API_KEY) {
    try {
      return await classifyWithGemini(fileBuffer, mimeType);
    } catch (err) {
      console.warn('[Vision] Gemini error, returning UNAVAILABLE:', err.message);
    }
  } else if (ENV.VISION_PROVIDER === 'anthropic' && ENV.ANTHROPIC_API_KEY) {
    try {
      return await classifyWithAnthropic(fileBuffer, mimeType);
    } catch (err) {
      console.warn('[Vision] Anthropic error, returning UNAVAILABLE:', err.message);
    }
  }

  // Fallback if neither API configured or if call failed
  return {
    status: 'UNAVAILABLE',
    category: 'UNKNOWN',
    shortReason: null,
    provider: 'none',
  };
}
