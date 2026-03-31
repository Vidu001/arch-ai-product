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

Based on this resume, suggest EXACTLY 3 NEW job roles.

STRICT RULES:
- Do NOT repeat: ${seenJobs.join(", ")}
- Be realistic roles (Google, Amazon, etc.)
- Return STRICT JSON ONLY
- No markdown, no explanation

FORMAT:
{
  "jobs": [
    {
      "title": "Job title",
      "company": "Company name",
      "score": 85,
      "gap": "Biggest missing skill",
      "strategy": "2 short sentences",
      "courseTitle": "Best course name",
      "latex": "\\\\cventry{2022--Present}{Role}{Company}{}{}{\\\\begin{itemize}\\\\item Improved bullet\\\\end{itemize}}"
    }
  ]
}

Resume:
${resumeText.slice(0, 3500)}
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 800
          }
        })
      }
    );

    const data = await response.json();

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map(p => p.text || "")
        .join("") || "";

    if (!text) {
      return res.status(500).json({
        error: "Empty Gemini response",
        raw: data
      });
    }

    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      return res.status(500).json({
        error: "Invalid AI response",
        raw: text
      });
    }

    let parsed;

    try {
      parsed = JSON.parse(match[0]);
    } catch (e) {
      return res.status(500).json({
        error: "JSON parse failed",
        raw: text
      });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    console.error("API ERROR:", err);

    return res.status(500).json({
      error: "Failed",
      details: err.message
    });
  }
}
