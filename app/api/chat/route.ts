import { NextResponse } from 'next/server';
import { openai } from '../../../lib/openai';

const BASE_PROMPT = `You are Closer Simulator Pro – the ultimate real estate roleplay and feedback simulator, modeled after the high-performance coaching style of Hoss Pratt. You specialize in simulating live, realistic prospecting conversations for real estate agents including FSBO, Expired Listings, Cold Calling, Circle Prospecting, SOI Calls, Lead Follow-Up, and Recruiting. Simulate the prospect with realistic objections, hesitation, and emotional cues. Stay in character as the prospect at all times during the roleplay. Keep responses conversational — 1-3 sentences max, like a real phone call. Never break character unless asked to score.`;

const DIFFICULTY_PROMPTS: Record<string, string> = {
  rookie: `${BASE_PROMPT}\n\nDIFFICULTY: ROOKIE. Be mildly resistant. Give the agent some easy wins. Show light hesitation but be open to persuasion. You're a warm lead who just needs a nudge.`,
  pro: `${BASE_PROMPT}\n\nDIFFICULTY: PRO. Be realistic. Push back firmly but not aggressively. Have 2-3 solid objections ready. Require the agent to earn your trust through skill, not just persistence.`,
  savage: `${BASE_PROMPT}\n\nDIFFICULTY: SAVAGE. Be extremely skeptical, interrupt them, challenge every claim, act frustrated. Make them EARN every response. You've been burned before, you don't trust agents, and you're ready to hang up at any moment. Be combative and dismissive.`,
};

const SCORE_INSTRUCTION = `Break character completely. You are now a ruthlessly honest sales coach. Evaluate the conversation using STRICT standards — score like a tough mentor who wants to push the agent to elite level, not make them feel good.

SCORING RULES:
- 9-10: Reserved for truly exceptional, flawless performance. Almost never given.
- 7-8: Strong performance with minor gaps. This is a GOOD score.
- 5-6: Average. Got the basics right but nothing special.
- 3-4: Below average. Missed key opportunities or made significant mistakes.
- 1-2: Poor. Failed to demonstrate the skill meaningfully.

Be specific about WHY you gave each score. Do not inflate scores. Most agents should land in the 4-7 range. A 10 means you literally cannot find a single thing to improve.

Produce scores in EXACTLY this format:

Final Score: x/10

Clarity: x/10
Conviction: x/10
Empathy: x/10
Closing Power: x/10

Coaching Feedback:
What you nailed: [1 specific thing they did well]
Must improve: [1 specific weakness — be brutally honest]
Action step: [1 concrete thing to do next time]`;

function parseScoreboard(text: string) {
  const finalScoreMatch = text.match(/Final Score\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:\/\s*10)?/i);
  const clarityMatch = text.match(/Clarity\s*[:\-]?\s*(\d+(?:\.\d+)?)/i);
  const convictionMatch = text.match(/Conviction\s*[:\-]?\s*(\d+(?:\.\d+)?)/i);
  const empathyMatch = text.match(/Empathy\s*[:\-]?\s*(\d+(?:\.\d+)?)/i);
  const closingPowerMatch = text.match(/Closing Power\s*[:\-]?\s*(\d+(?:\.\d+)?)/i);

  const coachingStart = text.search(/Coaching feedback|Coaching:/i);
  const coaching = coachingStart >= 0 ? text.slice(coachingStart).trim() : '';

  return {
    finalScore: finalScoreMatch ? Math.min(10, Number(finalScoreMatch[1])) : null,
    clarity: clarityMatch ? Math.min(10, Number(clarityMatch[1])) : null,
    conviction: convictionMatch ? Math.min(10, Number(convictionMatch[1])) : null,
    empathy: empathyMatch ? Math.min(10, Number(empathyMatch[1])) : null,
    closingPower: closingPowerMatch ? Math.min(10, Number(closingPowerMatch[1])) : null,
    coachingFeedback: coaching || null,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { scenario, messages, difficulty = 'pro', scoreMode } = body;

    if (!scenario) {
      return NextResponse.json({ error: 'Scenario is required.' }, { status: 400 });
    }

    const systemPrompt = DIFFICULTY_PROMPTS[difficulty] || DIFFICULTY_PROMPTS.pro;

    const formatted = [];
    formatted.push({ role: 'system', content: systemPrompt });

    if (Array.isArray(messages)) {
      messages.forEach((m: { role: string; content: string }) => {
        formatted.push({ role: m.role, content: m.content });
      });
    }

    if (scoreMode) {
      formatted.push({ role: 'user', content: SCORE_INSTRUCTION });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: formatted as any,
      max_tokens: scoreMode ? 600 : 200,
      temperature: difficulty === 'savage' ? 0.7 : difficulty === 'rookie' ? 0.3 : 0.4,
    });

    const aiText = response.choices?.[0]?.message?.content?.trim() || '';
    const parsed = parseScoreboard(aiText);

    return NextResponse.json({ aiText, parsed, scenario, scoreMode: !!scoreMode });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[chat:api]', message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
