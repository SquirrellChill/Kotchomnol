"""Product autocomplete for the manual sale-entry form."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.product import ProductSuggestionRead
from app.services import product_suggestion_service as service

router = APIRouter(prefix="/products", tags=["products"])


@router.get("/suggest", response_model=list[ProductSuggestionRead])
def suggest_products(
    q: str = Query(..., min_length=1, max_length=500),
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Past product descriptions matching what this seller is typing.

    Scoped to the authenticated seller only — one seller's product names
    never appear in another seller's suggestions.
    """
    suggestions = service.suggest(db, current_user.user_id, q, limit)
    return [
        ProductSuggestionRead(
            description=hit.description,
            usage_count=hit.usage_count,
            match_type=hit.match_type,
        )
        for hit in suggestions
    ]
