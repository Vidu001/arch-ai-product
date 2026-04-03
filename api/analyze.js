export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API Key missing in Vercel settings." });

  const { resumeText, seenJobs = [] } = req.body || {};

  // Reliability Configuration
  const MODELS = ["gemini-flash-latest", "gemini-1.5-flash-001"]; 
  const MAX_RETRIES = 3;

  const prompt = `Return a JSON object with 3 job suggestions for this resume: ${resumeText.slice(0, 2500)}. 
  Exclude these jobs already seen: ${seenJobs.join(", ")}. 
  Format strictly as JSON: {"jobs": [{"title": "...", "company": "...", "score": 90, "gap": "...", "strategy": "...", "courseTitle": "...", "latex": "..."}]}`;

  // Helper function to call specific model with backoff
  async function callGeminiWithRetry(modelName) {
    let lastError;
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        
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

        // If 503 (High Demand) or 429 (Rate Limit), trigger a retry if possible
        if (response.status === 503 || response.status === 429) {
          lastError = data.error?.message || "Service Busy";
          const waitTime = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue; 
        }

        if (!response.ok) {
          throw new Error(data.error?.message || "Google API Error");
        }

        return data;
      } catch (err) {
        lastError = err.message;
        if (attempt === MAX_RETRIES - 1) throw err;
      }
    }
    throw new Error(lastError);
  }

  try {
    let data;
    let success = false;

    // Try primary model, then fallback to secondary if primary fails after retries
    for (const model of MODELS) {
      try {
        data = await callGeminiWithRetry(model);
        success = true;
        break; 
      } catch (e) {
        console.error(`Model ${model} failed, trying next...`, e.message);
      }
    }

    if (!success) {
      return res.status(503).json({ 
        error: "Google_API_Unavailable", 
        message: "All models are currently overloaded. Please try again in 30 seconds."
      });
    }

    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) throw new Error("No text content returned from Gemini.");

    return res.status(200).json(JSON.parse(resultText));

  } catch (err) {
    console.error("Critical Analysis Error:", err);
    return res.status(500).json({ 
      error: "Server Error", 
      details: err.message 
    });
  }
}
