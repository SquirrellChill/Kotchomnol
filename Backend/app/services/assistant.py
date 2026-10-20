"""Help assistant: retrieve the relevant help sections, then answer from them.

Stateless — the client sends the recent conversation with every question,
so nothing is stored server-side.
"""

from dataclasses import dataclass

from app.core.config import call_with_retry, get_client, settings
from app.services.knowledge_base import knowledge_base
from app.services.prompts import ASSISTANT_SYSTEM_PROMPT

# Older turns add tokens without helping retrieval or the answer.
MAX_HISTORY_TURNS = 8

LANGUAGE_NAMES = {"km": "Khmer", "en": "English"}


@dataclass
class Turn:
    role: str   # "user" or "assistant"
    text: str


@dataclass
class Answer:
    reply: str
    sources: list[str]


def _retrieval_query(message: str, history: list[Turn]) -> str:
    # Follow-ups like "and after that?" only make sense with the previous
    # question, so search on both.
    previous = next((t.text for t in reversed(history) if t.role == "user"), "")
    return f"{previous}\n{message}".strip()


def answer(message: str, history: list[Turn], language: str) -> Answer:
    from google.genai import types

    history = history[-MAX_HISTORY_TURNS:]
    hits = knowledge_base.search(_retrieval_query(message, history), settings.ASSISTANT_TOP_K)
    context = "\n\n---\n\n".join(chunk.text for chunk, _ in hits)

    contents = [
        types.Content(
            role="model" if turn.role == "assistant" else "user",
            parts=[types.Part(text=turn.text)],
        )
        for turn in history
    ]
    contents.append(types.Content(role="user", parts=[types.Part(text=message)]))

    config = types.GenerateContentConfig(
        system_instruction=ASSISTANT_SYSTEM_PROMPT.format(
            language_name=LANGUAGE_NAMES.get(language, "English"),
            context=context,
        ),
        temperature=settings.TEMPERATURE,
        max_output_tokens=1024,
    )
    response = call_with_retry(
        lambda: get_client().models.generate_content(
            model=settings.ASSISTANT_MODEL, contents=contents, config=config,
        ),
        what="Help assistant",
    )

    reply = (response.text or "").strip()
    return Answer(reply=reply, sources=sorted({chunk.title for chunk, _ in hits}))
