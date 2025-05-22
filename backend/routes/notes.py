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
