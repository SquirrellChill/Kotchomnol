"""Fill ONE account with realistic coffee-shop sales for a demo.

Run from the Backend folder:

    ..\\.venv\\Scripts\\python.exe scripts\\seed_demo_sales.py --email demo@example.com --shop-name "Sokha Coffee"

Options:
    --months N    how far back to generate sales (default 4)
    --replace     delete that account's existing sales first
    --dry-run     show what would be created without writing anything

Only the account matching --email is touched. The output is the same every
run (fixed random seed), so re-running with --replace gives identical data.
"""

import argparse
import random
import sys
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.core.database import SessionLocal
from app.models.sale import Sale
from app.models.sale_item import SaleItem
from app.models.user import User

# (description, unit price, currency, popularity weight)
CATALOG = [
    ("កាហ្វេទឹកដោះគោទឹកកក", 5000, "KHR", 10),
    ("កាហ្វេខ្មៅទឹកកក", 4000, "KHR", 7),
    ("តែបៃតងទឹកដោះគោ", 6000, "KHR", 6),
    ("នំបុ័ងសាច់", 3000, "KHR", 5),
    ("ទឹកក្រូចច្របាច់", 4500, "KHR", 4),
    ("Iced Latte", Decimal("2.50"), "USD", 8),
    ("Matcha Latte", Decimal("3.00"), "USD", 6),
    ("Cappuccino", Decimal("2.75"), "USD", 5),
    ("Chocolate Cake", Decimal("2.00"), "USD", 3),
    ("Croissant", Decimal("1.75"), "USD", 3),
]


def build_sales(months: int, rng: random.Random):
    today = date.today()
    start = today - timedelta(days=months * 30)
    total_days = (today - start).days
    weights = [c[3] for c in CATALOG]

    sales = []
    for offset in range(total_days + 1):
        day = start + timedelta(days=offset)
        growth = 1 + offset / max(total_days, 1)        # business grows over time
        weekend = 1.5 if day.weekday() >= 5 else 1.0
        count = max(1, round(rng.uniform(2, 4) * growth * weekend))

        for _ in range(count):
            picks = rng.choices(CATALOG, weights=weights, k=rng.choice([1, 1, 2, 2, 3]))
            items = {}
            for name, price, currency, _w in picks:
                entry = items.setdefault(name, {"unit_price": price, "currency": currency, "quantity": 0})
                entry["quantity"] += rng.choice([1, 1, 1, 2, 3])
            sales.append((day, items))
    return sales


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--email", required=True, help="email of the demo account to fill")
    parser.add_argument("--shop-name", help="also set this account's shop name")
    parser.add_argument("--months", type=int, default=4)
    parser.add_argument("--replace", action="store_true", help="delete the account's existing sales first")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == args.email).first()
        if user is None:
            sys.exit(f"No account with email {args.email!r}. Register it in the app first.")

        sales = build_sales(args.months, random.Random(2026))
        existing = db.query(Sale).filter(Sale.user_id == user.user_id).count()
        print(f"Account: {user.first_name} {user.last_name} <{user.email}> (user_id={user.user_id})")
        print(f"Existing sales: {existing}{' -> will be deleted' if args.replace else ' (kept)'}")
        print(f"New sales to create: {len(sales)} from {sales[0][0]} to {sales[-1][0]}")

        if args.dry_run:
            print("Dry run: nothing written.")
            return

        if args.replace:
            for sale in db.query(Sale).filter(Sale.user_id == user.user_id).all():
                db.delete(sale)  # cascades to sale_items
            db.flush()

        if args.shop_name:
            user.shop_name = args.shop_name.strip()

        for day, items in sales:
            sale = Sale(user_id=user.user_id, sale_date=day, total_khr=0, total_usd=0)
            db.add(sale)
            db.flush()
            total_khr = Decimal(0)
            total_usd = Decimal(0)
            for name, entry in items.items():
                amount = Decimal(entry["unit_price"]) * entry["quantity"]
                if entry["currency"] == "KHR":
                    total_khr += amount
                else:
                    total_usd += amount
                db.add(SaleItem(
                    sale_id=sale.sale_id,
                    description=name,
                    quantity=entry["quantity"],
                    unit_price=entry["unit_price"],
                    currency=entry["currency"],
                    amount=amount,
                ))
            sale.total_khr = total_khr
            sale.total_usd = total_usd

        db.commit()
        print("Done.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
