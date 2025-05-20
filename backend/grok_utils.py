import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(
    api_key=os.getenv("GROK_API_KEY"),
    base_url=os.getenv("GROK_API_URL")
)

def get_summary_from_grok(text: str) -> str:
    response = client.chat.completions.create(
        model="grok-3-latest",
        messages=[
            {"role": "system", "content": "You are a helpful summarizer."},
            {"role": "user", "content": f"Summarize this:\n{text}"}
        ]
    )
    return response.choices[0].message.content.strip()

def stream_grok_response(text: str, note_title: str, note_context: str):
    try:
        full_prompt = (
            f"You are assisting with a knowledge-based note-taking application.\n"
            f"The user is currently working on a note titled '{note_title}'.\n"
            f"Here is the context of their note:\n{note_context}\n\n"
            f"The user now wants help with:\n{text}\n\n"
            f"Respond with a helpful, clear, and concise explanation that expands on the topic based on the note context. "
            f"Use bullet points or structured formatting if it improves clarity. Avoid repeating information unnecessarily."
        )

        response = client.chat.completions.create(
            model="grok-3-latest",
            messages=[
                {"role": "system", "content": "You are a helpful AI assistant for an intelligent note-taking app. Your job is to expand and clarify user notes based on their structure and context."},
                {"role": "user", "content": full_prompt}
            ],
            stream=True
        )

        for chunk in response:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    except Exception as e:
        yield f"[Error] {str(e)}"

