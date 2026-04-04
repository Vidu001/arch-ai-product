import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // 1. Method Guard
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { resumeText, seenJobs } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  // 2. Critical Check: Environment Variables
  if (!apiKey) {
    console.error("CRITICAL: GEMINI_API_KEY is missing from environment variables.");
    return res.status(500).json({ error: "Server Configuration Error" });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // 3. Robust Model Initialization
    // Using 1.5-flash as it is the most stable across all regions
    const model = genAI.getGenerativeModel({ 
     { model: "gemini-1.5-flash" },
  { apiVersion: "v1" }
    });

    const systemPrompt = `
      Analyze the resume text and return a valid JSON object.
      Exclude these titles: ${JSON.stringify(seenJobs || [])}.
      Return ONLY raw JSON in this format:
      {
        "candidateName": "String",
        "suggestedRole": "String",
        "skills": ["String"],
        "jobs": []
      }
    `;

    // 4. Execution
    const result = await model.generateContent([
      { text: systemPrompt },
      { text: `Resume Content: ${resumeText}` }
    ]);

    const response = await result.response;
    let text = response.text();
    
    // 5. Defensive JSON Parsing (Strips markdown backticks if present)
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(cleanJson);

    return res.status(200).json(data);

  } catch (error) {
    console.error("Function Crash Details:", error);
    return res.status(500).json({ 
      error: "Invocation Failed", 
      details: error.message 
    });
  }
}
