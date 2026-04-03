export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { resumeText, seenJobs = [] } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) return res.status(500).json({ error: "API Key missing in Vercel settings." });

    // This is the most stable model name and version for new Google Cloud Projects
    const MODEL_NAME = "gemini-1.5-flash"; 
    const API_VERSION = "v1beta";

    // Standard URL format: the "models/" prefix is REQUIRED inside the path
    const url = `https://generativelanguage.googleapis.com/${API_VERSION}/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    const prompt = `Return a JSON object with 3 job suggestions for this resume: ${resumeText.slice(0, 2000)}. 
    Exclude: ${seenJobs.join(", ")}. 
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
      // If this fails, it's definitely a Key restriction issue
      return res.status(response.status).json({ 
        error: "Google_API_Error", 
        message: data.error?.message,
        tip: "Go to Google Cloud > Credentials > Click your API Key > Set 'API Restrictions' to 'None' or add 'Generative Language API'."
      });
    }

    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) throw new Error("No content returned from Gemini");

    return res.status(200).json(JSON.parse(resultText));

  } catch (err) {
    return res.status(500).json({ error: "Server Error", details: err.message });
  }
}
