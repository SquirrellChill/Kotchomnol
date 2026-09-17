"""Authentication endpoints.

Supabase Auth handles:
- User registration
- Email verification
- Login
- Password reset

FastAPI handles:
- Local user profile synchronization
- Phone number validation
- Profile updates
- Avatar uploads
- Authenticated password changes
"""

import os
import shutil

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from supabase_auth.errors import AuthApiError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import decode_supabase_token
from app.core.supabase_client import (
    get_supabase,
    get_supabase_admin,
)
from app.models.user import User
from app.repositories import user_repository as user_repo
from app.schemas.user import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    GoogleSyncRequest,
    LoginRequest,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    UpdateProfileRequest,
    UserOut,
    VerifyEmailRequest,

)


router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)


UPLOAD_DIR = "uploads/avatars"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ============================================================
# REGISTER
# ============================================================

@router.post("/register")
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
):
    """
    Register a new user through Supabase Auth.

    Supabase sends the email verification email.

    The local users table stores the user's profile.
    """

    # --------------------------------------------------------
    # Check phone number
    # --------------------------------------------------------

    if payload.phone_number:
        phone_user = user_repo.find_user_by_phone_number(
            db,
            payload.phone_number,
        )

        if (
            phone_user
            and phone_user.email != payload.email
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "This phone number is already "
                    "registered with another account."
                ),
            )

    # --------------------------------------------------------
    # Create Supabase Auth account
    # --------------------------------------------------------

    try:
        result = get_supabase().auth.sign_up(
            {
                "email": payload.email,
                "password": payload.password,
                "options": {
                    "data": {
                        "first_name": payload.first_name,
                        "last_name": payload.last_name,
                    }
                },
            }
        )

    except AuthApiError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=exc.message,
        ) from exc

    # --------------------------------------------------------
    # Make sure Supabase returned a user
    # --------------------------------------------------------

    if not result.user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create account.",
        )

    supabase_user_id = result.user.id

    # --------------------------------------------------------
    # Check whether local profile already exists
    # --------------------------------------------------------

    existing_user = user_repo.find_user_by_email(
        db,
        payload.email,
    )

    if existing_user:

        existing_user.first_name = (
            payload.first_name
        )

        existing_user.last_name = (
            payload.last_name
        )

        existing_user.phone_number = (
            payload.phone_number
        )

        existing_user.supabase_user_id = (
            supabase_user_id
        )

        try:
            user_repo.save_user(
                db,
                existing_user,
            )

        except IntegrityError:
            db.rollback()

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "This phone number is already "
                    "registered with another account."
                ),
            )

    else:

        # ----------------------------------------------------
        # Create local profile
        # ----------------------------------------------------

        try:
            user_repo.create_user(
                db,
                first_name=payload.first_name,
                last_name=payload.last_name,
                phone_number=payload.phone_number,
                email=payload.email,
                supabase_user_id=supabase_user_id,
            )

        except IntegrityError:
            db.rollback()

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "An account with this phone number "
                    "or email already exists."
                ),
            )

    # --------------------------------------------------------
    # IMPORTANT:
    #
    # Supabase Auth sends the verification email.
    # We do NOT call email_service.py here.
    # --------------------------------------------------------

    return {
        "success": True,
        "message": (
            "Registration successful. "
            "Please check your email for "
            "your verification code."
        ),
        "data": {
            "requires_email_verification": True
        },
    }

# ============================================================
# GOOGLE OAUTH SYNC
# ============================================================

@router.post("/google-sync")
def google_sync(
    payload: GoogleSyncRequest,
    db: Session = Depends(get_db),
):
    """
    Called right after Supabase Google OAuth succeeds, before the
    frontend uses the token anywhere else. Ensures a local `users`
    row exists for this Supabase account, the same way /register does
    for email/password sign-ups.
    """
    try:
        claims = decode_supabase_token(payload.access_token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google session token.",
        ) from exc

    supabase_user_id = claims.get("sub")
    email = claims.get("email")
    user_metadata = claims.get("user_metadata", {}) or {}

    if not supabase_user_id:
        raise HTTPException(status_code=400, detail="Token missing subject.")

    user = user_repo.find_user_by_supabase_id(db, supabase_user_id)

    if user is None:
        if email:
            user = user_repo.find_user_by_email(db, email)

        if user:
            user.supabase_user_id = supabase_user_id
            user = user_repo.save_user(db, user)
        else:
            user = user_repo.create_user(
                db,
                first_name=user_metadata.get("first_name") or user_metadata.get("given_name") or "",
                last_name=user_metadata.get("last_name") or user_metadata.get("family_name") or "",
                phone_number=None,
                email=email,
                supabase_user_id=supabase_user_id,
            )
            user.is_verified = True
            user = user_repo.save_user(db, user)

    return {
        "success": True,
        "data": {"user": UserOut.model_validate(user)},
    }
