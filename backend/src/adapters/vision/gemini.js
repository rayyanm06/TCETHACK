import { ENV } from '../../config/env.js';

const SYSTEM_PROMPT = `You classify roadside waste photos for a municipal collection planning system.
Respond ONLY with JSON matching this structure:
{
  "category": "ORGANIC" | "PLASTIC" | "PAPER" | "GLASS" | "METAL" | "E_WASTE" | "MIXED" | "UNKNOWN",
  "shortReason": "one plain sentence under 140 characters explaining what is visible"
}
Categories:
- ORGANIC: food scraps, wet waste, leaves, compostable matter.
- PLASTIC: bottles, wrappers, plastic bags, containers.
- PAPER: cardboard boxes, newspapers, paper waste.
- GLASS: glass bottles, jars, shards.
- METAL: cans, tins, scrap metal parts.
- E_WASTE: electronic cables, batteries, broken appliances, circuit boards.
- MIXED: multiple distinct waste types mixed together in a loose pile.
- UNKNOWN: image not clear, or no waste visible.`;

export async function classifyWithGemini(fileBuffer, mimeType = 'image/jpeg') {
  if (!ENV.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const base64Data = fileBuffer.toString('base64');
  const model = ENV.VISION_MODEL || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${ENV.GEMINI_API_KEY}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: SYSTEM_PROMPT },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      response_mime_type: 'application/json',
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Gemini HTTP error ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error('Empty Gemini response');
    }

    const parsed = JSON.parse(candidateText);
    const validCategories = new Set([
      'ORGANIC',
      'PLASTIC',
      'PAPER',
      'GLASS',
      'METAL',
      'E_WASTE',
      'MIXED',
      'UNKNOWN',
    ]);

    const category = validCategories.has(parsed.category) ? parsed.category : 'UNKNOWN';
    const shortReason = typeof parsed.shortReason === 'string' ? parsed.shortReason.slice(0, 140) : '';

    return {
      status: 'OK',
      category,
      shortReason,
      provider: 'gemini',
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}
