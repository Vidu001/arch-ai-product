const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Enhanced Vercel Serverless Function: api/analyze.js
 * Fixes: 503 (High Demand) with retries, 404 (Model ID), and JSON parsing.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { resumeText, seenJobs } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!resumeText) {
    return res.status(400).json({ error: "Missing resumeText in request body" });
  }

  if (!apiKey) {
    return res.status(500).json({ error: "API Configuration Error: GEMINI_API_KEY missing" });
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  

  const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash-latest",
    generationConfig: { responseMimeType: "application/json" // Using -latest ensures you hit the current active version
});
  const modelList = await genAI.listModels();
console.log("Available models:", JSON.stringify(modelList, null, 2));


  const systemPrompt = `
    Analyze the resume text and return a valid JSON object.
    Exclude these titles: ${JSON.stringify(seenJobs || [])}.
    
    Structure:
    {
      "candidateName": "String",
      "suggestedRole": "String",
      "skills": ["String"],
      "jobs": [{ "title": "String", "company": "String", "score": 85, "gap": "String", "strategy": "String", "latex": "String" }]
    }
  `;

  // --- RETRY LOGIC FOR 503 ERRORS ---
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const result = await model.generateContent([
        { text: systemPrompt },
        { text: `Resume Content: ${resumeText}` }
      ]);

      const response = await result.response;
      const text = response.text();
      
      // Because we set responseMimeType, we can safely parse
      return res.status(200).json(JSON.parse(text));

    } catch (error) {
      attempts++;
      const isRateLimit = error.message?.includes("503") || error.message?.includes("high demand");
      
      if (isRateLimit && attempts < maxAttempts) {
        // Wait 2 seconds before retrying to let the "spike" settle
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue; 
      }

      // If it's not a retryable error or we ran out of attempts
      console.error("Gemini API Final Failure:", error);
      return res.status(error.status || 500).json({ 
        error: "Analysis Failed", 
        details: error.message,
        suggestion: isRateLimit ? "Service is currently overloaded. Please try again in a minute." : "Check model name and API key."
      });
    }
  }
}
