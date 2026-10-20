"""Help-chat endpoint for the in-app assistant.

Public on purpose: the most common questions ("how do I register?", "I forgot
my password") come from people who aren't signed in. A per-IP rate limit
stands in for auth to protect the Gemini quota.
"""

import logging
import time
from collections import defaultdict, deque
from typing import Literal

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services import assistant

router = APIRouter(prefix="/assistant", tags=["assistant"])

logger = logging.getLogger(__name__)

# In-memory, so per process. Good enough for a single instance; move to
# Redis if the API is ever scaled out.
_recent_requests: dict[str, deque[float]] = defaultdict(deque)


def _check_rate_limit(request: Request) -> None:
    # Behind a proxy (Render, Railway...) the client IP is the first entry of
    # X-Forwarded-For.
    forwarded = request.headers.get("x-forwarded-for", "")
    ip = forwarded.split(",")[0].strip() or (request.client.host if request.client else "unknown")

    now = time.monotonic()
    window = _recent_requests[ip]
    while window and now - window[0] > 60:
        window.popleft()
    if len(window) >= settings.ASSISTANT_RATE_LIMIT_PER_MINUTE:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many questions at once. Please wait a minute and try again.",
        )
    window.append(now)


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    text: str = Field(..., max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=20)
    language: Literal["en", "km"] = "en"


class ChatResponse(BaseModel):
    reply: str
    sources: list[str]


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, request: Request):
    _check_rate_limit(request)
    try:
        result = await run_in_threadpool(
            assistant.answer,
            payload.message.strip(),
            [assistant.Turn(t.role, t.text) for t in payload.history],
            payload.language,
        )
    except RuntimeError as exc:
        logger.error("Help assistant failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The assistant is busy right now. Please try again in a moment.",
        )
    return ChatResponse(reply=result.reply, sources=result.sources)
