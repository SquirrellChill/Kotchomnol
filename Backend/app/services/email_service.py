import hashlib
import logging
import secrets
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, formatdate, make_msgid

from app.core.config import settings


logger = logging.getLogger("email_service")


# ============================================================
# SMTP EMAIL SENDER
# ============================================================

def _send_email(
    to_email: str,
    subject: str,
    body: str,
    html_body: str | None = None,
) -> bool:
    """
    Send an email using Gmail SMTP.

    Returns:
        True  -> email sent successfully
        False -> email failed
    """

    # Always print the email information in the terminal.
    # This is useful during local development/testing.
    print("\n" + "=" * 60)
    print("📧 [OUTGOING EMAIL DISPATCH]")
    print(f"To: {to_email}")
    print(f"Subject: {subject}")
    print(f"Content:\n{body}")
    print("=" * 60)

    # --------------------------------------------------------
    # Check SMTP configuration
    # --------------------------------------------------------

    if not settings.MAIL_SERVER:
        print("❌ [EMAIL ERROR] MAIL_SERVER is not configured.")
        return False

    from_name = getattr(
        settings,
        "MAIL_FROM_NAME",
        "KotChomnol",
    )

    from_email = (
        settings.MAIL_FROM
        or settings.MAIL_USERNAME
    )

    if not from_email:
        print(
            "❌ [EMAIL ERROR] "
            "MAIL_FROM and MAIL_USERNAME are both empty."
        )
        return False

    # --------------------------------------------------------
    # Create email message
    # --------------------------------------------------------

    msg = MIMEMultipart("alternative")

    msg["Subject"] = subject

    msg["From"] = formataddr(
        (
            from_name,
            from_email,
        )
    )

    msg["To"] = to_email

    msg["Date"] = formatdate(
        localtime=True
    )

    msg["Message-ID"] = make_msgid()

    # Plain text version
    msg.attach(
        MIMEText(
            body,
            "plain",
            "utf-8",
        )
    )

    # HTML version
    if html_body:
        msg.attach(
            MIMEText(
                html_body,
                "html",
                "utf-8",
            )
        )

    # --------------------------------------------------------
    # Send using SMTP
    # --------------------------------------------------------

    try:
        port = int(
            settings.MAIL_PORT or 587
        )

        print(
            f"📡 Connecting to "
            f"{settings.MAIL_SERVER}:{port}..."
        )

        with smtplib.SMTP(
            settings.MAIL_SERVER,
            port,
            timeout=15,
        ) as server:

            server.ehlo()

            print("🔐 Starting TLS...")

            server.starttls()

            server.ehlo()

            # Login if credentials are configured
            if (
                settings.MAIL_USERNAME
                and settings.MAIL_PASSWORD
            ):
                print(
                    f"🔑 Logging in as "
                    f"{settings.MAIL_USERNAME}..."
                )

                # Gmail App Passwords sometimes get copied
                # with spaces. Remove them defensively.
                clean_password = (
                    settings.MAIL_PASSWORD
                    .replace(" ", "")
                )

                server.login(
                    settings.MAIL_USERNAME,
                    clean_password,
                )

                print("✅ SMTP authentication successful.")

            else:
                print(
                    "⚠️ SMTP username/password "
                    "are not configured."
                )

            # Send email
            server.sendmail(
                from_email,
                [to_email],
                msg.as_string(),
            )

        print(
            f"✅ Email sent successfully to "
            f"{to_email}"
        )

        return True

    except smtplib.SMTPAuthenticationError as exc:
        print(
            "❌ [SMTP AUTH ERROR] "
            "Gmail rejected the username/password."
        )
        print(f"Details: {exc}")
        print(
            "Make sure MAIL_PASSWORD is a "
            "Gmail App Password."
        )
        return False

    except smtplib.SMTPConnectError as exc:
        print(
            "❌ [SMTP CONNECTION ERROR] "
            "Could not connect to Gmail SMTP."
        )
        print(f"Details: {exc}")
        return False

    except smtplib.SMTPException as exc:
        print(
            "❌ [SMTP ERROR] "
            f"{type(exc).__name__}: {exc}"
        )
        return False

    except Exception as exc:
        print(
            "❌ [EMAIL ERROR] "
            f"{type(exc).__name__}: {exc}"
        )
        return False


# ============================================================
# OTP GENERATION
# ============================================================

def generate_otp() -> str:
    """
    Generate a cryptographically secure 6-digit OTP.
    """

    return str(
        secrets.randbelow(900000) + 100000
    )


# ============================================================
# OTP HASHING
# ============================================================

def hash_otp(
    otp: str,
) -> str:
    """
    Hash OTP using SHA-256 before storing it.
    """

    return hashlib.sha256(
        otp.encode("utf-8")
    ).hexdigest()


# ============================================================
# VERIFY OTP
# ============================================================

