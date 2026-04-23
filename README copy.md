# Quick Payment Pages

Quick Payment Pages is a full-stack payment configuration platform built with Next.js, FastAPI, and MongoDB. It supports public hosted payment pages, role-based admin and business portals, optional customer accounts, QR sharing, coupon codes, and sandbox payment flows for cards, wallets, and ACH.

## Stack

- Frontend: React with Next.js App Router
- Backend: Python FastAPI REST API
- Database: MongoDB
- Styling: Tailwind CSS v4
- QR generation: `qrcode`
- Auth: JWT bearer tokens
- APIs in app today: REST

## What’s Included

- Admin portal with full visibility across businesses and pages
- Separate business portal scoped to business-owned pages and reports
- Optional customer login and profile/history dashboard
- Public payment pages with guest checkout
- Branding controls: title, subtitle, header, footer, logo, color, support email
- Fixed, ranged, and open amount modes
- Custom payer fields with ordering and validation
- GL code tagging
- Coupon codes per business page
- QR code preview/download and iframe embed snippet sharing
- Sandbox payment flows for card, digital wallets, and ACH
- Confirmation email logging
- Reporting with filters, summaries, and CSV export
- Quick RePay remembered payer details on the same device

## Roles

### Admin

- Can see all businesses, payment pages, transactions, and email logs
- Uses route: `/login` -> `/admin`

### Business

- Can only manage pages and reports for its own `business_id`
- Uses route: `/business/login` -> `/business`

### Customer

- Optional account for saved payer profile and customer-linked payment history
- Uses routes: `/customer/login`, `/customer/register`, `/customer`
- Public checkout still works without login

## Seeded Demo Accounts

After running `npm run backend:seed`:

- Admin: `admin@example.com` / `ChangeMe123!`
- Business 1: `owner@solsticeyoga.example` / `ChangeMe123!`
- Business 2: `billing@maplecityutilities.example` / `ChangeMe123!`
- Customer: `customer@example.com` / `ChangeMe123!`

## Seeded Demo Pages

- `/pay/yoga-class`
- `/pay/city-utilities`

Seeded coupon examples:

- `NEWYOGA`
- `SAVE10`
- `GREEN5`

## Architecture

```text
Next.js frontend (localhost:3000)
        |
        | REST / JSON
        v
FastAPI backend (localhost:8000/api/v1)
        |
        v
MongoDB (localhost:27017 / qpp_platform)
```

## Project Layout

```text
src/                      Next.js frontend
src/app/                  App routes
src/components/           Admin, business, customer, and payer UI
src/lib/                  API client, types, formatting, validation
backend/app/              FastAPI application modules
backend/seed.py           Demo data seeder
scripts/                  Local startup helpers
docker-compose.yml        Optional MongoDB container
```

## Local Setup

### 1. Frontend env

```bash
cp .env.example .env.local
```

### 2. Backend env

```bash
cp backend/.env.example backend/.env
```

Minimum backend values:

```env
MONGODB_URI="mongodb://localhost:27017"
MONGODB_DB_NAME="qpp_platform"
JWT_SECRET="replace-with-a-long-random-string"
FRONTEND_APP_URL="http://localhost:3000"
ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
DEMO_ADMIN_EMAIL="admin@example.com"
DEMO_ADMIN_PASSWORD="ChangeMe123!"
```

### 3. Install dependencies

Frontend:

```bash
npm install
```

Backend:

```bash
cd backend
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r requirements.txt
cd ..
```

### 4. Start MongoDB

Homebrew:

```bash
brew services start mongodb/brew/mongodb-community@7.0
```

Or Docker:

```bash
docker compose up -d mongo
```

Verify:

```bash
mongosh --quiet --eval 'db.runCommand({ ping: 1 })'
```

Expected:

```json
{ ok: 1 }
```

### 5. Seed the database

```bash
npm run backend:seed
```

### 6. Start everything with one command

```bash
npm run dev:all
```

This script:

- starts MongoDB with Homebrew if available, otherwise Docker Compose
- starts FastAPI on `http://127.0.0.1:8000`
- starts Next.js on `http://127.0.0.1:3000`

### 7. Manual start commands

Mongo only:

```bash
npm run mongo:start
```

Backend only:

```bash
npm run backend:dev
```

Frontend only:

```bash
npm run dev
```

## MongoDB Compass

Use these exact steps:

1. Start MongoDB with `npm run mongo:start` or your preferred local command.
2. Open MongoDB Compass.
3. Click `Add new connection`.
4. Paste this connection string:

```text
mongodb://localhost:27017
```

5. Click `Connect`.
6. In the left sidebar, open the `qpp_platform` database.
7. You should see collections such as:
   - `users`
   - `payment_pages`
   - `transactions`
   - `email_logs`

Notes:

- This local setup does not require a MongoDB username or password.
- If the database is empty, run `npm run backend:seed`.

## Routes

### Public

- `/`
- `/pay/[slug]`
- `/pay/[slug]/success`

### Admin

- `/login`
- `/admin`
- `/admin/pages/new`
- `/admin/pages/[pageId]`
- `/admin/reports`

### Business

- `/business/login`
- `/business`
- `/business/pages/new`
- `/business/pages/[pageId]`
- `/business/reports`

### Customer

- `/customer/login`
- `/customer/register`
- `/customer`

## API Summary

