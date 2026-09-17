"""schemas/payment.py — add to your `schemas/` folder."""

from datetime import datetime
from pydantic import BaseModel
from app.models.payment import PlanType, PaymentStatus, SubscriptionStatus  # adjust import path if needed
from uuid import UUID

PLAN_PRICES_USD = {
    PlanType.starter: 2.99,
    PlanType.business: 24.99,
}


class CreatePaymentRequest(BaseModel):
    plan: PlanType


class CreatePaymentResponse(BaseModel):
    id: UUID
    plan: PlanType
    amount: float
    currency: str
    qr_string: str          # render this client-side as a QR code (e.g. with a qrcode.js lib)
    deeplink: str | None = None   # "Open in Bakong app" button link — can be None if Bakong's deeplink API fails
    md5_hash: str
    expires_at: datetime
    status: PaymentStatus

    class Config:
        from_attributes = True


class PaymentStatusResponse(BaseModel):
    id: UUID
    status: PaymentStatus
    paid_at: datetime | None = None

    class Config:
        from_attributes = True


class SubscriptionResponse(BaseModel):
    plan: PlanType
    status: SubscriptionStatus
    current_period_end: datetime

    class Config:
        from_attributes = True

