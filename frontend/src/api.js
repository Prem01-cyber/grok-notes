// src/api.js
import axios from "axios";

const API_BASE = "http://localhost:8000"; // your FastAPI backend

export async function summarizeNote(text) {
  try {
    const res = await axios.post(`${API_BASE}/summarize`, { text });
    return res.data.summary;
  } catch (error) {
    console.error("Error calling summarize:", error);
    return "Failed to summarize.";
  }
}

export async function* streamGrokText(text) {
  console.log("📡 Sending POST request to backend with text:", text);

  const res = await fetch("http://localhost:8000/generate/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("🚨 Grok API error:", res.status, errText);
    throw new Error(`Grok API error: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    yield chunk;
  }
}

