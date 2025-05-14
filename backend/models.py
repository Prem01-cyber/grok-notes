from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime

class Note(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    content_json: str
    updated_at: datetime = Field(default_factory=datetime.utcnow)

