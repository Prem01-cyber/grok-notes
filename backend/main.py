# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.summarize import router as summarize_router
from routes.ai import router as ai_router
from routes.notes import router as notes_router
from database import create_db_and_tables

app = FastAPI()

# Allow frontend on localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize DB
create_db_and_tables()

# Register routes
app.include_router(summarize_router)
app.include_router(ai_router)
app.include_router(notes_router)