# ============================================================
# VERIFY EMAIL
# ============================================================
@router.post("/verify-email")
def verify_email(
    payload: VerifyEmailRequest,
    db: Session = Depends(get_db),
):
    """
    Verify a user's email using the Supabase signup OTP.
    """

    email = payload.email.strip().lower()
    code = payload.code.strip()

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is required.",
        )

    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code is required.",
        )

    try:
        result = get_supabase().auth.verify_otp(
            {
                "email": email,
                "token": code,
                "type": "signup",
            }
        )

    except AuthApiError as exc:
        message = str(exc.message).lower()

        if "expired" in message:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "This verification code has expired. "
                    "Please request a new code."
                ),
            ) from exc

        if "invalid" in message:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Invalid verification code. "
                    "Please check the latest code in your email."
                ),
            ) from exc

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.message,
        ) from exc

    # --------------------------------------------------------
    # Mark local user as verified
    # --------------------------------------------------------

    user = user_repo.find_user_by_email(
        db,
        email,
    )

    if user:
        user.is_verified = True

        user_repo.save_user(
            db,
            user,
        )

    return {
        "success": True,
        "message": "Email verified successfully.",
    }# ============================================================
# RESEND VERIFICATION
# ============================================================

@router.post("/resend-verification")
def resend_verification(
    payload: ResendVerificationRequest,
):
    """
    Resend Supabase signup verification OTP.
    """

    email = payload.email.strip().lower()

    try:
        get_supabase().auth.resend(
            {
                "type": "signup",
                "email": email,
            }
        )

    except AuthApiError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.message,
        ) from exc

    return {
        "success": True,
        "message": (
            "A new verification code has been sent "
            "to your email."
        ),
    }
# ============================================================
# LOGIN
# ============================================================

@router.post("/login")
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
):
    """
    Login through Supabase Auth.
    """

    try:
        result = (
            get_supabase()
            .auth
            .sign_in_with_password(
                {
                    "email": payload.email,
                    "password": payload.password,
                }
            )
        )

    except AuthApiError as exc:

        # User hasn't verified email
        if "confirm" in exc.message.lower():

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Please verify your email "
                    "before logging in."
                ),
            ) from exc

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        ) from exc

    # --------------------------------------------------------
    # Find local profile
    # --------------------------------------------------------

    user = user_repo.find_user_by_supabase_id(
        db,
        result.user.id,
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "No profile found for this account."
            ),
        )

    # --------------------------------------------------------
    # Synchronize verification status
    # --------------------------------------------------------

    if not user.is_verified:

        user.is_verified = True

        user_repo.save_user(
            db,
            user,
        )

    return {
        "success": True,
        "message": "Login successful",
        "data": {
            "token": result.session.access_token,
            "user": UserOut.model_validate(user),
        },
    }


# ============================================================
# LOGOUT
# ============================================================

@router.post("/logout")
def logout(
    current_user: User = Depends(get_current_user),
):
    return {
        "success": True,
        "message": "Logged out successfully",
    }


# ============================================================
# GET CURRENT USER
# ============================================================

@router.get("/me")
def get_me(
    current_user: User = Depends(get_current_user),
):
    return {
        "success": True,
        "data": {
            "user": UserOut.model_validate(
                current_user
            )
        },
    }


# ============================================================
# UPDATE PROFILE
# ============================================================

@router.put("/me")
def update_me(
    payload: UpdateProfileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update the local profile.

    Changing email here does not change the
    Supabase Auth email.
    """

    # --------------------------------------------------------
    # Check email
    # --------------------------------------------------------

    if (
        payload.email
        and payload.email != current_user.email
    ):
        existing = user_repo.find_user_by_email(
            db,
            payload.email,
        )

        if (
            existing
            and existing.user_id
            != current_user.user_id
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "An account with this email "
                    "already exists."
                ),
            )

    # --------------------------------------------------------
    # Check phone
    # --------------------------------------------------------

    if (
        payload.phone_number
        != current_user.phone_number
    ):
        existing = (
            user_repo.find_user_by_phone_number(
                db,
                payload.phone_number,
            )
        )

        if (
            existing
            and existing.user_id
            != current_user.user_id
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "An account with this phone number "
                    "already exists."
                ),
            )

    # --------------------------------------------------------
    # Update profile
    # --------------------------------------------------------

    current_user.first_name = (
        payload.first_name
    )

    current_user.last_name = (
        payload.last_name
    )

    current_user.phone_number = (
        payload.phone_number
    )

    current_user.email = payload.email

    if payload.profile_picture is not None:
        current_user.profile_picture = (
            payload.profile_picture
        )

    try:
        saved_user = user_repo.save_user(
            db,
            current_user,
        )

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "A user with these details "
                "already exists."
            ),
        )

    return {
        "success": True,
        "message": "Profile updated successfully",
        "data": {
            "user": UserOut.model_validate(
                saved_user
            )
        },
    }


# ============================================================
# UPLOAD AVATAR
# ============================================================

@router.post("/me/avatar")
def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload profile avatar.
    """

    ext = os.path.splitext(
        file.filename or ""
    )[1].lower()

    allowed_extensions = [
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
    ]

    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Only image files "
                "(.jpg, .jpeg, .png, .webp) "
                "are allowed."
            ),
        )

    file_name = (
        f"user_{current_user.user_id}{ext}"
    )

    file_path = os.path.join(
        UPLOAD_DIR,
        file_name,
    )

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(
            file.file,
            buffer,
        )

    avatar_url = (
        f"/uploads/avatars/{file_name}"
    )

    current_user.profile_picture = avatar_url

    user_repo.save_user(
        db,
        current_user,
    )

    return {
        "success": True,
        "message": "Avatar updated successfully",
        "data": {
            "user": UserOut.model_validate(
                current_user
            )
        },
    }


