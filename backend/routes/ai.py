from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from grok_utils import stream_grok_response

router = APIRouter()

class PromptInput(BaseModel):
    text: str

@router.post("/generate/stream")
async def generate_stream(input: PromptInput):
    generator = stream_grok_response(input.text)
    return StreamingResponse(generator, media_type="text/plain")

