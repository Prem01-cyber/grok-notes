from sqlmodel import SQLModel, Field
from typing import Optional, List, Dict
from datetime import datetime
from pydantic import BaseModel

class NoteMetadata(BaseModel):
    tags: List[str] = []
    deadline: Optional[datetime] = None
    owner: Optional[str] = None
    intent: Optional[str] = None
    context: Optional[Dict] = None

class Note(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    content_json: str
    note_metadata: str = Field(default="{}")  # JSON string of NoteMetadata
    chunks: str = Field(default="[]")    # JSON array of semantic chunks
    embeddings: str = Field(default="[]") # JSON array of embeddings
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    version: int = Field(default=1)
    parent_id: Optional[int] = Field(default=None, foreign_key="note.id")
