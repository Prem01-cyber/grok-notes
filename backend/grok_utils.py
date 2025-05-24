import os
import json
from openai import OpenAI
from dotenv import load_dotenv
from typing import Generator, List, Dict, Any, Optional
from datetime import datetime
import openai
from sentence_transformers import SentenceTransformer
import numpy as np
from sklearn.cluster import KMeans
import re
from pathlib import Path
import pytesseract
from PIL import Image
import difflib

load_dotenv()

client = OpenAI(
    api_key=os.getenv("GROK_API_KEY"),
    base_url=os.getenv("GROK_API_URL")
)

# === CONFIG ===
MAX_CHARS_PER_CHUNK = 3000
USE_JSON_OUTPUT = False  # Set to True if you want block-based JSON output

# === UTILITIES ===

def chunk_text(text: str, max_chars: int = MAX_CHARS_PER_CHUNK) -> List[str]:
    """Split text into manageable chunks."""
    paras = text.split("\n\n")
    chunks, current = [], ""
    for para in paras:
        if len(current) + len(para) > max_chars:
            chunks.append(current.strip())
            current = para
        else:
            current += "\n\n" + para
    if current.strip():
        chunks.append(current.strip())
    return chunks

# === EXAMPLE PROMPT ===

FEW_SHOT_EXAMPLE = """
### Example Input
Meeting on April 22: We reviewed the Q2 roadmap, agreed to add feature X by end of May, flagged performance debt in service Y.

### Example Output (Markdown)
# Q2 Roadmap Review – April 22

**Overview:**  
Discussed key deliverables for Q2; assigned deadlines and identified technical debt.

## Feature X
- **Action:** Implement by May 31  
- **Owner:** Alice

## Technical Debt in Service Y
- **Issue:** Slow queries on /report endpoint  
- **Next Steps:** Profile and optimize before next sprint
"""

def build_prompt(input_text: str, title: str = "", context: str = "", retrieved_info: str = "") -> str:
    return f"""
You are embedded in a professional note-taking app like Notion. Transform the raw input below into structured, high-quality notes in markdown format. Use the provided retrieved information to enrich the content where relevant.

{FEW_SHOT_EXAMPLE}

### Input
Title: {title}
Context: {context}
Content: {input_text}
Retrieved Information: {retrieved_info}

### Output
"""

# === STREAM SUMMARIZER ===

def get_summary_from_grok(text: str) -> str:
    """Generate a concise summary of the input text using Grok API."""
    try:
        response = client.chat.completions.create(
            model="grok-3-latest",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert in summarizing content. Provide a brief and concise summary of the given text."
                    )
                },
                {
                    "role": "user",
                    "content": f"Summarize the following text:\n\n{text}"
                }
            ],
            temperature=0.2,
            max_tokens=150,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"Error generating summary: {str(e)}"

def retrieve_information(text: str) -> str:
    """Placeholder for retrieving relevant external information based on input text."""
    # TODO: Implement actual retrieval mechanism (e.g., search database, web, or predefined knowledge base)
    return f"Relevant info for {text[:50]}... (placeholder for RAG implementation)"

def stream_grok_response(text: str, note_title: str = "", note_context: str = "", use_rag: bool = True, use_multi_pass: bool = True) -> Generator[str, None, None]:
    chunks = chunk_text(text)
    try:
        for i, chunk in enumerate(chunks):
            # First Pass: Initial content generation with optional RAG
            retrieved_info = retrieve_information(chunk) if use_rag else ""
            user_prompt = build_prompt(chunk, note_title, note_context, retrieved_info)

            response = client.chat.completions.create(
                model="grok-3-latest",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an expert technical note composer for a professional workspace. "
                            "Always respond in cleanly structured markdown with headings, bullets, and concise summaries."
                        )
                    },
                    {"role": "user", "content": user_prompt}
                ],
                stream=True,
                temperature=0.1,
                max_tokens=800,
            )

            initial_content = ""
            yield f"\n<!-- Chunk {i+1}/{len(chunks)} - First Pass -->\n"
            for chunk_resp in response:
                if chunk_resp.choices and chunk_resp.choices[0].delta.content:
                    content_piece = chunk_resp.choices[0].delta.content
                    initial_content += content_piece
                    yield content_piece

            # Second Pass: Refinement (if multi-pass is enabled)
            if use_multi_pass:
                refine_prompt = f"""
                Refine the following draft note content to improve clarity, structure, and conciseness. Ensure the markdown is polished and professional.
                
                ### Draft Content
                {initial_content}
                
                ### Output
                """
                refine_response = client.chat.completions.create(
                    model="grok-3-latest",
                    messages=[
                        {
                            "role": "system",
                            "content": (
                                "You are an expert editor for technical notes. Enhance the structure and clarity of markdown content."
                            )
                        },
                        {"role": "user", "content": refine_prompt}
                    ],
                    stream=True,
                    temperature=0.2,
                    max_tokens=800,
                )

                yield f"\n<!-- Chunk {i+1}/{len(chunks)} - Second Pass (Refinement) -->\n"
                for refine_chunk in refine_response:
                    if refine_chunk.choices and refine_chunk.choices[0].delta.content:
                        yield refine_chunk.choices[0].delta.content

    except Exception as e:
        yield f"\n[Error] {str(e)}\n"

# === AUTOCOMPLETE ===