### Auth

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/customer/register`
- `GET /api/v1/auth/me`

### Customer

- `GET /api/v1/customers/me/dashboard`
- `PUT /api/v1/customers/me/profile`

### Payment Pages

- `GET /api/v1/payment-pages`
- `POST /api/v1/payment-pages`
- `GET /api/v1/payment-pages/{page_id}`
- `PUT /api/v1/payment-pages/{page_id}`
- `GET /api/v1/public/payment-pages/{slug}`

### Payments

- `POST /api/v1/public/payment-pages/{slug}/payments`
- `GET /api/v1/public/transactions/{public_id}`

### Reporting

- `GET /api/v1/reports/transactions`
- `GET /api/v1/reports/summary`
- `GET /api/v1/reports/email-logs`
- `GET /api/v1/reports/export.csv`

## MongoDB Collections

### `users`

- Shared auth collection for `ADMIN`, `BUSINESS`, and `CUSTOMER`
- Business users include `business_id` and `business_name`
- Customer users include `saved_profile`

### `payment_pages`

- Branding and amount rules
- Custom fields
- GL codes
- Coupon codes
- `business_id` / `business_name`

### `transactions`

- Page snapshot data
- Customer linkage
- Original amount, discount amount, final amount
- Coupon code and processor metadata

### `email_logs`

- Receipt previews or SMTP delivery logs
- Scoped to business/page/transaction

## Troubleshooting

### `Failed to fetch`

Check these first:

```bash
brew services list | grep mongodb
curl http://127.0.0.1:8000/health
```

The backend currently allows both:

- `http://localhost:3000`
- `http://127.0.0.1:3000`

If you change `backend/.env`, restart the backend.

## Live Gateway Notes

The app currently uses a built-in sandbox processor for cards, wallets, and ACH so the full product can be demoed locally without external credentials.

If you want real wallet and processor integration, use the notes below.

### Stripe Sandbox Setup

Recommended official docs:

- Stripe API keys: https://docs.stripe.com/keys
- Stripe testing overview: https://docs.stripe.com/testing/overview
- Stripe test cards: https://docs.stripe.com/testing?testing-method=payment-methods
- Stripe webhooks quickstart: https://docs.stripe.com/webhooks/quickstart?lang=python
- Stripe CLI: https://docs.stripe.com/stripe-cli/use-cli

Typical setup:

1. Create a Stripe account and stay in a sandbox or test environment.
2. Copy your test keys:
   - publishable key starts with `pk_test_`
   - secret key starts with `sk_test_`
3. Add them to your env files:

Frontend `.env.local`:

```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

Backend `backend/.env`:

```env
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

4. Install Stripe SDKs:

```bash
npm install @stripe/stripe-js
cd backend && uv pip install --python .venv/bin/python stripe && cd ..
```

5. Replace the internal payment simulation with a real server flow:
   - backend creates a `PaymentIntent`
   - frontend confirms it with Stripe.js / Elements
   - backend verifies webhooks before marking transactions as paid
6. Forward webhooks locally with the Stripe CLI:

```bash
stripe listen --forward-to localhost:8000/api/v1/stripe/webhook
```

7. Use Stripe test values such as `4242 4242 4242 4242` during development.

### Apple Pay with Stripe

Official docs:

- https://docs.stripe.com/apple-pay?platform=web

What Stripe requires for web:

- use Stripe Checkout or Stripe Elements / Express Checkout Element
- register every domain and subdomain that will show the Apple Pay button
- serve the payment page from the registered domain
- watch iframe rules if your checkout is embedded

Practical setup for this app:

1. Move the public payment page to Stripe Checkout or Elements.
2. Register your checkout domain in Stripe for Apple Pay.
3. Use your Stripe test keys first.
4. Verify the Apple Pay button appears only in supported Safari environments.

### Google Pay with Stripe

Official docs:

- https://docs.stripe.com/google-pay?platform=web

What Stripe requires for web:

- use Checkout or Elements
- enable Google Pay in your Stripe payment method settings
- serve the site over HTTPS with a valid TLS certificate
- register domains that display the Google Pay button

Practical setup:

1. Serve the production checkout on HTTPS.
2. Enable Google Pay in Stripe.
3. Use Checkout or Elements on the public payment page.
4. Test the wallet button on supported Chrome / Android / Google account setups.

### Venmo

Venmo is not a Stripe payment method. For Venmo on web, use PayPal Checkout or Braintree.

Official docs:

- Pay with Venmo overview: https://developer.paypal.com/docs/checkout/pay-with-venmo/
- Venmo integration steps: https://developer.paypal.com/docs/checkout/pay-with-venmo/integrate/
- Venmo sandbox testing: https://developer.paypal.com/docs/checkout/pay-with-venmo/test/

Typical PayPal Checkout approach:

1. Create a PayPal Developer account and sandbox app.
2. Add your PayPal client ID to `.env.local`:

```env
NEXT_PUBLIC_PAYPAL_CLIENT_ID="your-paypal-client-id"
```

3. Add `enable-funding=venmo` to the PayPal JavaScript SDK script.
4. In sandbox, add `buyer-country=US` when testing Venmo.
5. Keep in mind:
   - Venmo is US-only
   - mobile users need the Venmo app installed
   - desktop checkout can use the Venmo QR flow

## Current Status

Implemented in this repo today:

- admin login
- business login
- customer accounts/login
- business-scoped pages and reports
- coupon codes on payment pages
- QR code preview/download
- one-command local startup

Not yet wired to a real live processor:

- Stripe API-backed payments
- Stripe webhooks
- Apple Pay via Stripe
- Google Pay via Stripe
- Venmo via PayPal/Braintree

Those are documented above so the next integration step is clear.
