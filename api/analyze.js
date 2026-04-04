export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { resumeText, seenJobs } = req.body;

  if (!resumeText) {
    return res.status(400).json({ error: "Missing resumeText" });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Missing OpenRouter API Key" });
  }

  try {
    const prompt = `
You are an AI career assistant.

Analyze the resume and return STRICT JSON.

RULES:
- Only JSON
- No markdown
- No explanation
- Avoid jobs already seen

Seen jobs:
${JSON.stringify(seenJobs || [])}

FORMAT:
{
  "candidateName": "string",
  "suggestedRole": "string",
  "skills": ["string"],
  "jobs": [
    {
      "title": "string",
      "company": "string",
      "score": number,
      "gap": "string",
      "strategy": "string",
      "courseTitle": "string",
      "latex": "string"
    }
  ]
}

Resume:
${resumeText}
`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://your-app.vercel.app",
        "X-Title": "ArchAI"
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat",
        messages: [
          {
            role: "system",
            content: "You are a strict JSON generator. Output ONLY valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (!data.choices || !data.choices.length) {
      return res.status(500).json({
        error: "Empty OpenRouter response",
        raw: data
      });
    }

    let text = data.choices[0].message.content;

    // Clean JSON extraction
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");

    if (start === -1 || end === -1) {
      return res.status(500).json({
        error: "Invalid JSON format from AI",
        raw: text
      });
    }

    const clean = text.substring(start, end + 1);
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);

  } catch (err) {
    console.error("Server Error:", err);
    return res.status(500).json({
      error: "Server crashed",
      details: err.message
    });
  }
}
