const { GoogleGenerativeAI } = require("@google/generative-ai");

// This matches the Vercel Serverless Function signature
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { resumeText, seenJobs } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "API Key not configured in Vercel environment." });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-09-2025" });

  const systemPrompt = `
    You are an expert career strategist. Analyze the provided resume text and return a JSON object.
    
    The JSON must follow this exact schema:
    {
      "candidateName": "String",
      "suggestedRole": "String",
      "skills": ["String"],
      "jobs": [
        {
          "title": "Job Title",
          "company": "Company Name",
          "score": number (0-100),
          "gap": "Comma separated missing skills",
          "strategy": "One sentence on how to pivot",
          "latex": "A 3-line LaTeX snippet of a resume 'Professional Summary' tailored for this specific job"
        }
      ]
    }
    
    Generate 3-5 high-quality strategic job matches based on the candidate's background.
    Exclude any jobs with titles in this list: ${JSON.stringify(seenJobs)}
  `;

  try {
    const result = await model.generateContent([
      { text: systemPrompt },
      { text: `Resume Content: ${resumeText}` }
    ]);

    const response = await result.response;
    let text = response.text();
    
    // Clean potential markdown code blocks from the response
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const data = JSON.parse(text);
    res.status(200).json(data);
  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: "Failed to analyze resume", details: error.message });
  }
}
