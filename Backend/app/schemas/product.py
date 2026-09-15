"""Response shape for the product-suggestion (autocomplete) endpoint."""

from pydantic import BaseModel


class ProductSuggestionRead(BaseModel):
    description: str
    usage_count: int
    match_type: str  # "prefix" | "fuzzy"
