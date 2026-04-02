export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { resumeText, seenJobs = [] } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) return res.status(500).json({ error: "API Key missing in Vercel." });

    // Step 1: Check for model availability
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const listRes = await fetch(listUrl);
    const listData = await listRes.json();

    if (!listRes.ok) {
      // THIS IS THE CRITICAL ERROR CATCHER
      return res.status(listRes.status).json({ 
        error: "API_DISABLED", 
        message: "The Generative Language API is not enabled in your Google Cloud Project.",
        instruction: "1. Click 'Gemini API' in your search screenshot. 2. Click the 'ENABLE' button on the next page."
      });
    }

    const availableModels = listData.models || [];
    const targetModel = availableModels.find(m => m.name.includes("gemini-1.5-flash"))?.name || "models/gemini-pro";

    // Step 2: Generate Content
    const generateUrl = `https://generativelanguage.googleapis.com/v1beta/${targetModel}:generateContent?key=${apiKey}`;

    const response = await fetch(generateUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Analyze this resume and return a JSON object with 3 job leads: ${resumeText.slice(0, 2000)}. Exclude: ${seenJobs.join(", ")}` }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Generation failed");

    return res.status(200).json(JSON.parse(data.candidates[0].content.parts[0].text));

  } catch (err) {
    return res.status(500).json({ error: "System Error", details: err.message });
  }
}
