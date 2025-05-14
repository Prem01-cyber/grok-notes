from sqlmodel import create_engine, Session, SQLModel
import os

DATABASE_URL = "sqlite:///./notes.db"
engine = create_engine(DATABASE_URL, echo=False)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    return Session(engine)

