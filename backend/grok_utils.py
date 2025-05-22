import os
from openai import OpenAI
from dotenv import load_dotenv
from typing import Generator

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

def stream_grok_response(text: str, note_title: str, note_context: str) -> Generator[str, None, None]:
    try:
        # 👇 Advanced prompt for Notion-quality AI note generation
        user_prompt = f"""
            You are embedded in a professional, structured note-taking app similar to Notion. Your job is to help users enhance, extend, or synthesize content into highly usable, structured, and visually organized notes.

            ## Note Title:
            {note_title}

            ## Existing Context:
            {note_context}

            ## User Instruction:
            {text}

            ## Instructions:
            Respond with a markdown-style structure optimized for clarity and readability. Your response must include the following:

            1. **Main heading** summarizing the topic.
            2. **Brief overview paragraph** giving a high-level summary (2–3 sentences max).
            3. **Well-defined subheadings** for key ideas or sections.
            4. **Bullet points or numbered lists** under each subheading for detailed elaboration.
            5. **Code blocks** for technical instructions (if relevant).
            6. **Avoid**: Repetition of the context unless needed, generic filler, or conversational fluff.

            Be clear, direct, and knowledge-rich. Prioritize insight and structure over verbosity.
            """

        response = client.chat.completions.create(
            model="grok-3-latest",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert technical writer and note composer embedded in a powerful, structured workspace like Notion. "
                        "Your responses are always actionable, cleanly formatted, and optimized for professionals. "
                        "Avoid conversational tone. Use markdown formatting to convey structure. Focus on transforming raw input "
                        "into high-quality notes."
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
