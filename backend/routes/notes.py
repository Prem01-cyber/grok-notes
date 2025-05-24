from fastapi import APIRouter, HTTPException
from sqlmodel import select
from models import Note
from database import get_session
from fastapi import UploadFile, File
from typing import Optional, List
from models import NoteMetadata
from grok_utils import (
    enhance_note,
    process_multimodal_input,
    generate_diff,
    format_markdown
)
import json
from sqlmodel import Session
from database import engine
from numpy import dot
from numpy.linalg import norm

router = APIRouter()

@router.post("/notes/save")
def save_note(note: Note):
    with get_session() as session:
        if note.id:
            db_note = session.get(Note, note.id)
            if not db_note:
                raise HTTPException(status_code=404, detail="Note not found")
            db_note.title = note.title
            db_note.content_json = note.content_json
            session.add(db_note)
            session.commit()
            session.refresh(db_note)
            return db_note
        else:
            session.add(note)
            session.commit()
            session.refresh(note)
            return note

@router.get("/notes/{note_id}")
def get_note(note_id: int):
    with get_session() as session:
        note = session.get(Note, note_id)
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        return note

@router.get("/notes")
def list_notes():
    with get_session() as session:
        notes = session.exec(select(Note)).all()
        return notes

@router.delete("/notes/{note_id}")
def delete_note(note_id: int):
    with get_session() as session:
        note = session.get(Note, note_id)
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        session.delete(note)
        session.commit()
        return {"message": "Note deleted successfully"}

@router.get("/notes-backup")
def download_backup():
    import os
    from fastapi.responses import FileResponse
    db_path = "./notes.db"
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database file not found")
    return FileResponse(db_path, media_type="application/octet-stream", filename="notes_backup.db")

@router.post("/notes-restore")
async def restore_backup(file: UploadFile = File(...)):
    import os
    import tempfile
    from fastapi import UploadFile, File
    from backup_db import restore_database
    
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".db") as temp_file:
            contents = await file.read()
            temp_file.write(contents)
            temp_file_path = temp_file.name
        
        # Call restore function
        success = restore_database(temp_file_path)
        
        # Clean up temporary file
        os.unlink(temp_file_path)
        
        if success:
            return {"message": "Database restored successfully"}
        else:
            raise HTTPException(status_code=500, detail="Database restoration failed")
    except Exception as e:
        # Ensure temporary file is deleted in case of error
        if 'temp_file_path' in locals():
            try:
                os.unlink(temp_file_path)
            except:
                pass
        raise HTTPException(status_code=500, detail=f"Error during restoration: {str(e)}")

@router.post("/notes/enhanced")
async def create_enhanced_note(
    title: str,
    content: str,
    file: Optional[UploadFile] = None
):
    """Create a new note with enhanced features."""
    try:
        # Process content
        if file:
            # Save file temporarily
            file_path = f"temp_{file.filename}"
            with open(file_path, "wb") as buffer:
                content = await file.read()
                buffer.write(content)
            
            # Process based on file type
            file_type = file.content_type.split('/')[0]
            content = process_multimodal_input(file_path, file_type)
        
        # Enhance the note
        enhanced_data = enhance_note(content)
        
        # Create note
        with Session(engine) as session:
            note = Note(
                title=title,
                content_json=json.dumps({"content": content}),
                note_metadata=json.dumps(enhanced_data["note_metadata"]),
                chunks=json.dumps(enhanced_data["chunks"]),
                embeddings=json.dumps(enhanced_data["embeddings"])
            )
            session.add(note)
            session.commit()
            session.refresh(note)
            
            return {
                "id": note.id,
                "title": note.title,
                "markdown": format_markdown({
                    "title": note.title,
                    **enhanced_data
                })
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/notes/{note_id}/diff")
async def get_note_diff(note_id: int):
    """Get the diff between note versions."""
    with Session(engine) as session:
        note = session.get(Note, note_id)
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        
        if not note.parent_id:
            raise HTTPException(status_code=400, detail="No previous version available")
        
        parent_note = session.get(Note, note.parent_id)
        if not parent_note:
            raise HTTPException(status_code=404, detail="Parent note not found")
        
        current_content = json.loads(note.content_json)["content"]
        parent_content = json.loads(parent_note.content_json)["content"]
        
        return {
            "diff": generate_diff(parent_content, current_content)
        }

@router.get("/notes/{note_id}/markdown")
async def get_note_markdown(note_id: int):
    """Get the note formatted as markdown."""
    with Session(engine) as session:
        note = session.get(Note, note_id)
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        
        return {
            "markdown": format_markdown({
                "title": note.title,
                "chunks": json.loads(note.chunks),
                "clusters": json.loads(note.embeddings),
                "note_metadata": json.loads(note.note_metadata)
            })
        }

@router.get("/notes/search")
async def search_notes(query: str):
    """Search notes using semantic search."""
    with Session(engine) as session:
        # Get all notes
        notes = session.exec(select(Note)).all()
        
        # Generate query embedding
        from grok_utils import generate_embeddings
        query_embedding = generate_embeddings([query])[0]
        
        # Compare with note embeddings
        results = []
        for note in notes:
            note_embeddings = json.loads(note.embeddings)
            if note_embeddings:
                # Calculate similarity (cosine similarity)
                similarities = [
                    dot(query_embedding, emb) / (norm(query_embedding) * norm(emb))
                    for emb in note_embeddings
                ]
                max_similarity = max(similarities)
                if max_similarity > 0.5:  # Threshold for relevance
                    results.append({
                        "id": note.id,
                        "title": note.title,
                        "similarity": float(max_similarity)
                    })
        
        # Sort by similarity
        results.sort(key=lambda x: x["similarity"], reverse=True)
        return results
