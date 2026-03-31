export default async function handler(req, res) {
  try {
    const { resumeText, seenJobs } = req.body;

    const prompt = `
Return ONLY JSON:

{
  "summary": "1 line",
  "jobs": [
    {
      "id": 1,
      "title": "role",
      "company": "company",
      "score": 80,
      "gap": "skill",
      "strategy": "2 sentences",
      "keywords": ["a","b"],
      "latex": "\\\\item bullet",
      "courseTitle": "course",
      "courseProvider": "Coursera"
    }
  ]
}

Avoid repeating:
${(seenJobs || []).join(", ")}

Resume:
${resumeText.slice(0, 5000)}
`;

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await r.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)[0]);

    res.status(200).json(parsed);

  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
}
