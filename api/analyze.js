export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { resumeText, seenJobs = [] } = req.body || {};

    if (!resumeText || resumeText.length < 50) {
      return res.status(400).json({ error: "Invalid resumeText" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY" });
    }

    const prompt = `
You are an expert career coach.

Suggest EXACTLY 3 NEW job roles.

DO NOT repeat: ${seenJobs.join(", ")}

Return STRICT JSON ONLY. No explanation.

FORMAT:
{
  "jobs": [
    {
      "title": "",
      "company": "",
      "score": 85,
      "gap": "",
      "strategy": "",
      "courseTitle": "",
      "latex": ""
    }
  ]
}

Resume:
${resumeText.slice(0, 3000)}
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
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
            temperature: 0.6,
            maxOutputTokens: 700
          }
        })
      }
    );

    const data = await response.json();

    // DEBUG LOG
    console.log("Gemini raw:", JSON.stringify(data));

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
        error: "Invalid AI format",
        raw: text
      });
    }

    let parsed;

    try {
      parsed = JSON.parse(match[0]);
    } catch {
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
