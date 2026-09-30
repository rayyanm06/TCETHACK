import { ENV } from '../../config/env.js';

export async function classifyWithAnthropic(fileBuffer, mimeType = 'image/jpeg') {
  if (!ENV.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const base64Data = fileBuffer.toString('base64');
  const url = 'https://api.anthropic.com/v1/messages';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': ENV.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: base64Data,
                },
              },
              {
                type: 'text',
                text: 'Classify this roadside waste photo for municipal collection. Return JSON only: {"category": "ORGANIC"|"PLASTIC"|"PAPER"|"GLASS"|"METAL"|"E_WASTE"|"MIXED"|"UNKNOWN", "shortReason": "one plain sentence under 140 chars"}',
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Anthropic HTTP error ${res.status}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text;
    const match = text?.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Could not parse JSON from Anthropic response');

    const parsed = JSON.parse(match[0]);
    return {
      status: 'OK',
      category: parsed.category || 'UNKNOWN',
      shortReason: (parsed.shortReason || '').slice(0, 140),
      provider: 'anthropic',
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}
