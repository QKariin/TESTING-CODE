# Crypto Payment System — Technical Documentation

> **Private document for development team.** This explains how cryptocurrency payments work end-to-end in the application.

---

## Overview

The app accepts crypto payments in two contexts:

1. **Coin purchases** — Logged-in users buy "Royal Silver" coins (in-app currency) with crypto
2. **Entrance tribute** — New users pay a one-time €55 entrance fee with crypto to create their profile

Both flows use **CryptAPI** (https://cryptapi.io) as the payment processor. CryptAPI is a non-custodial forwarding service — it generates a temporary deposit address, the user sends crypto to it, and CryptAPI automatically forwards the funds to our wallet. There is **no CryptAPI account or dashboard** — it's purely API-based and free to use (they take a small network fee from the forwarded amount).

There is also a legacy **DV.net** integration for coin purchases that works similarly but through a different provider.

---

## Supported Cryptocurrencies

| Ticker | Currency | Env Var for Receiving Wallet |
|---|---|---|
| `trc20/usdt` | USDT on Tron (default) | `CRYPTO_WALLET_ADDRESS` |
| `btc` | Bitcoin | `CRYPTO_WALLET_BTC` |
| `eth` | Ethereum | `CRYPTO_WALLET_ETH` |
| `ltc` | Litecoin | `CRYPTO_WALLET_LTC` |

The user picks which cryptocurrency to pay with. The system converts the EUR price to the equivalent crypto amount at current market rates via CryptAPI's convert endpoint.

---

## Environment Variables

```
# CryptAPI (direct wallet forwarding)
CRYPTO_WALLET_ADDRESS=<USDT TRC20 wallet address>
CRYPTO_WALLET_BTC=<Bitcoin wallet address>
CRYPTO_WALLET_ETH=<Ethereum wallet address>
CRYPTO_WALLET_LTC=<Litecoin wallet address>

# DV.net (legacy provider, used for some coin purchases)
DV_NET_HOST=<DV.net API host URL>
DV_NET_API_KEY=<DV.net API key>
DV_NET_SECRET_KEY=<DV.net webhook signature secret>

# General
NEXT_PUBLIC_SITE_URL=https://throne.qkarin.com
NEXT_PUBLIC_SUPABASE_URL=<Supabase URL>
SUPABASE_SERVICE_ROLE_KEY=<Supabase service role key>
```

---

## Database

### Table: `crypto_orders`

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Order ID (generated server-side) |
| `user_id` | text | Supabase auth user ID |
| `user_email` | text | User's email or identifier |
| `coins` | integer | Number of coins to credit (0 for entrance tribute) |
| `amount_cents` | integer | Price in EUR cents |
| `currency` | text | Always `EUR` |
| `status` | text | `pending` → `completed` |
| `dv_wallet_id` | text | The temporary deposit address (CryptAPI) or DV wallet ID |
| `pay_url` | text | QR code URL (CryptAPI) or payment page URL (DV.net) |
| `tx_hash` | text | Blockchain transaction hash (set on completion) |
| `completed_at` | timestamp | When payment was confirmed |

### Table: `profiles`

Coins are credited to `profiles.wallet` (integer). Purchase history is tracked in `profiles.parameters` (JSONB):
- `parameters.processedCryptoOrders` — Array of completed order IDs (deduplication)
- `parameters.purchaseHistory` — Array of purchase entries (coins, method, timestamp, orderId)
- `parameters.latestPurchaseNotification` — Most recent purchase (used for admin notifications)

---

## Flow 1: Coin Purchase (CryptAPI)

### Coin Packages

| Coins | Price (EUR) |
|---|---|
| 1,000 | €10 |
| 2,000 | €20 |
| 5,500 | €50 |
| 12,000 | €100 |
| 30,000 | €250 |
| 70,000 | €500 |
| 150,000 | €1,000 |

### Step-by-step

```
USER (browser)                    SERVER                         CRYPTAPI            BLOCKCHAIN
     |                               |                              |                    |
     |  1. Pick coin package         |                              |                    |
     |  2. Pick cryptocurrency       |                              |                    |
     |                               |                              |                    |
     |  POST /api/crypto/create      |                              |                    |
     |  {coins: 5500, ticker: "btc"} |                              |                    |
     |------------------------------>|                              |                    |
     |                               |  GET /btc/convert/           |                    |
     |                               |  ?value=50&from=eur          |                    |
     |                               |----------------------------->|                    |
     |                               |  { value_coin: 0.00082 }     |                    |
     |                               |<-----------------------------|                    |
     |                               |                              |                    |
     |                               |  GET /btc/create/            |                    |
     |                               |  ?callback=.../webhook       |                    |
     |                               |  &address=<our_btc_wallet>   |                    |
     |                               |----------------------------->|                    |
     |                               |  { address_in: "3Kx7f..." } |                    |
     |                               |<-----------------------------|                    |
     |                               |                              |                    |
     |                               |  INSERT crypto_orders        |                    |
     |                               |  (status: pending)           |                    |
     |                               |                              |                    |
     |  { address, amount, qr_url }  |                              |                    |
     |<------------------------------|                              |                    |
     |                               |                              |                    |
     |  3. Show QR code + address    |                              |                    |
     |     User sends crypto -------->------->---------------------->--->  TX broadcast   |
     |                               |                              |                    |
     |  4. Poll GET /api/crypto/status every 15s                    |                    |
     |------------------------------>|                              |                    |
     |  { status: "pending" }        |                              |                    |
     |<------------------------------|                              |                    |
     |                               |                              |    TX confirmed    |
     |                               |                              |<-------------------|
     |                               |  POST /api/crypto/webhook    |                    |
     |                               |  (from CryptAPI servers)     |                    |
     |                               |<-----------------------------|                    |
     |                               |                              |                    |
     |                               |  - Verify not duplicate      |                    |
     |                               |  - Skip if pending=1         |                    |
     |                               |  - UPDATE crypto_orders      |                    |
     |                               |    (status: completed)       |                    |
     |                               |  - UPDATE profiles.wallet    |                    |
     |                               |    (+coins)                  |                    |
     |                               |  - Return "*ok*"             |                    |
     |                               |                              |                    |
     |  5. Poll returns "completed"  |                              |                    |
     |<------------------------------|                              |                    |
     |  6. Show checkmark, reload    |                              |                    |
```

### API Routes

**`POST /api/crypto/create`** — `src/app/api/crypto/create/route.ts`
- Auth: Requires logged-in user (Supabase session)
- Input: `{ coins: number, ticker: string }`
- What it does:
  1. Validates coin package exists
  2. Calls CryptAPI `/convert/` to get current crypto price
  3. Calls CryptAPI `/create/` to generate a temporary deposit address — passes our wallet address + a callback URL
  4. The callback URL includes order metadata as query params: `order_id`, `coins`, `user_id`, `user_email`
  5. Stores order in `crypto_orders` table with status `pending`
  6. Returns: `{ address, amount, amount_eur, currency, qr_url, order_id }`

**`GET /api/crypto/status`** — `src/app/api/crypto/status/route.ts`
- Auth: None (order_id is a UUID, acts as a secret)
- Input: `?order_id=<uuid>`
- Returns: `{ status: "pending" | "completed" }`
- Purpose: Client polls this every 15 seconds to detect when the webhook has confirmed payment

**`POST /api/crypto/webhook`** — `src/app/api/crypto/webhook/route.ts`
- Auth: Called by CryptAPI servers (IPs: `51.77.105.132`, `135.125.112.47`)
- Input: CryptAPI sends transaction details in the body + order metadata in query params
- What it does:
  1. Parses order metadata from URL query params
  2. Skips if `pending=1` (unconfirmed transaction — waits for blockchain confirmation)
  3. Checks idempotency — skips if order already completed or same tx hash
  4. Marks order as `completed` in `crypto_orders`
  5. Finds user profile by email or user ID
  6. Credits coins to `profiles.wallet`
  7. Records purchase in `profiles.parameters` (history + notification)
  8. **Must return `*ok*`** — CryptAPI retries if it doesn't get this exact response

### How CryptAPI works (non-custodial)

CryptAPI doesn't hold funds. When we call `/create/`:
- We provide **our wallet address** (where we want to receive funds)
- CryptAPI generates a **temporary deposit address** (the `address_in`)
- User sends crypto to the temporary address
- CryptAPI detects the incoming transaction and **automatically forwards** it to our wallet
- CryptAPI fires our callback URL (webhook) when the transaction is confirmed
- CryptAPI takes a small fee (0.5-1%) from the forwarded amount

**We never touch user funds. We never hold crypto. CryptAPI forwards directly to our wallets.**

There is no CryptAPI dashboard or login. The service is entirely API-driven. If a webhook fails, CryptAPI retries automatically.

---

## Flow 2: Entrance Tribute (CryptAPI)

Same mechanism as coin purchases, but:
- Fixed price: **€55**
- Coins credited: **0** (this is an entrance fee, not a coin purchase)
- On completion, creates the user's `profiles` and `tasks` rows instead of crediting coins
- New user gets 5,000 starter coins upon profile creation

### API Routes

**`POST /api/tribute/crypto`** — `src/app/api/tribute/crypto/route.ts`
- Same as `/api/crypto/create` but hardcoded to €55, no coin package
- Stores the user's display name in the `pay_url` field as `entrance_tribute:Name`
- Uses the **same webhook** (`/api/crypto/webhook`) — since `coins=0`, the webhook credits 0 coins

**`POST /api/tribute/crypto-verify`** — `src/app/api/tribute/crypto-verify/route.ts`
- Called by the tribute page after polling detects `completed` status
- Checks if the crypto order is completed
- If completed AND user has no profile yet: creates `profiles` row (with 5,000 starter coins) + `tasks` row
- Returns `{ status: "completed", profileCreated: true }`

---

## Flow 3: Coin Purchase (DV.net — Legacy)

An alternative crypto provider. Instead of generating a QR code in our UI, it redirects the user to a DV.net hosted payment page.

**`POST /api/dv/coins`** — `src/app/api/dv/coins/route.ts`
- Creates a payment wallet via DV.net API
- Returns a `pay_url` that the user is redirected to
- DV.net handles the entire payment UI

**`POST /api/dv/webhook`** — `src/app/api/dv/webhook/route.ts`
- Called by DV.net when payment completes
- Verifies webhook signature using HMAC-SHA256 (`DV_NET_SECRET_KEY`)
- Same coin-crediting logic as the CryptAPI webhook

---

## Client-Side UI

### Profile page (`src/scripts/profile-logic.ts`)

The purchase flow is driven by vanilla TypeScript / DOM manipulation:

1. **`buyRealCoins(amount)`** — Entry point. Shows a payment method picker (Stripe vs Crypto)
2. **`_showCryptoCoinPicker(amount)`** — Shows cryptocurrency selection (BTC, ETH, USDT, LTC)
3. **`_createCryptoPayment(amount, ticker, label)`** — Calls `/api/crypto/create`, shows loading spinner
4. **`_showCryptoPaymentOverlay(data, coins)`** — Shows QR code, wallet address, copy button, and polls `/api/crypto/status` every 15 seconds for up to 30 minutes

### Tribute page (`src/app/tribute/page.tsx`)

Same flow but in React. The crypto overlays are rendered as React components with the same visual design.

### Polling

The client polls `GET /api/crypto/status?order_id=<uuid>` every 15 seconds. When it returns `"completed"`:
- Coin purchase: shows a checkmark animation, then reloads the page (fresh wallet balance)
- Entrance tribute: calls `/api/tribute/crypto-verify` to create the profile, then redirects to `/profile`

---

## Security Notes

- **No API keys stored client-side** — All CryptAPI/DV.net calls happen server-side
- **Auth required** — `/api/crypto/create` and `/api/tribute/crypto` require a valid Supabase session
- **Idempotent webhooks** — Both webhooks check if the order is already completed before crediting coins, preventing double-crediting
- **No fund custody** — CryptAPI forwards funds directly to our wallets. We never hold user crypto
- **Order IDs are UUIDs** — Used as implicit auth for status polling (unguessable)
- **Webhook signature verification** — DV.net webhooks are verified via HMAC-SHA256. CryptAPI webhooks use IP allowlisting
- **Pending transactions skipped** — CryptAPI sends a callback for unconfirmed transactions (`pending=1`). We ignore these and only credit on confirmed transactions

---

## What happens if something goes wrong?

| Scenario | What happens |
|---|---|
| User sends wrong amount | CryptAPI forwards whatever arrives. Webhook fires with actual amount received. Currently we credit the full coin package regardless of actual amount received — this is a known limitation |
| User sends to expired address | CryptAPI addresses don't expire. The forwarding remains active indefinitely |
| Webhook fails / server is down | CryptAPI retries automatically until it receives `*ok*` |
| User closes the page before payment confirms | The webhook still fires and credits coins. Next time user loads the page, their balance is updated |
| Double webhook delivery | Idempotency check prevents double-crediting (checks `order.status === 'completed'` and `order.tx_hash`) |
| Blockchain congestion / slow confirmation | Client polls for 30 minutes. If it takes longer, the webhook still processes — user sees updated balance on next page load |

---

## File Reference

| File | Purpose |
|---|---|
| `src/app/api/crypto/create/route.ts` | Create CryptAPI payment for coin purchase |
| `src/app/api/crypto/status/route.ts` | Poll order status |
| `src/app/api/crypto/webhook/route.ts` | CryptAPI callback — confirms payment, credits coins |
| `src/app/api/tribute/crypto/route.ts` | Create CryptAPI payment for entrance tribute |
| `src/app/api/tribute/crypto-verify/route.ts` | Verify tribute payment + create profile |
| `src/app/api/dv/coins/route.ts` | Create DV.net payment for coin purchase |
| `src/app/api/dv/webhook/route.ts` | DV.net callback — confirms payment, credits coins |
| `src/scripts/profile-logic.ts` | Client-side crypto UI (profile page) |
| `src/app/tribute/page.tsx` | Client-side crypto UI (tribute page) |
