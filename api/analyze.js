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
    
    // We remove the generationConfig block that caused the 400 error
    const model = genAI.getGenerativeModel(
       model: "gemini-2.5-flash" 
    );

    const systemPrompt = `
      Analyze the resume text and return a valid JSON object.
      Exclude these titles: ${JSON.stringify(seenJobs || [])}.
      
      IMPORTANT: Return ONLY the JSON object. Do not include any markdown formatting, 
      backticks, or explanations. 
      
      Format:
      {
        "candidateName": "String",
        "suggestedRole": "String",
        "skills": ["String"],
        "jobs": []
      }
    `;

    const result = await model.generateContent([
      { text: systemPrompt },
      { text: `Resume Content: ${resumeText}` }
    ]);

    const response = await result.response;
    let text = response.text();
    
    // STRONGER CLEANUP: 
    // This finds the first '{' and last '}' to extract only the JSON part
    // in case the model adds conversational text or backticks.
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
