from datetime import datetime
import io

import qrcode
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.payment import PaymentStatus
from app.models.user import User
from app.schemas.payment import (
    CreatePaymentRequest,
    CreatePaymentResponse,
    PaymentStatusResponse,
    SubscriptionResponse,
)
from app.services import bakong_service, payment_service


router = APIRouter(
    prefix="/payments",
    tags=["Payments"],
)


# ============================================================
# CREATE SUBSCRIPTION PAYMENT
# ============================================================

@router.post(
    "/subscribe",
    response_model=CreatePaymentResponse,
)
def create_subscription_payment(
    body: CreatePaymentRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a subscription payment and generate a Bakong KHQR.
    """

    payment = payment_service.create_payment(
        db,
        user_id=current_user.user_id,
        plan=body.plan,
    )

    # Start background payment polling — this is what actually calls
    # Bakong and marks the payment paid. Without it, the frontend's
    # GET /status poll only reads the DB, which never changes.
    background_tasks.add_task(
        payment_service.poll_payment_until_resolved,
        payment.id,
    )

    return payment


# ============================================================
# GET PAYMENT STATUS
# ============================================================

@router.get(
    "/{payment_id}/status",
    response_model=PaymentStatusResponse,
)
def get_payment_status(
    payment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get the current payment status.
    """

    payment = payment_service.get_payment(
        db,
        payment_id,
        current_user.user_id,
    )

    if payment is None:
        raise HTTPException(
            status_code=404,
            detail="Payment not found",
        )

    return payment


# ============================================================
# FORCE PAYMENT CHECK
# ============================================================

@router.post(
    "/{payment_id}/check",
    response_model=PaymentStatusResponse,
)
def force_check_payment(
    payment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Immediately check a pending payment with Bakong.
    """

    payment = payment_service.get_payment(
        db,
        payment_id,
        current_user.user_id,
    )

    if payment is None:
        raise HTTPException(
            status_code=404,
            detail="Payment not found",
        )

    # ---------------------------------------------------------
    # Already resolved
    # ---------------------------------------------------------

    if payment.status != PaymentStatus.pending:
        return payment

    # ---------------------------------------------------------
    # Check expiry
    # ---------------------------------------------------------

    if (
        payment.expires_at
        and datetime.utcnow() > payment.expires_at
    ):
        payment_service.mark_expired(
            db,
            payment,
        )

        return payment

    # ---------------------------------------------------------
    # DEBUG: VERIFY QR AND MD5
    # ---------------------------------------------------------

    try:
        calculated_md5 = (
            bakong_service
            .get_khqr_client()
            .generate_md5(payment.qr_string)
        )

        print("====================================")
        print("PAYMENT CONSISTENCY CHECK")
        print("Payment ID:", payment.id)
        print("Stored MD5:", payment.md5_hash)
        print("Calculated MD5:", calculated_md5)
        print(
            "MD5 MATCH:",
            payment.md5_hash == calculated_md5,
        )
        print("====================================")

    except Exception as exc:
        print(
            "MD5 consistency check failed:",
            exc,
        )

    # ---------------------------------------------------------
    # CHECK PAYMENT WITH BAKONG
    # ---------------------------------------------------------

    try:
        status = bakong_service.check_payment_status(
    payment.md5_hash
)



        print("====================================")
        print("BAKONG PAYMENT CHECK")
        print("Payment ID:", payment.id)
        print("MD5:", payment.md5_hash)
        print("Status:", repr(status))
        print("Status type:", type(status))
        print("====================================")

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "Unable to check Bakong payment: "
                f"{str(exc)}"
            ),
        )

    # ---------------------------------------------------------
    # PAYMENT IS NOT PAID
    # ---------------------------------------------------------

    if str(status).strip().upper() != "PAID":
        return payment

    # ---------------------------------------------------------
    # GET TRANSACTION DETAILS
    # ---------------------------------------------------------

    try:
        details = bakong_service.get_payment_details(
            payment.md5_hash
        )

        print("====================================")
        print("BAKONG PAYMENT DETAILS")
        print(details)
        print("====================================")

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "Unable to get Bakong transaction details: "
                f"{str(exc)}"
            ),
        )

    if not details:
        raise HTTPException(
            status_code=502,
            detail="Bakong returned no payment details",
        )

    # ---------------------------------------------------------
    # VERIFY PAYMENT DETAILS
    # ---------------------------------------------------------

    if not payment_service.verify_payment_details(
        payment,
        details,
    ):
        payment.status = PaymentStatus.failed
        db.commit()

        raise HTTPException(
            status_code=400,
            detail="Payment verification failed",
        )

    # ---------------------------------------------------------
    # GET EXTERNAL TRANSACTION REFERENCE
    # ---------------------------------------------------------

    external_ref = (
        details.get("externalRef")
        or details.get("external_ref")
        or details.get("transactionId")
        or details.get("transaction_id")
    )

    # ---------------------------------------------------------
    # MARK PAYMENT AS PAID
    # ---------------------------------------------------------

    payment_service.mark_paid(
        db,
        payment,
        external_ref=external_ref,
    )

    db.refresh(payment)

    return payment


# ============================================================
# GET CURRENT USER SUBSCRIPTION
# ============================================================

@router.get(
    "/subscription/me",
    response_model=SubscriptionResponse,
)
def get_my_subscription(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get the current user's active subscription.
    """

    subscription = payment_service.get_active_subscription(
        db,
        current_user.user_id,
    )

    if subscription is None:
        raise HTTPException(
            status_code=404,
            detail="No subscription found",
        )

    return subscription


# ============================================================
# GET QR IMAGE
# ============================================================

@router.get(
    "/{payment_id}/qr-image",
)
def get_payment_qr_image(
    payment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Convert the stored KHQR string into a PNG image.

    This does NOT create a new KHQR.
    """

    payment = payment_service.get_payment(
        db,
        payment_id,
        current_user.user_id,
    )

    if payment is None:
        raise HTTPException(
            status_code=404,
            detail="Payment not found",
        )

    if not payment.qr_string:
        raise HTTPException(
            status_code=400,
            detail="Payment does not have a QR code",
        )

    img = qrcode.make(
        payment.qr_string
    )

    buffer = io.BytesIO()

    img.save(
        buffer,
        format="PNG",
    )

    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="image/png",
    )