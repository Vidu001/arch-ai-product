export default async function handler(req, res) {
  // 1. CORS Headers (Crucial for Vercel)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { resumeText, seenJobs = [] } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Missing API Key. Check Vercel Environment Variables." });
    }

    /**
     * FOR THE FREE TIER:
     * Use version 'v1beta' and model 'gemini-1.5-flash'. 
     * This is the most reliable path for free keys.
     */
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const prompt = `
      Act as a Career Architect. Analyze this resume: ${resumeText.slice(0, 3000)}
      Suggest 3 high-revenue roles. Skip these: ${seenJobs.join(", ")}
      
      IMPORTANT: Return ONLY a valid JSON object. Do not include markdown code blocks.
      Structure:
      {
        "jobs": [
          {
            "title": "Role Name",
            "company": "Target Company",
            "score": 92,
            "gap": "Specific Skill",
            "strategy": "Actionable advice",
            "courseTitle": "Course Link Name",
            "latex": "Resume Snippet"
          }
        ]
      }
    `;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          // Force JSON output mode (Free tier feature)
          responseMimeType: "application/json"
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Google API Rejection",
        message: data.error?.message,
        tip: "Go to Cloud Console, search 'Generative Language API', and click ENABLE."
      });
    }

    // Extracting text (Gemini returns JSON inside the text part when responseMimeType is JSON)
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!rawText) {
      return res.status(500).json({ error: "AI returned empty content." });
    }

    return res.status(200).json(JSON.parse(rawText));

  } catch (err) {
    return res.status(500).json({ error: "Server Error", details: err.message });
  }
}
