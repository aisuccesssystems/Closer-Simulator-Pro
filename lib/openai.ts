import OpenAI from 'openai';

const openaiKey = process.env.OPENAI_API_KEY;

if (!openaiKey) {
  throw new Error('OPENAI_API_KEY is not set in environment variables.');
}

export const openai = new OpenAI({ apiKey: openaiKey });
