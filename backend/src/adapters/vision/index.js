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

export async function compareCollectionEvidence(
  beforeBufferOrUrl,
  beforeMime = 'image/jpeg',
  afterBuffer,
  afterMime = 'image/jpeg'
) {
  if (ENV.VISION_PROVIDER === 'gemini' && ENV.GEMINI_API_KEY) {
    try {
      let beforeBuffer = beforeBufferOrUrl;
      let resolvedBeforeMime = beforeMime;

      if (typeof beforeBufferOrUrl === 'string' && beforeBufferOrUrl.startsWith('http')) {
        const fetchRes = await fetch(beforeBufferOrUrl);
        if (fetchRes.ok) {
          const arrayBuf = await fetchRes.arrayBuffer();
          beforeBuffer = Buffer.from(arrayBuf);
          resolvedBeforeMime = fetchRes.headers.get('content-type') || beforeMime;
        } else {
          return {
            status: 'UNAVAILABLE',
            assessment: 'UNABLE_TO_ASSESS',
            confidence: null,
            shortReason: 'Could not retrieve original incident photo for comparison. Manual operator inspection required.',
            provider: 'gemini',
          };
        }
      }

      if (Buffer.isBuffer(beforeBuffer) && Buffer.isBuffer(afterBuffer)) {
        return await compareEvidenceWithGemini(
          beforeBuffer,
          resolvedBeforeMime,
          afterBuffer,
          afterMime
        );
      }
    } catch (err) {
      console.warn('[Vision] Gemini compare error:', err.message);
    }
  }

  // Honest fallback: never fabricate AI results
  return {
    status: 'UNAVAILABLE',
    assessment: 'UNABLE_TO_ASSESS',
    confidence: null,
    shortReason: 'AI vision provider unavailable or not configured. Manual operator inspection required.',
    provider: 'none',
  };
}
