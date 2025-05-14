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
