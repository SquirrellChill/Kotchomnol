from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import auth, auth_telegram,dashboard, transactions, voice, telegram_test_page,payment,products
app = FastAPI(title="KotChomnol API")

frontend_origins = [
    origin.strip()
    for origin in settings.FRONTEND_URL.split(",")
    if origin.strip()
]

# Allow your frontend (e.g. Vite dev server) to call this API during development.
# Tighten this to your real frontend domain before deploying.
app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


#eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6OCwiZXhwIjoxNzg4NTMzMTE4fQ.sOh0mIzOdsavdw7De19bdHGheNt2U2sWdQcjlFPhfcQ
