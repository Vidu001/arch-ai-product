export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { resumeText, seenJobs = [] } = req.body || {};

    if (!resumeText || resumeText.length < 50) {
      return res.status(400).json({ error: "Invalid resumeText" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY in Vercel environment variables" });
    }

    const systemPrompt = `You are an expert career coach and technical recruiter. 
    Analyze the user's resume and suggest 3 high-paying career "bridges" (next-step roles).
    For each role, provide a strategy to pivot, a specific skill gap, and a LaTeX snippet to update their resume.
    Avoid suggesting these previously seen jobs: ${seenJobs.join(", ")}.`;

    const userPrompt = `Resume Content: ${resumeText.slice(0, 4000)}`;

    // Note the model name: gemini-1.5-flash (most stable for standard API keys)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                jobs: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      title: { type: "STRING" },
                      company: { type: "STRING" },
                      score: { type: "NUMBER" },
                      gap: { type: "STRING" },
                      strategy: { type: "STRING" },
                      courseTitle: { type: "STRING" },
                      latex: { type: "STRING" }
                    }
                  }
                }
              }
            }
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error Response:", data);
      return res.status(response.status).json({ 
        error: "Gemini API Error", 
        details: data.error?.message || "Unknown error" 
      });
    }

    const textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textResponse) {
      return res.status(500).json({ error: "Empty response from AI" });
    }

    const parsed = JSON.parse(textResponse);
    return res.status(200).json(parsed);

  } catch (err) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      details: err.message
    });
  }
}