# ============================================================
# CHANGE PASSWORD
# ============================================================

@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Change password for an authenticated user.

    First verifies the current password through
    Supabase Auth, then updates the new password
    using the Supabase Admin API.
    """

    if not current_user.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "This account has no password-based "
                "login to change."
            ),
        )

    if not current_user.supabase_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "This account is not linked "
                "to Supabase Auth."
            ),
        )

    # --------------------------------------------------------
    # Verify current password
    # --------------------------------------------------------

    try:
        get_supabase().auth.sign_in_with_password(
            {
                "email": current_user.email,
                "password": payload.current_password,
            }
        )

    except AuthApiError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        ) from exc

    # --------------------------------------------------------
    # Update password
    # --------------------------------------------------------

    try:
        get_supabase_admin().auth.admin.update_user_by_id(
            str(current_user.supabase_user_id),
            {
                "password": payload.new_password
            },
        )

    except AuthApiError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.message,
        ) from exc

    return {
        "success": True,
        "message": "Password changed successfully.",
    }


# ============================================================
# FORGOT PASSWORD
# ============================================================

@router.post("/forgot-password")
def forgot_password(
    payload: ForgotPasswordRequest,
):
    """
    Ask Supabase to send the password reset email.
    """

    generic_response = {
        "success": True,
        "message": (
            "If email exists, reset link sent."
        ),
    }

    try:
        get_supabase().auth.reset_password_for_email(
            payload.email
        )

    except AuthApiError:
        # Don't reveal whether the email exists.
        pass

    return generic_response


# ============================================================
# RESET PASSWORD
# ============================================================

@router.post("/reset-password")
def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    """
    Reset password using the Supabase
    password recovery access token.
    """

    # --------------------------------------------------------
    # Decode and validate token
    # --------------------------------------------------------

    try:
        claims = decode_supabase_token(
            payload.access_token
        )

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token invalid or expired.",
        ) from exc

    supabase_user_id = claims.get("sub")

    if not supabase_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token invalid or expired.",
        )

    # --------------------------------------------------------
    # Update Supabase password
    # --------------------------------------------------------

    try:
        get_supabase_admin().auth.admin.update_user_by_id(
            supabase_user_id,
            {
                "password": payload.password
            },
        )

    except AuthApiError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.message,
        ) from exc

    # --------------------------------------------------------
    # Find local profile
    # --------------------------------------------------------

    user = user_repo.find_user_by_supabase_id(
        db,
        supabase_user_id,
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No profile found for this account.",
        )

    return {
        "success": True,
        "message": "Password reset successful",
        "data": {
            "token": payload.access_token
        },
    }

from app.schemas.user import GoogleSyncRequest  # add: access_token: str

@router.post("/google-sync")
def google_sync(
    payload: GoogleSyncRequest,
    db: Session = Depends(get_db),
):
    """
    Called right after Supabase Google OAuth succeeds, before the
    frontend uses the token anywhere else. Ensures a local `users`
    row exists for this Supabase account, the same way /register does
    for email/password sign-ups.
    """
    try:
        claims = decode_supabase_token(payload.access_token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google session token.",
        ) from exc

    supabase_user_id = claims.get("sub")
    email = claims.get("email")
    user_metadata = claims.get("user_metadata", {}) or {}

    if not supabase_user_id:
        raise HTTPException(status_code=400, detail="Token missing subject.")

    user = user_repo.find_user_by_supabase_id(db, supabase_user_id)

    if user is None:
        # Also check by email, in case they'd registered with password before.
        if email:
            user = user_repo.find_user_by_email(db, email)

        if user:
            user.supabase_user_id = supabase_user_id
            user_repo.save_user(db, user)
        else:
            user = user_repo.create_user(
                db,
                first_name=user_metadata.get("first_name") or user_metadata.get("given_name") or "",
                last_name=user_metadata.get("last_name") or user_metadata.get("family_name") or "",
                phone_number=None,
                email=email,
                supabase_user_id=supabase_user_id,
            )
            user.is_verified = True  # Google already verified the email
            user_repo.save_user(db, user)

    return {
        "success": True,
        "data": {"user": UserOut.model_validate(user)},
    }