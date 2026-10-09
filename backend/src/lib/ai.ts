// AI-assisted newsletter drafting, used by the "AI Assist" button on the admin
// Newsletter compose panel. Calls Anthropic's Messages API directly over fetch (Node
// 18+ has fetch built in) so no new npm dependency is required.
//
// Requires ANTHROPIC_API_KEY in the backend .env. Until it's set, generateNewsletter()
// returns null instead of throwing — mirrors lib/mailer.ts's "SMTP not configured"
// fallback pattern — so the rest of the app keeps working and the route can return a
// clear "not configured" error instead of a crash.

const ANTHROPIC_MODEL = 'claude-sonnet-5';

export interface GeneratedNewsletter {
  subject: string;
  html: string;
}

const SYSTEM_PROMPT = `You write marketing and news emails for RXL Logistics, a Jamaica-based freight-forwarding company that ships packages/pallets/barrels from the US (Florida) to Jamaica for customers, plus runs a small online store.

Given a short topic or instruction from the admin, write one email. Return ONLY a JSON object (no markdown fences, no commentary) with exactly these two keys:
{
  "subject": "a short, compelling email subject line (under 60 characters)",
  "html": "a complete, self-contained HTML email body"
}

Rules for "html":
- Inline CSS only (style="..." attributes) — no <style> tags, no external stylesheets, no <html>/<head>/<body> wrapper. Just the content markup (divs, headings, paragraphs, etc.) as if it will be dropped straight into an email body.
- Wrap everything in one outer <div style="font-family:-apple-system,Arial,sans-serif;max-width:600px;margin:0 auto;">.
- Use a clear heading, short readable paragraphs, and where relevant a bold call-to-action line.
- Sign off as "— RXL Logistics".
- Keep it genuinely useful and specific to what the admin asked for — don't pad with generic filler.
- Do not invent specific prices, dates, or promo codes unless the admin's prompt supplied them.`;

export async function generateNewsletter(prompt: string): Promise<GeneratedNewsletter | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`AI request failed (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data: any = await res.json();
  const raw: string = data?.content?.[0]?.text || '';

  // Strip ```json fences if the model added them despite instructions, then parse.
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('AI returned an unexpected response format');
  }

  if (!parsed?.subject || !parsed?.html) {
    throw new Error('AI response was missing subject or html');
  }

  return { subject: String(parsed.subject), html: String(parsed.html) };
}
