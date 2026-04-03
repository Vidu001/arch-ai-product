export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { resumeText, seenJobs = [] } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) return res.status(500).json({ error: "API Key missing in Vercel settings." });

    // Based on your successful CURL test:
    // The specific model name recognized by your Google Cloud Project is 'gemini-flash-latest'
    const MODEL_NAME = "gemini-flash-latest"; 
    const API_VERSION = "v1beta";

    const url = `https://generativelanguage.googleapis.com/${API_VERSION}/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    const prompt = `Return a JSON object with 3 job suggestions for this resume: ${resumeText.slice(0, 2500)}. 
    Exclude these jobs already seen: ${seenJobs.join(", ")}. 
    Format: {"jobs": [{"title": "...", "company": "...", "score": 90, "gap": "...", "strategy": "...", "courseTitle": "...", "latex": "..."}]}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
          responseMimeType: "application/json",
          temperature: 0.7 
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: "Google_API_Error", 
        message: data.error?.message || "Unknown error from Google API",
        debug_model: MODEL_NAME
      });
    }

    // Extracting the text response
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!resultText) {
      throw new Error("No text content returned from Gemini. Check API quotas or safety filters.");
    }

    // Parse the JSON returned by the model
    const parsedData = JSON.parse(resultText);

    return res.status(200).json(parsedData);

  } catch (err) {
    console.error("Analysis Error:", err);
    return res.status(500).json({ 
      error: "Server Error", 
      details: err.message 
    });
  }
}
