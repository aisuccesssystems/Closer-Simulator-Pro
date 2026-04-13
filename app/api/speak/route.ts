import { openai } from '../../../lib/openai';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'text is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'onyx',
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());

    return new Response(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(buffer.length),
      },
    });
  } catch (err) {
    console.error('[speak:api]', err);
    return new Response(JSON.stringify({ error: 'TTS request failed.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
