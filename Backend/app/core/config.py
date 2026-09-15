"""
App configuration, loaded from environment variables / .env file.

Three kinds of thing live here:
  1. Settings  — values from .env that differ between dev and production
  2. Constants — domain facts that never differ (riel is riel everywhere)
  3. Gemini    — the shared client and retry policy for the voice pipeline
"""

import time
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Supabase connection string, e.g.
    # postgresql+psycopg2://postgres.xxxx:password@aws-x-region.pooler.supabase.com:5432/postgres
    # (Project Settings > Database > Connection string > URI, swapped to the
    # psycopg2 dialect prefix SQLAlchemy expects).
    DATABASE_URL: str = "postgresql+psycopg2://postgres:password@localhost:5432/postgres"
    BACKEND_BASE_URL: str = "http://127.0.0.1:8000"
    SECRET_KEY: str = "change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    REQUIRE_EMAIL_VERIFICATION: bool = True

    # --- Supabase --------------------------------------------------------
    # Auth is now owned by Supabase: signup, email verification, password
    # reset, and JWT issuance all go through it instead of the hand-rolled
    # OTP/JWT code in token_service.py and security.py. Those files are kept
    # for reference but are no longer called from the auth routes.
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    # Service-role key. Bypasses row-level security — used ONLY for the
    # Telegram shadow-account admin calls in auth_telegram.py. Never send
    # this to a frontend.
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    # Same secret Supabase signs its own JWTs with (Project Settings > API >
    # JWT Settings). get_current_user verifies every request against this,
    # and Telegram logins mint tokens signed with it too, so both paths
    # produce a JWT indistinguishable from one Supabase issued itself.
    SUPABASE_JWT_SECRET: str = ""

    # SMTP. Leave MAIL_SERVER blank to print emails to the console instead.
    # These were previously declared twice, and the second set had no
    # defaults — which silently made them required and stopped the app
    # booting without them in .env. Declared once now, with defaults.
    MAIL_SERVER: str = "smtp.gmail.com"
    MAIL_PORT: int = 587
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = "no-reply@kotchomnol.app"

    # Used to build the password reset link sent by email
    # Comma-separated frontend origins allowed to call the API.
    FRONTEND_URL: str = "http://localhost:5173"

    # Telegram Login (leave the client ID blank to disable Telegram Login)
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_BOT_USERNAME: str = ""
    TELEGRAM_CLIENT_ID: str = ""

    # SMS provider (False = print OTP codes to console instead of sending)
    SMS_PROVIDER_ENABLED: bool = False

    # --- Voice pipeline: models ------------------------------------------
    GEMINI_API_KEY: str = ""

    # How the transcriber talks to Gemini:
    #   prompted   generate_content with an explicit transcription prompt
    #   transcribe the dedicated endpoint, which takes no prompt field
    # Stay on "prompted" — the dedicated endpoint can't be given the domain
    # context or the seller's product names, and that biasing is the biggest
    # single lever on Khmer product-name accuracy. Swapping to Smean later
    # means adding a third branch in transcriber.py ONLY.
    ASR_BACKEND: str = "prompted"
    ASR_PROMPTED_MODEL: str = "gemini-3.5-flash-lite"
    ASR_TRANSCRIBE_MODEL: str = "gemini-3.5-transcribe"
    EXTRACTION_MODEL: str = "gemini-3.5-flash-lite"

    # 0 makes the same audio produce the same record every run. Without it,
    # an evaluation set measures sampling noise instead of the prompt.
    TEMPERATURE: float = 0.0

    # --- Voice pipeline: limits ------------------------------------------
    # Hard cap on follow-up questions before falling back to manual entry.
    # The one-time confirmation step is separate and isn't counted here.
    MAX_FOLLOWUP_ATTEMPTS: int = 3

    # Guard against a model hallucinating a runaway list of products.
    MAX_ITEMS: int = 10

    # Past product names fed into the transcription prompt as bias. Each is
    # an input token on every recording, so this is capped.
    MAX_CATALOG_HINTS: int = 40

    # Similarity above which a transcribed name is treated as a known
    # product. Raise it if wrong products get matched, lower it if obvious
    # near-misses are missed. catalog.py raises it further for short names,
    # where two unrelated products can score high by accident.
    CATALOG_MATCH_THRESHOLD: float = 0.72

    # --- Voice pipeline: inference ---------------------------------------
    # Sellers rarely say the currency out loud, because the amount implies
    # it: nobody sells a coffee for $4000, nobody prices anything at 3 riel.
    # Asking every time is tedious, so infer where the magnitude leaves no
    # real doubt. Set False to ask every time instead.
    CURRENCY_INFER: bool = True
    KHR_MIN_PRICE: float = 1000   # at or above this, a bare number is riel
    USD_MAX_PRICE: float = 99     # at or below this, it's dollars
    # Between the two is genuinely ambiguous — 500 could be 500 riel — so
    # that range still gets asked about.

    # Assumed when the seller doesn't say. Cash dominates for small sellers
    # and asking after every sale is exhausting; the assumption is always
    # reported so the confirmation screen can show it.
    DEFAULT_PAYMENT_METHOD: str = "cash"

    # --- Voice pipeline: network -----------------------------------------
    # Free tier returns 429 (rate limit) and 503 (overloaded) regularly.
    # Bounded backoff only — an unbounded retry loop is where worst-case
    # latency hides.
    MAX_RETRIES: int = 2
    RETRY_BASE_DELAY_S: float = 0.75

    # --- Bakong KHQR ---
    BAKONG_TOKEN: str                      # Bakong Open API developer token (get from https://api-bakong.nbc.gov.kh)
    BAKONG_ACCOUNT_ID: str                  # e.g. "your_username@bank" (from Bakong app profile)
    BAKONG_MERCHANT_NAME: str = "KotChomnol"
    BAKONG_MERCHANT_CITY: str = "Phnom Penh"
    KHQR_CURRENCY: str = "USD"              # "USD" or "KHR"
    KHQR_EXPIRE_MINUTES: int = 5            # how long a generated QR stays valid
    KHQR_POLL_INTERVAL_SECONDS: int = 5     # how often background task calls Bakong to check payment status


    class Config:
        env_file = ".env"