def verify_otp_hash(
    otp: str,
    hashed: str,
) -> bool:
    """
    Verify a plain OTP against its SHA-256 hash.
    """

    return (
        hashlib.sha256(
            otp.encode("utf-8")
        ).hexdigest()
        == hashed
    )


# ============================================================
# EMAIL VERIFICATION
# ============================================================

def send_verification_email(
    to_email: str,
    code: str,
    first_name: str,
) -> bool:
    """
    Send account verification OTP email.
    """

    subject = (
        "Your Verification Code - KotChomnol"
    )

    # --------------------------------------------------------
    # Plain text email
    # --------------------------------------------------------

    body = (
        f"Hi {first_name},\n\n"
        f"Welcome to KotChomnol!\n\n"
        f"Your verification code is: {code}\n\n"
        f"This code will expire in 15 minutes.\n\n"
        f"If you did not create an account, "
        f"please ignore this email.\n\n"
        f"Best regards,\n"
        f"KotChomnol Team"
    )

    # --------------------------------------------------------
    # HTML email
    # --------------------------------------------------------

    html_body = f"""
    <!DOCTYPE html>

    <html>
    <head>
        <meta charset="UTF-8">
        <title>KotChomnol Verification Code</title>
    </head>

    <body style="
        margin: 0;
        padding: 0;
        background-color: #f9fafb;
        font-family:
            Arial,
            Helvetica,
            sans-serif;
    ">

        <div style="
            max-width: 540px;
            margin: 40px auto;
            padding: 24px;
        ">

            <div style="
                background-color: #ffffff;
                border: 1px solid #e9d5ff;
                border-radius: 16px;
                padding: 32px;
            ">

                <!-- Logo -->
                <div style="
                    margin-bottom: 24px;
                ">

                    <span style="
                        display: inline-block;
                        background-color: #7e22ce;
                        color: #ffffff;
                        padding: 8px 14px;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: 700;
                        letter-spacing: 1px;
                    ">
                        KOTCHOMNOL
                    </span>

                </div>

                <!-- Title -->

                <h2 style="
                    color: #1e1b4b;
                    margin: 0 0 12px 0;
                    font-size: 22px;
                ">
                    Welcome, {first_name}! 👋
                </h2>

                <!-- Description -->

                <p style="
                    color: #4b5563;
                    font-size: 14px;
                    line-height: 1.6;
                    margin-bottom: 24px;
                ">
                    Please use the verification code
                    below to verify your email address
                    and activate your KotChomnol account.
                </p>

                <!-- OTP -->

                <div style="
                    text-align: center;
                    margin: 30px 0;
                ">

                    <span style="
                        display: inline-block;
                        background-color: #f3e8ff;
                        color: #7e22ce;
                        border: 1px solid #d8b4fe;
                        border-radius: 12px;
                        padding: 16px 28px;
                        font-size: 32px;
                        font-weight: 800;
                        letter-spacing: 8px;
                    ">
                        {code}
                    </span>

                </div>

                <!-- Expiration -->

                <p style="
                    color: #6b7280;
                    font-size: 13px;
                    line-height: 1.6;
                ">
                    This verification code will expire
                    in <strong>15 minutes</strong>.
                </p>

                <hr style="
                    border: none;
                    border-top: 1px solid #f3e8ff;
                    margin: 24px 0;
                ">

                <!-- Security notice -->

                <p style="
                    color: #9ca3af;
                    font-size: 12px;
                    line-height: 1.6;
                    margin: 0;
                ">
                    If you did not register for
                    KotChomnol, you can safely
                    ignore this email.
                </p>

            </div>

        </div>

    </body>
    </html>
    """

    return _send_email(
        to_email=to_email,
        subject=subject,
        body=body,
        html_body=html_body,
    )


# ============================================================
# PASSWORD RESET EMAIL
# ============================================================

