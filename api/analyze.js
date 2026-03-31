export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { resumeText, seenJobs = [] } = req.body || {};

    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({ error: "Invalid or empty resumeText" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY" });
    }

    const prompt = `
You are an expert career coach.

Based on the resume below, suggest EXACTLY 3 high-quality job roles.

IMPORTANT RULES:
- Do NOT repeat any of these jobs: ${seenJobs.join(", ")}
- Be realistic (top companies)
- Output STRICT JSON ONLY
- No markdown, no explanation, no extra text

FORMAT:
{
  "jobs": [
    {
      "title": "Job title",
      "company": "Company name",
      "score": 85,
      "gap": "Biggest missing skill",
      "strategy": "2 concise sentences on how to pivot",
      "courseTitle": "Best course to bridge gap",
      "latex": "\\\\cventry{2022--Present}{Title}{Company}{}{}{\\\\begin{itemize}\\\\item Improved bullet\\\\end{itemize}}"
    }
  ]
}

Resume:
${resumeText.slice(0, 4000)}
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 900
          }
        })
      }
    );

    const data = await response.json();

    // 🔍 Extract text safely
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map(p => p.text || "")
        .join("") || "";

    if (!text) {
      return res.status(500).json({
        error: "Empty response from Gemini",
        raw: data
      });
    }

    // 🧠 Extract JSON from response
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      return res.status(500).json({
        error: "Invalid AI response format",
        raw: text
      });
    }

    let parsed;

    try {
      parsed = JSON.parse(match[0]);
    } catch (e) {
      return res.status(500).json({
        error: "JSON parsing failed",
        raw: text
      });
    }

    if (!parsed.jobs || !Array.isArray(parsed.jobs)) {
      return res.status(500).json({
        error: "Malformed jobs response",
        raw: parsed
      });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    console.error("🔥 API ERROR:", err);

    return res.status(500).json({
      error: "Failed",
      details: err.message
    });
  }
}
