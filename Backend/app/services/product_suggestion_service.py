"""Autocomplete for the manual-entry form.

Separate concern from catalog.py's job even though it reuses the same
matching primitives: catalog.reconcile() corrects what the ASR already wrote
down after the fact, this suggests candidates *while the seller is still
typing* a description into a sale item, so they can pick a past product
instead of retyping "matcha" for the twentieth time.

"Existing product" here means: any description this seller has used on a
past sale item. No separate products table — a seller's own sale history
already is the catalog, and every seller's suggestions stay scoped to their
own sales the same way every other query in transaction_repository does.
"""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.repositories import transaction_repository as repo
from app.services.catalog import normalize, similarity

# Below this, a suggestion is more likely to be noise than the product the
# seller means. Reusing catalog.py's own default keeps "how similar is
# similar enough" answered once, not twice with two opinions that can drift
# apart.
from app.core.config import settings

DEFAULT_LIMIT = 5


@dataclass
class ProductSuggestion:
    description: str
    usage_count: int
    match_type: str  # "prefix" | "fuzzy"
    score: float


def suggest(
    db: Session, user_id: int, query: str, limit: int = DEFAULT_LIMIT
) -> list[ProductSuggestion]:
    """Rank this seller's past product descriptions against a partial typed name.

    Prefix matches always outrank fuzzy ones — if the seller has typed
    "mat" and owns both "Matcha Latte" and a typo-cousin "Macha", the literal
    prefix hit is the one they're almost certainly reaching for. Fuzzy
    matching (via catalog.similarity) only fills remaining slots, catching
    typos or Khmer spacing/encoding variants the same way the voice pipeline
    already does for transcriptions.
    """
    query = (query or "").strip()
    if not query:
        return []

    normalized_query = normalize(query)
    history = repo.product_history(db, user_id)
    if not history:
        return []

    prefix_hits: list[ProductSuggestion] = []
    fuzzy_hits: list[ProductSuggestion] = []

    for description, usage_count, last_used in history:
        normalized_desc = normalize(description)
        if not normalized_desc:
            continue

        if normalized_desc == normalized_query:
            # Exact match isn't a suggestion — the seller already has it.
            continue

        if normalized_desc.startswith(normalized_query):
            prefix_hits.append(
                ProductSuggestion(
                    description=description,
                    usage_count=usage_count,
                    match_type="prefix",
                    score=1.0,
                )
            )
            continue

        score = similarity(query, description)
        if score >= settings.CATALOG_MATCH_THRESHOLD:
            fuzzy_hits.append(
                ProductSuggestion(
                    description=description,
                    usage_count=usage_count,
                    match_type="fuzzy",
                    score=score,
                )
            )

    # Within each tier: most-used product first (that's the one worth saving
    # keystrokes on), then higher fuzzy confidence breaks remaining ties.
    prefix_hits.sort(key=lambda hit: hit.usage_count, reverse=True)
    fuzzy_hits.sort(key=lambda hit: (hit.score, hit.usage_count), reverse=True)

    return (prefix_hits + fuzzy_hits)[:limit]
