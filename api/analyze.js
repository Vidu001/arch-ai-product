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
    const systemPrompt = `
You are an elite career strategist AI.

Analyze the resume and generate HIGH-QUALITY structured job matches.

IMPORTANT RULES:
- No generic answers
- No placeholders
- Be specific to skills and roles
- Return ONLY valid JSON

Avoid repeating previous jobs: ${JSON.stringify(seenJobs || [])}

Return EXACT format:

{
  "candidateName": "string",
  "suggestedRole": "string",
  "skills": ["string"],
  "jobs": [
    {
      "title": "string",
      "company": "string",
      "score": number,

      "skills_missing": ["string"],
      "skills_can_add": ["string"],

      "gap": "comma separated important missing skills",

      "strategy": "2-3 line sharp career advice",

      "courses": [
        {
          "title": "YouTube course title",
          "query": "search query"
        }
      ],

      "latex": "Improved resume bullet in LaTeX format"
    }
  ]
}
`;

    // ✅ FINAL PROMPT (THIS WAS MISSING)
    const finalPrompt = `
${systemPrompt}

Resume Content:
${resumeText}
`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://arch-ai-product.vercel.app", // optional
        "X-Title": "ArchAI"
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat",
        messages: [
          {
            role: "system",
            content: "You output ONLY valid JSON. No markdown, no explanation."
          },
          {
            role: "user",
            content: finalPrompt
          }
        ],
        temperature: 0.7
      })
    });

    const data = await response.json();

    // ✅ DEBUG LOG (VERY IMPORTANT)
    console.log("RAW OPENROUTER RESPONSE:", JSON.stringify(data));

    if (!data.choices || !data.choices.length) {
      return res.status(500).json({
        error: "Empty OpenRouter response",
        raw: data
      });
    }

    let text = data.choices[0].message.content;

    // ✅ CLEAN JSON EXTRACTION
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");

    if (start === -1 || end === -1) {
      return res.status(500).json({
        error: "Invalid JSON format from AI",
        raw: text
      });
    }

    const clean = text.substring(start, end + 1);

    let parsed;

    try {
      parsed = JSON.parse(clean);
    } catch (parseError) {
      return res.status(500).json({
        error: "JSON parsing failed",
        raw: clean
      });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    console.error("Server Error:", err);
    return res.status(500).json({
      error: "Server crashed",
      details: err.message
    });
  }
}
