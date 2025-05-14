import axios from "axios";

const API_BASE = "http://localhost:8000";

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
  const res = await fetch(`${API_BASE}/generate/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Grok API error:", res.status, errText);
    throw new Error(`Grok API error: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    yield decoder.decode(value);
  }
}

export async function getAllNotes() {
  try {
    const res = await axios.get(`${API_BASE}/notes`);
    return res.data;
  } catch (err) {
    console.error("Failed to load notes", err);
    return [];
  }
}

export async function saveNote(note) {
  try {
    const res = await axios.post(`${API_BASE}/notes/save`, note);
    return res.data;
  } catch (err) {
    console.error("Failed to save note", err);
  }
}

