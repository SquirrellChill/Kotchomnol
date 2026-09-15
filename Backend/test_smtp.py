import smtplib
import ssl

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587

EMAIL = "kotchomnol@gmail.com"
APP_PASSWORD = "htezhlwfmxavhbnm"

context = ssl.create_default_context()

try:
    print("1. Connecting to Gmail SMTP...")

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as server:
        print("2. Connected!")

        server.ehlo()
        server.starttls(context=context)
        print("3. TLS started!")

        server.ehlo()
        server.login(EMAIL, APP_PASSWORD)
        print("4. Login successful!")

    print("\n✅ SMTP TEST PASSED")

except Exception as e:
    print("\n❌ SMTP TEST FAILED")
    print("Error type:", type(e).__name__)
    print("Error:", str(e))