def send_password_reset_email(
    to_email: str,
    reset_token: str,
    first_name: str,
) -> bool:
    """
    Send password reset email.
    """

    frontend_base = (
        settings.FRONTEND_URL
        .split(",")[0]
        .strip()
        .rstrip("/")
    )

    reset_link = (
        f"{frontend_base}"
        f"/reset-password"
        f"?token={reset_token}"
    )

    subject = (
        "Reset Your Password - KotChomnol"
    )

    # --------------------------------------------------------
    # Plain text
    # --------------------------------------------------------

    body = (
        f"Hi {first_name},\n\n"
        f"You requested to reset your "
        f"KotChomnol password.\n\n"
        f"Click the link below to reset "
        f"your password:\n\n"
        f"{reset_link}\n\n"
        f"This link expires in 30 minutes.\n\n"
        f"If you did not request this, "
        f"please ignore this email."
    )

    # --------------------------------------------------------
    # HTML
    # --------------------------------------------------------

    html_body = f"""
    <!DOCTYPE html>

    <html>
    <head>
        <meta charset="UTF-8">
        <title>Reset Your Password</title>
    </head>

    <body style="
        margin: 0;
        padding: 0;
        background-color: #f9fafb;
        font-family:
            Arial,
            Helvetica,
            sans-serif;
    ">

        <div style="
            max-width: 540px;
            margin: 40px auto;
            padding: 24px;
        ">

            <div style="
                background-color: #ffffff;
                border: 1px solid #e9d5ff;
                border-radius: 16px;
                padding: 32px;
            ">

                <div style="
                    margin-bottom: 24px;
                ">

                    <span style="
                        display: inline-block;
                        background-color: #7e22ce;
                        color: #ffffff;
                        padding: 8px 14px;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: 700;
                        letter-spacing: 1px;
                    ">
                        KOTCHOMNOL
                    </span>

                </div>

                <h2 style="
                    color: #1e1b4b;
                    margin-bottom: 12px;
                ">
                    Reset Your Password
                </h2>

                <p style="
                    color: #4b5563;
                    line-height: 1.6;
                ">
                    Hi {first_name},
                </p>

                <p style="
                    color: #4b5563;
                    line-height: 1.6;
                ">
                    You requested to reset your
                    KotChomnol password.
                </p>

                <div style="
                    text-align: center;
                    margin: 30px 0;
                ">

                    <a
                        href="{reset_link}"
                        style="
                            display: inline-block;
                            background-color: #7e22ce;
                            color: #ffffff;
                            padding: 13px 28px;
                            border-radius: 10px;
                            text-decoration: none;
                            font-weight: 700;
                        "
                    >
                        Reset Password
                    </a>

                </div>

                <p style="
                    color: #6b7280;
                    font-size: 13px;
                ">
                    This link expires in
                    <strong>30 minutes</strong>.
                </p>

                <hr style="
                    border: none;
                    border-top: 1px solid #f3e8ff;
                    margin: 24px 0;
                ">

                <p style="
                    color: #9ca3af;
                    font-size: 12px;
                ">
                    If you did not request this,
                    please ignore this email.
                </p>

            </div>

        </div>

    </body>
    </html>
    """

    return _send_email(
        to_email=to_email,
        subject=subject,
        body=body,
        html_body=html_body,
    )


# ============================================================
# PASSWORD CHANGE OTP
# ============================================================

def send_password_change_otp_email(
    to_email: str,
    code: str,
    first_name: str | None = None,
) -> bool:
    """
    Send OTP for changing account password.
    """

    name = (
        first_name
        or "KotChomnol User"
    )

    subject = (
        "Password Change Verification "
        "Code - KotChomnol"
    )

    body = (
        f"Hi {name},\n\n"
        f"You requested to change your "
        f"KotChomnol password.\n\n"
        f"Your verification code is: {code}\n\n"
        f"This code will expire in 15 minutes.\n\n"
        f"If you did not request this change, "
        f"please secure your account."
    )

    html_body = f"""
    <!DOCTYPE html>

    <html>
    <head>
        <meta charset="UTF-8">
        <title>Password Change Verification</title>
    </head>

    <body style="
        margin: 0;
        padding: 0;
        background-color: #f9fafb;
        font-family:
            Arial,
            Helvetica,
            sans-serif;
    ">

        <div style="
            max-width: 540px;
            margin: 40px auto;
            padding: 24px;
        ">

            <div style="
                background-color: #ffffff;
                border: 1px solid #e9d5ff;
                border-radius: 16px;
                padding: 32px;
            ">

                <span style="
                    display: inline-block;
                    background-color: #7e22ce;
                    color: #ffffff;
                    padding: 8px 14px;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 700;
                ">
                    KOTCHOMNOL
                </span>

                <h2 style="
                    color: #1e1b4b;
                    margin-top: 24px;
                ">
                    Password Change Verification
                </h2>

                <p style="
                    color: #4b5563;
                    line-height: 1.6;
                ">
                    Hi <strong>{name}</strong>,
                </p>

                <p style="
                    color: #4b5563;
                    line-height: 1.6;
                ">
                    Enter the verification code below
                    to authorize changing your password.
                </p>

                <div style="
                    text-align: center;
                    margin: 30px 0;
                ">

                    <span style="
                        display: inline-block;
                        background-color: #f3e8ff;
                        color: #7e22ce;
                        border: 1px solid #d8b4fe;
                        border-radius: 12px;
                        padding: 16px 28px;
                        font-size: 32px;
                        font-weight: 800;
                        letter-spacing: 8px;
                    ">
                        {code}
                    </span>

                </div>

                <p style="
                    color: #6b7280;
                    font-size: 13px;
                ">
                    This code expires in
                    <strong>15 minutes</strong>.
                </p>

                <hr style="
                    border: none;
                    border-top: 1px solid #f3e8ff;
                    margin: 24px 0;
                ">

                <p style="
                    color: #9ca3af;
                    font-size: 12px;
                ">
                    If you did not make this request,
                    someone may be trying to access
                    your account.
                </p>

            </div>

        </div>

    </body>
    </html>
    """

    return _send_email(
        to_email=to_email,
        subject=subject,
        body=body,
        html_body=html_body,
    )