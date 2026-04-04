import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { resumeText, seenJobs } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ error: "Server Configuration Error" });

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // FIX: Using "-latest" and correct 2-argument structure
    // Argument 1: Model Params | Argument 2: Request Options
    const model = genAI.getGenerativeModel(
      { model: "gemini-1.5-flash-latest" }, 
      { apiVersion: "v1" }
    );

    const systemPrompt = `
      Analyze the resume and return a valid JSON object.
      Exclude: ${JSON.stringify(seenJobs || [])}.
      Return ONLY raw JSON:
      {
        "candidateName": "String",
        "suggestedRole": "String",
        "skills": ["String"],
        "jobs": [
          {
            "title": "String",
            "company": "String",
            "score": 85,
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
    const text = response.text();
    
    // Robust JSON extraction
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');
    if (startIdx === -1) throw new Error("No JSON found in AI response");
    
    const data = JSON.parse(text.substring(startIdx, endIdx + 1));
    return res.status(200).json(data);

  } catch (error) {
    console.error("Crash Details:", error);
    return res.status(500).json({ error: "Invocation Failed", details: error.message });
  }
}
