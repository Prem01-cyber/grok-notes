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

export async function streamGrokText(payload) {
  console.log('🚀 streamGrokText called with payload:', payload);
  
  if (!payload || typeof payload !== 'object') {
    console.error('❌ Invalid payload:', payload);
    throw new Error('Invalid payload provided to streamGrokText');
  }

  return new Promise(async (resolve, reject) => {
    try {
      // console.log('📡 Making fetch request to:', `${API_BASE}/generate/stream`);
      
      const response = await fetch(`${API_BASE}/generate/stream`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "text/event-stream"
        },
        body: JSON.stringify(payload),
      });

      // console.log('📥 Response received:', {
      //   ok: response.ok,
      //   status: response.status,
      //   statusText: response.statusText,
      //   headers: Object.fromEntries(response.headers.entries()),
      //   body: response.body ? 'ReadableStream present' : 'No ReadableStream'
      // });

      if (!response.ok) {
        const errText = await response.text();
        console.error("🚨 Grok API error:", response.status, errText);
        reject(new Error(`Grok API error: ${response.status} - ${errText}`));
        return;
      }

      if (!response.body) {
        console.error("🚨 No response body from Grok API");
        reject(new Error("No response body from Grok API"));
        return;
      }

      resolve(response);
    } catch (error) {
      console.error("🚨 Error in streamGrokText:", error);
      reject(new Error(`StreamGrokText failed: ${error.message}`));
    }
  });
}

export async function streamGrokAutocomplete(payload) {
  console.log('🚀 streamGrokAutocomplete called with payload:', payload);
  
  if (!payload || typeof payload !== 'object') {
    console.error('❌ Invalid payload:', payload);
    throw new Error('Invalid payload provided to streamGrokAutocomplete');
  }

  return new Promise(async (resolve, reject) => {
    try {
      const response = await fetch(`${API_BASE}/generate/autocomplete`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "text/event-stream"
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("🚨 Grok Autocomplete API error:", response.status, errText);
        reject(new Error(`Grok Autocomplete API error: ${response.status} - ${errText}`));
        return;
      }

      if (!response.body) {
        console.error("🚨 No response body from Grok Autocomplete API");
        reject(new Error("No response body from Grok Autocomplete API"));
        return;
      }

      resolve(response);
    } catch (error) {
      console.error("🚨 Error in streamGrokAutocomplete:", error);
      reject(new Error(`StreamGrokAutocomplete failed: ${error.message}`));
    }
  });
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

export async function deleteNote(noteId) {
  const response = await fetch(`${API_BASE}/notes/${noteId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to delete note');
  }

  return response.json();
}
