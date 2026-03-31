export default async function handler(req, res) {
  try {
    const { resumeText } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    // 1. Use the STABLE v1 API instead of v1beta
    // 2. Use the exact production model name
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Return a JSON object with 3 job recommendations for this resume: ${resumeText.slice(0, 2000)}. 
            Format: {"jobs": [{"title": "...", "company": "...", "score": 90, "gap": "...", "strategy": "...", "courseTitle": "...", "latex": "..."}]}`
          }]
        }],
        // Stable v1 does not use the 'responseSchema' field in the same way as Beta,
        // so we use a clear prompt and JSON.parse.
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: "API Check Failed", 
        details: data.error?.message || "Check if Generative Language API is enabled in Google Cloud Console." 
      });
    }

    // Extracting text from stable v1 response
    const rawText = data.candidates[0].content.parts[0].text;
    
    // Clean up potential markdown formatting (```json ... ```)
    const jsonString = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(jsonString);

    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: "Execution Error", message: err.message });
  }
}
