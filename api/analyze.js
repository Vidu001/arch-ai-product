export default async function handler(req, res) {
  try {
    const { resumeText, seenJobs = [] } = req.body || {};

    if (!resumeText) {
      return res.status(400).json({ error: "Missing resumeText" });
    }

    const prompt = `
You are an expert career coach.

Based on this resume, suggest 3 NEW job roles (avoid repeating these: ${seenJobs.join(", ")}).

Return ONLY JSON:

{
  "jobs": [
    {
      "title": "",
      "company": "",
      "score": 0,
      "gap": "",
      "strategy": "",
      "courseTitle": "",
      "latex": ""
    }
  ]
}

Resume:
${resumeText.slice(0, 4000)}
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
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
          ]
        })
      }
    );

    const data = await response.json();

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      return res.status(500).json({ error: "Invalid AI response", raw: text });
    }

    const parsed = JSON.parse(match[0]);

    return res.status(200).json(parsed);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed", details: err.message });
  }
}
