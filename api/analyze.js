export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { resumeText, seenJobs } = req.body;

  if (!resumeText) {
    return res.status(400).json({ error: "Missing resumeText" });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Missing API Key" });
  }

  try {
    const prompt = `
You are an AI career assistant.

Analyze the resume and return STRICT JSON.

DO NOT return markdown.
DO NOT return explanation.
ONLY return JSON.

Exclude jobs already seen:
${JSON.stringify(seenJobs || [])}

FORMAT:

{
  "candidateName": "string",
  "suggestedRole": "string",
  "skills": ["string"],
  "jobs": [
    {
      "title": "string",
      "company": "string",
      "score": number,
      "gap": "string",
      "strategy": "string",
      "courseTitle": "string",
      "latex": "string"
    }
  ]
}

Resume:
${resumeText}
`;

    const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-001:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!data.candidates || !data.candidates.length) {
      return res.status(500).json({
        error: "Empty Gemini response",
        raw: data
      });
    }

    let text = data.candidates[0].content.parts[0].text;

    // Extract JSON safely
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");

    if (start === -1 || end === -1) {
      return res.status(500).json({
        error: "Invalid JSON format from AI",
        raw: text
      });
    }

    const clean = text.substring(start, end + 1);
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);

  } catch (err) {
    console.error("Server Error:", err);
    return res.status(500).json({
      error: "Server crashed",
      details: err.message
    });
  }
}
