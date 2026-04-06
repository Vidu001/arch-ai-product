// utils/jsonParser.js

export function extractJSON(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("Invalid JSON format from AI");
  }

  const clean = text.substring(start, end + 1);

  return JSON.parse(clean);
}
