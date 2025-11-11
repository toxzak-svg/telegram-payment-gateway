# API Reference

Complete API documentation for the Telegram Payment Gateway.

## Base URL

http://localhost:3000/api/v1

text

## Authentication

All authenticated endpoints require an API key in one of these formats:

### Header (Recommended)
X-API-Key: pk_your_api_key_here

text

### Bearer Token
Authorization: Bearer pk_your_api_key_here

text

### Query Parameter
?api_key=pk_your_api_key_here

text

---

## Users

### Register User

Create a new user account and receive API credentials.

**Endpoint:** `POST /users/register`

**Auth Required:** No

**Rate Limit:** 10 requests/minute

**Request Body:**
{
"appName": "My App",
"description": "Optional app description",
"webhookUrl": "https://yourapp.com/webhook"
}

text

**Success Response (201):**
{
"success": true,
"user": {
"id": "uuid",
"appName": "My App",
"apiKey": "pk_...",
"apiSecret": "sk_...",
"webhookUrl": "https://yourapp.com/webhook",
"kycStatus": "pending",
"createdAt": "2025-11-11T10:00:00.000Z"
},
"requestId": "uuid",
"timestamp": "2025-11-11T10:00:00.000Z"
}

text

**Error Responses:**
- `400` - Missing app name
- `429` - Rate limit exceeded
- `500` - Server error

---

### Get User Profile

Retrieve current user information.

**Endpoint:** `GET /users/me`

**Auth Required:** Yes

**Rate Limit:** 60 requests/minute

**Success Response (200):**
{
"success": true,
"user": {
"id": "uuid",
"appName": "My App",
"apiKey": "pk_...",
"webhookUrl": "https://yourapp.com/webhook",
"kycStatus": "pending",
"isActive": true,
"createdAt": "2025-11-11T10:00:00.000Z"
},
"requestId": "uuid"
}

text

---

### Regenerate API Keys

Generate new API key and secret.

**Endpoint:** `POST /users/api-keys/regenerate`

**Auth Required:** Yes

**Rate Limit:** 10 requests/minute

**Success Response (200):**
{
"success": true,
"data": {
"apiKey": "pk_new_key",
"apiSecret": "sk_new_secret",
"message": "API keys regenerated successfully"
},
"requestId": "uuid"
}

text

---

### Get User Statistics

Retrieve payment statistics for authenticated user.

**Endpoint:** `GET /users/stats`

**Auth Required:** Yes

**Rate Limit:** 60 requests/minute

**Success Response (200):**
{
"success": true,
"stats": {
"totalPayments": 42,
"totalStars": 25000,
"successfulPayments": 40
},
"requestId": "uuid"
}

text

---

## Payments

### Telegram Webhook

Receive payment notifications from Telegram.

**Endpoint:** `POST /payments/webhook`

**Auth Required:** No (uses X-User-Id header)

**Rate Limit:** 100 requests/minute

**Headers:**
X-User-Id: user_uuid

text

**Request Body:**
{
"update_id": 123456789,
"message": {
"from": {
"id": 987654321,
"username": "testuser"
},
"successful_payment": {
"telegram_payment_charge_id": "tg_charge_xxx",
"provider_payment_charge_id": "provider_xxx",
"total_amount": 1000,
"currency": "XTR"
}
}
}

text

**Success Response (200):**
{
"success": true,
"paymentId": "uuid",
"starsAmount": 1000,
"message": "Payment processed successfully"
}

text

---

### Get Payment

Retrieve payment details by ID.

**Endpoint:** `GET /payments/:id`

**Auth Required:** Yes

**Rate Limit:** 60 requests/minute

**Success Response (200):**
{
"success": true,
"payment": {
"id": "uuid",
"user_id": "uuid",
"telegram_payment_id": "tg_charge_xxx",
"user_telegram_id": 987654321,
"user_telegram_username": "testuser",
"stars_amount": 1000,
"status": "received",
"created_at": "2025-11-11T10:00:00.000Z"
}
}

text

---

### List Payments

Get paginated list of payments.

**Endpoint:** `GET /payments?page=1&limit=20`

**Auth Required:** Yes

**Rate Limit:** 60 requests/minute

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 20, max: 100)

**Success Response (200):**
{
"success": true,
"data": [
{
"id": "uuid",
"stars_amount": 1000,
"status": "received",
"created_at": "2025-11-11T10:00:00.000Z"
}
],
"pagination": {
"page": 1,
"limit": 20,
"total": 5
}
}

text

---

### Get Payment Statistics

Get payment statistics for authenticated user.

**Endpoint:** `GET /payments/stats`

**Auth Required:** Yes

**Rate Limit:** 60 requests/minute

**Success Response (200):**
{
"success": true,
"stats": {
"totalPayments": 42,
"totalStars": 25000,
"successfulPayments": 40
}
}

text

---

## Conversions

### Get Conversion Estimate

Get a quote for converting Stars to another currency.

**Endpoint:** `POST /conversions/estimate`

**Auth Required:** Yes

**Rate Limit:** 60 requests/minute

**Request Body:**
{
"sourceAmount": 1000,
"sourceCurrency": "STARS",
"targetCurrency": "TON"
}

