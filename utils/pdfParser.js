// utils/pdfParser.js

import pdf from "pdf-parse";

export async function extractTextFromPDF(buffer) {
  try {
    const data = await pdf(buffer);

    let text = data.text;

    // Basic cleaning
    text = text
      .replace(/\n+/g, "\n")     // remove excessive newlines
      .replace(/\s+/g, " ")      // normalize spaces
      .trim();

    return text;
  } catch (err) {
    console.error("PDF parsing error:", err);
    throw new Error("Failed to parse PDF");
  }
}
