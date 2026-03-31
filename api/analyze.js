export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { resumeText, seenJobs = [] } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "API Key missing in Vercel environment variables." });
    }

    // List of models to rotate through in case of regional 404s
    const models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];
    let lastError = "";

    for (const modelName of models) {
      try {
        // We use the STABLE v1 endpoint first, then v1beta if needed
        const url = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`;
        
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Return a JSON object with 3 job recommendations for this resume: ${resumeText.slice(0, 3000)}. 
                Exclude: ${seenJobs.join(", ")}. 
                Required JSON keys: jobs (array of objects with title, company, score, gap, strategy, courseTitle, latex). 
                Return ONLY the raw JSON, no markdown code blocks.`
              }]
            }]
          })
        });

        const data = await response.json();

        if (response.ok) {
          let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          // Clean up any markdown AI might have added
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            return res.status(200).json(JSON.parse(jsonMatch[0]));
          }
        } else {
          lastError = data.error?.message || "Unknown error";
          if (response.status === 404) continue; // Try the next model
          else break; // If it's a 400 or 429, don't loop
        }
      } catch (e) {
        lastError = e.message;
        continue;
      }
    }

    // IF WE REACH HERE, ALL MODELS FAILED
    return res.status(500).json({ 
      error: "AI Engine Connection Failure", 
      message: lastError,
      action: "Please go to Google Cloud Console > APIs & Services > Library > Search 'Generative Language API' > Ensure it is ENABLED for your project."
    });

  } catch (err) {
    return res.status(500).json({ error: "Server Error", details: err.message });
  }
}
