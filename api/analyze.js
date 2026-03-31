export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { resumeText, seenJobs = [] } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) return res.status(500).json({ error: "API Key missing in Vercel settings" });

    // THE ABSOLUTE FIX: 
    // 'gemini-pro' is the universal model name that works on ALL keys.
    const modelName = "gemini-pro"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const prompt = `
      You are a JSON generator. Analyze this resume: ${resumeText.slice(0, 2500)}
      Suggest 3 unique jobs. Exclude these: ${seenJobs.join(", ")}
      
      Return ONLY a JSON object. No intro. No markdown.
      Structure:
      {
        "jobs": [
          {
            "title": "Job Name",
            "company": "Company Name",
            "score": 90,
            "gap": "Missing Skill",
            "strategy": "How to get it",
            "courseTitle": "Course Name",
            "latex": "LaTeX code"
          }
        ]
      }
    `;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Google API Rejected Request",
        message: data.error?.message,
        tip: "If this is 404, check your Google Cloud Project to see if Generative Language API is enabled for project: Career-arch-ai"
      });
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    // Robust JSON Extraction (removes markdown backticks and accidental text)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: "AI failed to format JSON", raw: rawText });
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return res.status(200).json(parsed);
    } catch (e) {
      return res.status(500).json({ error: "Final Parse Failed", details: e.message });
    }

  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error", details: err.message });
  }
}
