import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { resumeText, seenJobs } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Server Configuration Error" });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // FIX: Corrected syntax and model string
    const model = genAI.getGenerativeModel(
      { model: "gemini-1.5-flash" },
      { apiVersion: "v1" }
    );

    const systemPrompt = `
      Analyze the resume text and return a valid JSON object.
      Exclude these titles: ${JSON.stringify(seenJobs || [])}.
      
      IMPORTANT: Return ONLY the JSON object. Do not include markdown or backticks.
      
      Format:
      {
        "candidateName": "String",
        "suggestedRole": "String",
        "skills": ["String"],
        "jobs": [
          {
            "title": "String",
            "company": "String",
            "score": number,
            "gap": "String",
            "strategy": "String",
            "latex": "String"
          }
        ]
      }
    `;

    const result = await model.generateContent([
      { text: systemPrompt },
      { text: `Resume Content: ${resumeText}` }
    ]);

    const response = await result.response;
    let text = response.text();
    
    // Extract JSON safely
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');
    
    if (startIdx === -1 || endIdx === -1) {
      throw new Error("Model failed to generate a valid JSON block.");
    }
    
    const cleanJson = text.substring(startIdx, endIdx + 1);
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
