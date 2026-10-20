"""Retrieval over the help articles in app/knowledge/*.md.

Each "## " section of an article is one chunk. Chunks are embedded with
Gemini once and cached on disk keyed by a hash of their text, so a restart
only pays for sections that changed. The whole knowledge base is a few dozen
chunks, so search is a plain in-memory cosine scan — no vector database.

To change what the assistant knows, edit the markdown files and restart.
"""

import hashlib
import json
import logging
import math
import threading
from dataclasses import dataclass
from pathlib import Path

from app.core.config import call_with_retry, get_client, settings

logger = logging.getLogger(__name__)

KNOWLEDGE_DIR = Path(__file__).resolve().parents[1] / "knowledge"
CACHE_FILE = KNOWLEDGE_DIR / ".embeddings-cache.json"

# The embeddings API takes at most 100 inputs per request.
EMBED_BATCH_SIZE = 100


@dataclass
class Chunk:
    source: str   # file name, e.g. "account.md"
    title: str    # "Article title > Section heading"
    text: str
    vector: list[float] | None = None


def _split_markdown(path: Path) -> list[Chunk]:
    doc_title = path.stem
    chunks: list[Chunk] = []
    heading, lines = None, []

    def flush():
        body = "\n".join(lines).strip()
        if heading and body:
            title = f"{doc_title} > {heading}"
            chunks.append(Chunk(path.name, title, f"{title}\n{body}"))

    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("# "):
            doc_title = line[2:].strip()
        elif line.startswith("## "):
            flush()
            heading, lines = line[3:].strip(), []
        else:
            lines.append(line)
    flush()
    return chunks


def _normalize(values: list[float]) -> list[float]:
    # Truncated Gemini embeddings aren't unit length; normalizing once makes
    # cosine similarity a plain dot product.
    norm = math.sqrt(sum(v * v for v in values)) or 1.0
    return [v / norm for v in values]


def _embed(texts: list[str], task_type: str) -> list[list[float]]:
    from google.genai import types

    vectors: list[list[float]] = []
    for start in range(0, len(texts), EMBED_BATCH_SIZE):
        batch = texts[start:start + EMBED_BATCH_SIZE]
        response = call_with_retry(
            lambda: get_client().models.embed_content(
                model=settings.EMBEDDING_MODEL,
                contents=batch,
                config=types.EmbedContentConfig(
                    task_type=task_type,
                    output_dimensionality=settings.EMBEDDING_DIM,
                ),
            ),
            what="Help-article embedding",
        )
        vectors.extend(_normalize(e.values) for e in response.embeddings)
    return vectors


def _cache_key(text: str) -> str:
    raw = f"{settings.EMBEDDING_MODEL}|{settings.EMBEDDING_DIM}|{text}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _load_cache() -> dict[str, list[float]]:
    try:
        return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


class KnowledgeBase:
    def __init__(self) -> None:
        self._chunks: list[Chunk] = []
        self._lock = threading.Lock()
        self._ready = False

    def _build(self) -> None:
        chunks = [c for p in sorted(KNOWLEDGE_DIR.glob("*.md")) for c in _split_markdown(p)]
        cache = _load_cache()

        missing = [c for c in chunks if _cache_key(c.text) not in cache]
        if missing:
            logger.info("Embedding %d new help sections", len(missing))
            vectors = _embed([c.text for c in missing], "RETRIEVAL_DOCUMENT")
            for chunk, vector in zip(missing, vectors):
                cache[_cache_key(chunk.text)] = vector

        for chunk in chunks:
            chunk.vector = cache[_cache_key(chunk.text)]

        # Drop entries for sections that were edited or removed.
        live = {_cache_key(c.text) for c in chunks}
        try:
            CACHE_FILE.write_text(
                json.dumps({k: v for k, v in cache.items() if k in live}),
                encoding="utf-8",
            )
        except OSError as exc:
            # Read-only deploys still work; they just re-embed on restart.
            logger.warning("Could not write embedding cache: %s", exc)

        self._chunks = chunks
        self._ready = True

    def ensure_ready(self) -> None:
        """Built lazily on the first question so a Gemini outage at boot
        doesn't stop the rest of the API starting."""
        if self._ready:
            return
        with self._lock:
            if not self._ready:
                self._build()

    def search(self, query: str, top_k: int) -> list[tuple[Chunk, float]]:
        self.ensure_ready()
        [query_vector] = _embed([query], "RETRIEVAL_QUERY")
        scored = [
            (chunk, sum(a * b for a, b in zip(query_vector, chunk.vector)))
            for chunk in self._chunks
        ]
        scored.sort(key=lambda pair: pair[1], reverse=True)
        return scored[:top_k]


knowledge_base = KnowledgeBase()
