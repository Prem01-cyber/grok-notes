from fastapi import APIRouter, HTTPException
from sqlmodel import select
from models import Note
from database import get_session

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
