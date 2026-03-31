export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { resumeText, seenJobs = [] } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY is not set in Vercel" });

    // THE FIX: Use v1beta with gemini-pro (High compatibility) or gemini-1.5-flash-latest
    // We will try the most stable one first
    const modelName = "gemini-1.5-flash-latest"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const prompt = `
      Return ONLY a JSON object. No intro text. No markdown backticks.
      
      Suggest 3 career roles for this resume: ${resumeText.slice(0, 3000)}
      Do not repeat: ${seenJobs.join(", ")}

      JSON structure:
      {
        "jobs": [
          {
            "title": "String",
            "company": "String",
            "score": 95,
            "gap": "String",
            "strategy": "String",
            "courseTitle": "String",
            "latex": "String"
          }
        ]
      }
    `;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      // If 1.5-flash-latest fails, it's likely a regional naming issue. 
      // This error block helps us see exactly what your specific key wants.
      return res.status(response.status).json({
        error: "Model Name Error",
        hint: "Try changing modelName to 'gemini-pro' in the code if this persists.",
        details: data.error?.message
      });
    }

    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // CLEANUP: AI often wraps JSON in ```json ... ``` which breaks JSON.parse
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    try {
      const parsed = JSON.parse(cleanJson);
      return res.status(200).json(parsed);
    } catch (parseErr) {
      return res.status(500).json({ error: "AI returned invalid JSON", raw: text });
    }

  } catch (err) {
    return res.status(500).json({ error: "Server Crash", details: err.message });
  }
}
