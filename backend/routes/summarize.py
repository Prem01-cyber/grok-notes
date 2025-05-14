# backend/routes/summarize.py
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from grok_utils import get_summary_from_grok

router = APIRouter()

class NoteInput(BaseModel):
    text: str

@router.post("/summarize")
async def summarize_note(data: NoteInput):
    try:
        summary = get_summary_from_grok(data.text)
        return {"summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