def stream_grok_autocomplete(current_text: str, note_title: str, note_context: str, historical_context: str = "") -> Generator[str, None, None]:
    try:
        user_prompt = f"""
You are a co-writer helping inside a structured note-taking editor. Continue the user's current sentence or paragraph, based on the note's style and prior content. Use historical context to maintain continuity.

## Title: {note_title}
## Existing Note:
{note_context}
## Historical Context:
{historical_context}

## Current User Input:
{current_text}

Respond with the most natural continuation (plain text only, no markdown).
"""

        response = client.chat.completions.create(
            model="grok-3-latest",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an inline writing assistant. You generate short, natural continuations based on context. "
                        "Do not repeat input. Respond only in plain text."
                    )
                },
                {"role": "user", "content": user_prompt}
            ],
            stream=True,
            temperature=0.5,
            max_tokens=60
        )

        for chunk in response:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    except Exception as e:
        yield f"[Error] {str(e)}"

# === NEW UTILITIES ===

# Initialize the sentence transformer model
model = SentenceTransformer('all-MiniLM-L6-v2')

def semantic_chunking(text: str, max_chunk_size: int = 500) -> List[str]:
    """Split text into semantic chunks while preserving context."""
    # Split into sentences first
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current_chunk = []
    current_size = 0
    
    for sentence in sentences:
        sentence_size = len(sentence)
        if current_size + sentence_size > max_chunk_size and current_chunk:
            chunks.append(' '.join(current_chunk))
            current_chunk = [sentence]
            current_size = sentence_size
        else:
            current_chunk.append(sentence)
            current_size += sentence_size
    
    if current_chunk:
        chunks.append(' '.join(current_chunk))
    
    return chunks

def generate_embeddings(texts: List[str]) -> List[List[float]]:
    """Generate embeddings for a list of texts."""
    return model.encode(texts).tolist()

def cluster_embeddings(embeddings: List[List[float]], n_clusters: int = 3) -> List[int]:
    """Cluster embeddings to group similar content."""
    kmeans = KMeans(n_clusters=n_clusters)
    return kmeans.fit_predict(embeddings).tolist()

def extract_note_metadata(text: str) -> Dict[str, Any]:
    """Extract note metadata from text including tags, deadlines, and owners."""
    note_metadata = {
        "tags": [],
        "deadline": None,
        "owner": None,
        "intent": None
    }
    
    # Extract tags (words starting with #)
    tags = re.findall(r'#(\w+)', text)
    note_metadata["tags"] = tags
    
    # Extract deadlines (dates in various formats)
    date_patterns = [
        r'deadline:?\s*(\d{4}-\d{2}-\d{2})',
        r'due:?\s*(\d{4}-\d{2}-\d{2})',
        r'by:?\s*(\d{4}-\d{2}-\d{2})'
    ]
    for pattern in date_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            note_metadata["deadline"] = match.group(1)
            break
    
    # Extract owner (after @ symbol)
    owner_match = re.search(r'@(\w+)', text)
    if owner_match:
        note_metadata["owner"] = owner_match.group(1)
    
    return note_metadata

def classify_intent(text: str) -> str:
    """Classify the intent of the note."""
    # Simple rule-based classification
    text_lower = text.lower()
    if any(word in text_lower for word in ['todo', 'task', 'action']):
        return 'task'
    elif any(word in text_lower for word in ['meeting', 'call', 'discussion']):
        return 'meeting'
    elif any(word in text_lower for word in ['idea', 'thought', 'concept']):
        return 'idea'
    else:
        return 'note'

def process_multimodal_input(file_path: str, input_type: str) -> str:
    """Process different types of input (text, image, audio)."""
    if input_type == 'image':
        # OCR processing
        image = Image.open(file_path)
        return pytesseract.image_to_string(image)
    elif input_type == 'audio':
        # Speech recognition
        recognizer = sr.Recognizer()
        with sr.AudioFile(file_path) as source:
            audio = recognizer.record(source)
            return recognizer.recognize_google(audio)
    else:
        # Text file
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()

def generate_diff(old_text: str, new_text: str) -> str:
    """Generate a diff between two versions of text."""
    diff = difflib.unified_diff(
        old_text.splitlines(),
        new_text.splitlines(),
        lineterm=''
    )
    return '\n'.join(diff)

def enhance_note(note_text: str) -> Dict[str, Any]:
    """Apply all enhancement techniques to a note."""
    # Generate chunks
    chunks = semantic_chunking(note_text)
    
    # Generate embeddings
    embeddings = generate_embeddings(chunks)
    
    # Cluster embeddings
    clusters = cluster_embeddings(embeddings)
    
    # Extract note metadata
    note_metadata = extract_note_metadata(note_text)
    
    # Classify intent
    intent = classify_intent(note_text)
    note_metadata["intent"] = intent
    
    return {
        "chunks": chunks,
        "embeddings": embeddings,
        "clusters": clusters,
        "note_metadata": note_metadata
    }

def format_markdown(note_data: Dict[str, Any]) -> str:
    """Format note data as markdown."""
    markdown = f"# {note_data.get('title', 'Untitled')}\n\n"
    
    # Add note metadata section
    note_metadata = note_data.get('note_metadata', {})
    if note_metadata:
        markdown += "## Metadata\n"
        if note_metadata.get('tags'):
            markdown += f"Tags: {', '.join(note_metadata['tags'])}\n"
        if note_metadata.get('deadline'):
            markdown += f"Deadline: {note_metadata['deadline']}\n"
        if note_metadata.get('owner'):
            markdown += f"Owner: {note_metadata['owner']}\n"
        markdown += f"Intent: {note_metadata.get('intent', 'note')}\n\n"
    
    # Add content sections based on clusters
    chunks = note_data.get('chunks', [])
    clusters = note_data.get('clusters', [])
    
    if chunks and clusters:
        unique_clusters = set(clusters)
        for cluster_id in unique_clusters:
            markdown += f"## Section {cluster_id + 1}\n"
            cluster_chunks = [chunk for chunk, c in zip(chunks, clusters) if c == cluster_id]
            markdown += '\n\n'.join(cluster_chunks) + '\n\n'
    
    return markdown
