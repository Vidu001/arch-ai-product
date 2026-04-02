export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { resumeText, seenJobs = [] } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) return res.status(500).json({ error: "API Key missing in Vercel." });

    // These are the most stable model strings for the Generative Language API
    const modelCandidates = [
      { ver: 'v1beta', name: 'gemini-1.5-flash' },
      { ver: 'v1', name: 'gemini-1.5-flash' },
      { ver: 'v1beta', name: 'gemini-pro' }
    ];

    let successResponse = null;
    let lastError = null;

    const prompt = `Analyze this resume and return a JSON object with 3 job leads for 2026: ${resumeText.slice(0, 2000)}. 
    Exclude these roles: ${seenJobs.join(", ")}. 
    Required JSON structure: {"jobs": [{"title": "...", "company": "...", "score": 95, "gap": "...", "strategy": "...", "courseTitle": "...", "latex": "..."}]}`;

    for (const cand of modelCandidates) {
      try {
        // Standard Google AI URL format
        const url = `https://generativelanguage.googleapis.com/${cand.ver}/models/${cand.name}:generateContent?key=${apiKey}`;
        
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

        if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
          successResponse = JSON.parse(data.candidates[0].content.parts[0].text);
          break; 
        } else {
          lastError = data.error?.message || "Model rejected request";
        }
      } catch (e) {
        lastError = e.message;
      }
    }

    if (successResponse) {
      return res.status(200).json(successResponse);
    }

    return res.status(500).json({ 
      error: "Final Model Failure", 
      details: lastError,
      actionRequired: "Check 'API Restrictions' in Google Cloud Console Credentials. Ensure your key is NOT restricted, or specifically allows 'Generative Language API'."
    });

  } catch (err) {
    return res.status(500).json({ error: "System Error", details: err.message });
  }
}
