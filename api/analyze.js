export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { resumeText, seenJobs = [] } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) return res.status(500).json({ error: "API Key missing in Vercel." });

    // List of model identifiers to try in order of preference
    const modelCandidates = [
      "gemini-1.5-flash",
      "gemini-1.5-flash-latest",
      "gemini-pro",
      "models/gemini-1.5-flash",
      "models/gemini-pro"
    ];

    let successResponse = null;
    let lastError = null;

    const prompt = `Analyze this resume and return a JSON object with 3 job leads for 2026: ${resumeText.slice(0, 2000)}. 
    Exclude these roles: ${seenJobs.join(", ")}. 
    Required JSON structure: {"jobs": [{"title": "...", "company": "...", "score": 95, "gap": "...", "strategy": "...", "courseTitle": "...", "latex": "..."}]}`;

    // Brute force loop through models until one works
    for (const modelName of modelCandidates) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName.replace('models/', '')}:generateContent?key=${apiKey}`;
        
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });

        const data = await response.json();

        if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
          successResponse = JSON.parse(data.candidates[0].content.parts[0].text);
          break; // Stop loop if we get data
        } else {
          lastError = data.error?.message || "Model not responsive";
          console.log(`Failed with ${modelName}: ${lastError}`);
        }
      } catch (e) {
        lastError = e.message;
      }
    }

    if (successResponse) {
      return res.status(200).json(successResponse);
    }

    // If all models fail
    return res.status(500).json({ 
      error: "Model Negotiation Failed", 
      details: lastError,
      suggestion: "Since your API is ENABLED, please check if your API Key is restricted to a specific IP or Bundle ID in Google Cloud Credentials."
    });

  } catch (err) {
    return res.status(500).json({ error: "System Error", details: err.message });
  }
}
