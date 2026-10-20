import logging

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError
from supabase_auth.errors import AuthRetryableError

from app.core.config import settings
from app.routers import auth, auth_telegram,dashboard, transactions, voice, telegram_test_page,payment,products
app = FastAPI(title="KotChomnol API")

logger = logging.getLogger(__name__)

# Origins from FRONTEND_URL (comma-separated). Browsers send the Origin
# without a trailing slash, so strip it or the entry never matches.
frontend_origins = {
    origin.strip().rstrip("/")
    for origin in settings.FRONTEND_URL.split(",")
    if origin.strip()
}
frontend_origins.update({
    "http://localhost:5173",
    "https://kotchomnol-iota.vercel.app",
})

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(frontend_origins),
    # The Vite dev server opened from a phone on the same Wi-Fi
    # (private network addresses only).
    allow_origin_regex=r"http://(192\.168|10|172\.(1[6-9]|2\d|3[01]))(\.\d{1,3}){2,3}:5173",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# When Supabase or the database can't be reached, answer with a clear 503
# instead of an unhandled 500. Unhandled errors skip the CORS headers, so the
# browser would otherwise misreport the outage as a CORS failure.
@app.exception_handler(httpx.HTTPError)
@app.exception_handler(AuthRetryableError)
async def auth_service_unavailable(request: Request, exc: Exception):
    logger.error("Auth service unreachable on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=503,
        content={"detail": "Can't reach the login service right now. Please check your internet connection and try again."},
    )


@app.exception_handler(OperationalError)
async def database_unavailable(request: Request, exc: OperationalError):
    logger.error("Database unreachable on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=503,
        content={"detail": "Can't reach the database right now. Please try again in a moment."},
    )


app.include_router(auth.router)
app.include_router(auth_telegram.router)
app.include_router(telegram_test_page.router)
# app.include_router(auth.router, prefix="/auth", tags=["auth"])

app.include_router(dashboard.router)
app.include_router(transactions.router)
app.include_router(voice.router)
app.include_router(payment.router)
app.include_router(products.router)


@app.get("/")
def health_check():
    return {"status": "ok", "service": "BANHJI API"}


