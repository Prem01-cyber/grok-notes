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
        # 👇 Construct the user prompt with contextual grounding
        user_prompt = (
            f"You are working inside a structured notes application.\n"
            f"The user is editing a note titled: '{note_title}'.\n\n"
            f"Here is the relevant context from the note:\n{note_context}\n\n"
            f"The user instruction is:\n{text}\n\n"
            f"Please provide a response that is informative, clear, and helpful.\n"
            f"Use bullet points, subheadings, or code blocks if they improve readability.\n"
            f"Do not repeat what is already in the context unless it's necessary for clarity.\n"
        )

        response = client.chat.completions.create(
            model="grok-3-latest",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an intelligent assistant integrated into a structured note-taking app "
                        "like Notion. Your goal is to help users expand, explain, or improve their notes "
                        "based on existing context. Be concise, context-aware, and use formatting to aid clarity."
                    )
                },
                {
                    "role": "user",
                    "content": user_prompt
                }
            ],
            stream=True
        )

        for chunk in response:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    except Exception as e:
        yield f"[Error] {str(e)}"