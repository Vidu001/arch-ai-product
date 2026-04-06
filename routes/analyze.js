import { buildPrompt } from "../services/promptService";
import { callLLM } from "../services/llmService";
import { extractJSON } from "../utils/jsonParser";
import formidable from "formidable";
import fs from "fs";
import { extractTextFromPDF } from "../utils/pdfParser";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { resumeText } = req.body;

  if (!resumeText) {
    return res.status(400).json({ error: "Missing resumeText" });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;

  try {
    const { systemPrompt, userPrompt } = buildPrompt(resumeText);

    const data = await callLLM(systemPrompt, userPrompt, apiKey);

    if (!data.choices || !data.choices.length) {
      return res.status(500).json({
        error: "Empty OpenRouter response",
        raw: data
      });
    }

    const text = data.choices[0].message.content;

    const parsed = extractJSON(text);

    return res.status(200).json(parsed);

  } catch (err) {
    console.error("Server Error:", err);

    return res.status(500).json({
      error: err.message || "Server crashed"
    });
  }
}