settings = Settings()
print("SUPABASE_URL:", settings.SUPABASE_URL)
print("SUPABASE_ANON_KEY configured:", bool(settings.SUPABASE_ANON_KEY))
print("SUPABASE_SERVICE_ROLE_KEY configured:", bool(settings.SUPABASE_SERVICE_ROLE_KEY))

# ==========================================================================
# Record schema — domain facts, not settings.
# These would never differ between dev and production, so they aren't
# environment variables.
# ==========================================================================

# Per line item. `date` belongs to the sale as a whole, not to a line.
LINE_FIELDS = ("item", "quantity", "unit", "price", "currency", "price_basis")

# Always asked about if missing.
REQUIRED_FIELDS = ("item", "quantity", "price")

# Asked about only once a price exists. A bare number with no currency is
# worse than a missing one — it silently mixes riel and dollars in the same
# column and every total computed from it is wrong.
CONDITIONAL_FIELDS = {"currency": "price"}

# Not asked about. `unit` is descriptive, and `price_basis` is a binary the
# confirmation screen can toggle far more cheaply than a spoken follow-up.
OPTIONAL_FIELDS = ("unit", "price_basis")

VALID_CURRENCIES = ("KHR", "USD")
VALID_PRICE_BASIS = ("unit", "total")

# Payment belongs to the sale, not the line item — a seller doesn't take
# half a sale in cash. "bank" covers KHQR scans and ABA/Wing/ACLEDA
# transfers. "credit" isn't an edge case: selling to regulars who pay later
# is normal trade, and recording it as cash would report money as received
# when it's still owed, quietly inflating every daily total.
VALID_PAYMENT_METHODS = ("cash", "bank", "credit")

# Methods where the money is actually in hand. Anything else is a
# receivable, not income.
SETTLED_PAYMENT_METHODS = ("cash", "bank")


# ==========================================================================
# Gemini client and retry policy.
# ==========================================================================

def validate() -> None:
    """Fail at boot rather than on a seller's first sale."""
    if not settings.GEMINI_API_KEY:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. Add it to .env — the voice pipeline "
            "can't start without it. Never commit .env."
        )
    if settings.ASR_BACKEND not in ("prompted", "transcribe"):
        raise RuntimeError(
            f"ASR_BACKEND must be 'prompted' or 'transcribe', "
            f"got {settings.ASR_BACKEND!r}"
        )


@lru_cache(maxsize=1)
def get_client():
    """One shared Gemini client, built once.

    Constructing a client per request costs a fresh connection setup on
    every sale, which is pure latency for no benefit.
    """
    from google import genai

    validate()
    return genai.Client(api_key=settings.GEMINI_API_KEY)


# def generation_config():
#     """Shared generation settings for every Gemini call."""
#     from google.genai import types

#     return types.GenerateContentConfig(temperature=settings.TEMPERATURE)
def generation_config(max_output_tokens: int = 8192):
    from google.genai import types
    return types.GenerateContentConfig(
        temperature=settings.TEMPERATURE,
        max_output_tokens=max_output_tokens,
    )

def call_with_retry(fn, *, what: str):
    """Run a Gemini call with bounded exponential backoff.

    Only rate limits and overload are retried. Anything else fails
    immediately — retrying a malformed request just delays the error.
    """
    last_error = None

    for attempt in range(settings.MAX_RETRIES + 1):
        try:
            return fn()
        except Exception as exc:  # the SDK raises transport-specific types
            last_error = exc
            message = str(exc)
            retryable = (
                "429" in message
                or "503" in message
                or "RESOURCE_EXHAUSTED" in message
            )
            if not retryable or attempt == settings.MAX_RETRIES:
                break
            time.sleep(settings.RETRY_BASE_DELAY_S * (2 ** attempt))

    raise RuntimeError(
        f"{what} failed after {settings.MAX_RETRIES + 1} attempts: {last_error}"
    )
