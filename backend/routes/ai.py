from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from grok_utils import stream_grok_response, stream_grok_autocomplete

router = APIRouter()

class PromptInput(BaseModel):
    text: str
    note_title: str
    note_context: str

class AutocompleteInput(BaseModel):
    current_text: str
    note_title: str
    note_context: str
    
@router.post("/generate/stream")
async def generate_stream(input: PromptInput) -> StreamingResponse:
    generator = stream_grok_response(input.text, input.note_title, input.note_context)
    return StreamingResponse(generator, media_type="text/plain")

@router.post("/generate/autocomplete")
async def generate_autocomplete(input: AutocompleteInput) -> StreamingResponse:
    generator = stream_grok_autocomplete(input.current_text, input.note_title, input.note_context)
    return StreamingResponse(generator, media_type="text/plain")