text

**Success Response (200):**
{
"success": true,
"quote": {
"sourceCurrency": "STARS",
"targetCurrency": "TON",
"sourceAmount": 1000,
"targetAmount": 0.98,
"exchangeRate": 0.001,
"fees": {
"fragment": 5,
"network": 1,
"platform": 10,
"total": 16
},
"estimatedArrival": "5-10 minutes",
"validUntil": "2025-11-11T10:05:00.000Z"
}
}

text

---

### Lock Conversion Rate

Lock an exchange rate for a specified duration.

**Endpoint:** `POST /conversions/lock-rate`

**Auth Required:** Yes

**Rate Limit:** 10 requests/minute

**Request Body:**
{
"sourceAmount": 1000,
"sourceCurrency": "STARS",
"targetCurrency": "TON",
"durationSeconds": 300
}

text

**Success Response (200):**
{
"success": true,
"data": {
"conversionId": "uuid",
"rate": 0.001,
"lockedUntil": "2025-11-11T10:05:00.000Z",
"targetAmount": 0.98
}
}

text

---

### Create Conversion

Execute a conversion from Stars to another currency.

**Endpoint:** `POST /conversions/create`

**Auth Required:** Yes

**Rate Limit:** 10 requests/minute

**Request Body:**
{
"paymentIds": ["uuid1", "uuid2"],
"targetCurrency": "TON"
}

text

**Success Response (201):**
{
"success": true,
"conversion": {
"id": "uuid",
"sourceAmount": 2000,
"targetAmount": 1.96,
"exchangeRate": 0.001,
"status": "pending",
"createdAt": "2025-11-11T10:00:00.000Z"
}
}

text

**Error Responses:**
- `400` - Invalid payment IDs or insufficient amount (minimum 1000 Stars)
- `404` - Payments not found
- `500` - Conversion failed

---

### Get Conversion Status

Check the status of a conversion.

**Endpoint:** `GET /conversions/:id/status`

**Auth Required:** Yes

**Rate Limit:** 60 requests/minute

**Success Response (200):**
{
"success": true,
"conversion": {
"id": "uuid",
"status": "completed",
"sourceAmount": 2000,
"targetAmount": 1.96,
"exchangeRate": 0.001,
"fragmentTxId": "frag_xxx",
"tonTxHash": "ton_hash_xxx",
"createdAt": "2025-11-11T10:00:00.000Z",
"completedAt": "2025-11-11T10:05:00.000Z"
}
}

text

**Conversion Statuses:**
- `pending` - Conversion initiated
- `rate_locked` - Rate locked, awaiting execution
- `phase1_prepared` - Preparing Fragment transaction
- `phase2_committed` - Committed to Fragment
- `phase3_confirmed` - Confirmed on blockchain
- `completed` - Successfully completed
- `failed` - Conversion failed
- `rolled_back` - Transaction rolled back

---

### List Conversions

Get paginated list of conversions.

**Endpoint:** `GET /conversions?page=1&limit=20`

**Auth Required:** Yes

**Rate Limit:** 60 requests/minute

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 20, max: 100)

**Success Response (200):**
{
"success": true,
"data": [
{
"id": "uuid",
"source_amount": 2000,
"target_amount": 1.96,
"status": "completed",
"created_at": "2025-11-11T10:00:00.000Z"
}
],
"pagination": {
"page": 1,
"limit": 20,
"total": 3
}
}

text

---

## Rate Limiting

All endpoints have rate limits to prevent abuse:

| Endpoint Type | Limit |
|--------------|-------|
| Registration | 10 requests/minute |
| Standard API | 60 requests/minute |
| Webhooks | 100 requests/minute |
| Conversions | 10 requests/minute |

**Rate Limit Headers:**
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 2025-11-11T10:01:00.000Z

text

**Rate Limit Error (429):**
{
"success": false,
"error": {
"code": "RATE_LIMIT_EXCEEDED",
"message": "Too many requests, please try again later",
"retryAfter": 45
}
}

text

---

## Error Codes

| Code | Description |
|------|-------------|
| `MISSING_API_KEY` | No API key provided |
| `INVALID_API_KEY` | API key is invalid |
| `INVALID_API_KEY_FORMAT` | API key format is incorrect |
| `ACCOUNT_INACTIVE` | User account is deactivated |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `MISSING_APP_NAME` | App name is required |
| `USER_NOT_FOUND` | User does not exist |
| `INVALID_AMOUNT` | Invalid amount provided |
| `INVALID_PAYMENTS` | Payment IDs invalid or empty |
| `CONVERSION_FAILED` | Conversion could not be processed |
| `SERVER_ERROR` | Internal server error |

---

## Response Format

All API responses follow this structure:

**Success:**
{
"success": true,
"data": {},
"requestId": "uuid",
"timestamp": "2025-11-11T10:00:00.000Z"
}

text

**Error:**
{
"success": false,
"error": {
"code": "ERROR_CODE",
"message": "Human-readable error message"
},
"requestId": "uuid",
"timestamp": "2025-11-11T10:00:00.000Z"
}

text

---

## Request Tracking

Every response includes an `X-Request-Id` header for debugging and support purposes. Include this ID when reporting issues.