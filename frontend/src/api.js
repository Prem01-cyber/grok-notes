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
  const res = await fetch("http://localhost:8000/generate/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    yield decoder.decode(value);
  }
}

