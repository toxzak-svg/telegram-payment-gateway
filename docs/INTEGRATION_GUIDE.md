# Integration Guide

Step-by-step guide to integrating Telegram Payment Gateway into your application.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Setup & Registration](#setup--registration)
3. [Telegram Bot Setup](#telegram-bot-setup)
4. [Payment Flow](#payment-flow)
5. [Conversion Flow](#conversion-flow)
6. [P2P Order Flow](#p2p-order-flow)
7. [Webhook Integration](#webhook-integration)
8. [Production Checklist](#production-checklist)

---

## Quick Start

### Installation

**Option 1: Using SDK (Recommended)**
npm install @tg-payment/sdk

text

**Option 2: Direct API**
Use any HTTP client (axios, fetch, etc.)

---

## Setup & Registration

### Step 1: Register Your Application

Register to get API credentials:

curl -X POST https://api.yourgateway.com/v1/users/register
-H "Content-Type: application/json"
-d '{
"appName": "My Telegram Bot",
"description": "Bot that sells digital products",
"webhookUrl": "https://myapp.com/webhook"
}'

text

**Response:**
{
"success": true,
"user": {
"id": "user-uuid",
"apiKey": "pk_abc123...",
"apiSecret": "sk_xyz789..."
}
}

text

**⚠️ Important:** Store these credentials securely. You'll need them for all API calls.

---

### Step 2: Configure Environment Variables

Create a `.env` file:

API Credentials
TG_PAYMENT_API_KEY=pk_abc123...
TG_PAYMENT_API_SECRET=sk_xyz789...
TG_PAYMENT_API_URL=https://api.yourgateway.com/v1

Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token

text

---

## Telegram Bot Setup

### Step 3: Create Telegram Bot

1. Talk to [@BotFather](https://t.me/BotFather) on Telegram
2. Use `/newbot` command
3. Follow instructions to get your bot token
4. Save token to `.env` file

### Step 4: Enable Telegram Stars Payments

In your bot code:

const { Telegraf } = require('telegraf');
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Create invoice for Telegram Stars
bot.command('buy', async (ctx) => {
await ctx.replyWithInvoice({
title: 'Premium Feature',
description: 'Unlock premium features for 30 days',
payload: JSON.stringify({
userId: ctx.from.id,
productId: 'premium_30d'
}),
currency: 'XTR', // Telegram Stars currency code
prices: [{ label: 'Premium Access', amount: 1000 }], // 1000 Stars
});
});

// Handle successful payment
bot.on('successful_payment', async (ctx) => {
const payment = ctx.message.successful_payment;

// Forward to Payment Gateway
await axios.post(
${process.env.TG_PAYMENT_API_URL}/payments/webhook,
{
update_id: ctx.update.update_id,
message: { successful_payment: payment }
},
{
headers: {
'X-User-Id': process.env.USER_ID,
'Content-Type': 'application/json'
}
}
);

await ctx.reply('✅ Payment received! Processing...');
});

bot.launch();

text

---

## Payment Flow

### Step 5: Process Payments

**Using SDK:**

import TelegramPaymentGateway from '@tg-payment/sdk';

const gateway = new TelegramPaymentGateway({
apiKey: process.env.TG_PAYMENT_API_KEY!,
apiSecret: process.env.TG_PAYMENT_API_SECRET!,
});

// List recent payments
const { payments } = await gateway.listPayments({
page: 1,
limit: 10,
status: 'received'
});

console.log('Payments:', payments);

// Get specific payment
const payment = await gateway.getPayment('payment-uuid');
console.log('Stars received:', payment.starsAmount);

text

**Using Direct API:**

const axios = require('axios');

const client = axios.create({
baseURL: process.env.TG_PAYMENT_API_URL,
headers: {
'X-API-Key': process.env.TG_PAYMENT_API_KEY
}
});

// List payments
const response = await client.get('/payments', {
params: { page: 1, limit: 10, status: 'received' }
});

console.log('Payments:', response.data.payments);

text

---

## Conversion Flow

### Step 6: Convert Stars to TON

#### 6.1: Estimate Conversion

Always estimate before converting:

const estimate = await gateway.estimateConversion({
starsAmount: 5000,
targetCurrency: 'TON',
});

console.log('Estimated TON:', estimate.tonEquivalent);
console.log('Fees:', estimate.fees.total);
console.log('Net amount:', estimate.netAmount);

text

#### 6.2: Lock Rate (Optional)

For time-sensitive conversions:

const rateLock = await gateway.lockRate({
starsAmount: 5000,
targetCurrency: 'TON',
durationSeconds: 300, // 5 minutes
});

console.log('Rate locked:', rateLock.exchangeRate);
console.log('Valid until:', new Date(rateLock.lockedUntil));

text

#### 6.3: Create Conversion

// Get payment IDs from recent payments
const { payments } = await gateway.listPayments({
status: 'received',
limit: 10
});

const paymentIds = payments.map(p => p.id);

// Create conversion
const conversion = await gateway.createConversion({
paymentIds: paymentIds,
targetCurrency: 'TON',
rateLockId: rateLock.id, // optional
});

console.log('Conversion created:', conversion.id);
console.log('Status:', conversion.status);

text

#### 6.4: Monitor Conversion Status

// Poll for status updates
async function waitForConversion(conversionId: string) {
while (true) {
const status = await gateway.getConversionStatus(conversionId);

text
console.log('Phase:', status.progress?.phase);
console.log('Progress:', status.progress?.percentage + '%');

if (status.status === 'completed') {
  console.log('✅ Conversion complete!');
  console.log('TON received:', status.conversion.targetAmount);
  console.log('TX Hash:', status.conversion.tonTxHash);
  break;
}

if (status.status === 'failed') {
  console.error('❌ Conversion failed:', status.conversion.errorMessage);
  break;
}

// Wait 10 seconds before next check
await new Promise(resolve => setTimeout(resolve, 10000));
}
}

await waitForConversion(conversion.id);

text

---

## P2P Order Flow

### Step 7: Manage P2P Orders

#### 7.1: Create Limit Order

Create a buy or sell order at a specific rate:

```javascript
// Create a buy order: 5 TON for 1000 Stars (Rate: 0.005)
const order = await gateway.createP2POrder({
  type: 'buy',
  starsAmount: 1000,
  tonAmount: 5.0,
  rate: 0.005
});

console.log('Order created:', order.orderId);
```

#### 7.2: List Open Orders

View your active orders:

```javascript
const { orders } = await gateway.listP2POrders({
  status: 'pending',
  type: 'buy'
});

console.log('Active orders:', orders.length);
```

#### 7.3: Cancel Order

Cancel an order if it hasn't been matched:

```javascript
await gateway.cancelP2POrder('order-uuid');
console.log('Order cancelled');
```

---

## Webhook Integration

### Step 8: Setup Webhook Endpoint

Receive real-time notifications:

import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.json());

// Verify webhook signature
function verifySignature(payload: string, signature: string): boolean {
const hmac = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET!);
const digest = hmac.update(payload).digest('hex');
return signature === digest;
}

// Webhook endpoint
app.post('/webhook', (req, res) => {
const signature = req.headers['x-webhook-signature'] as string;
const payload = JSON.stringify(req.body);

// Verify signature
if (!verifySignature(payload, signature)) {
return res.status(401).json({ error: 'Invalid signature' });
}

const { event, data } = req.body;

switch (event) {
case 'payment.received':
console.log('Payment received:', data.paymentId);
console.log('Stars:', data.starsAmount);
// Update your database
break;

text
case 'conversion.completed':
  console.log('Conversion completed:', data.conversionId);
  console.log('TON amount:', data.tonAmount);
  console.log('TX Hash:', data.txHash);
  // Notify user, update balance, etc.
  break;
  
case 'conversion.failed':
  console.log('Conversion failed:', data.conversionId);
  console.log('Reason:', data.errorMessage);
  // Handle failure
  break;
}

res.json({ success: true });
});

app.listen(3000, () => {
console.log('Webhook server running on port 3000');
});

text

---

## Complete Integration Example

### Full Express.js Integration

import express from 'express';
import { Telegraf } from 'telegraf';
import TelegramPaymentGateway from '@tg-payment/sdk';

const app = express();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

const gateway = new TelegramPaymentGateway({
apiKey: process.env.TG_PAYMENT_API_KEY!,
apiSecret: process.env.TG_PAYMENT_API_SECRET!,
});

// Database (simplified)
const userBalances = new Map();

// Telegram Bot: Create invoice
bot.command('buy', async (ctx) => {
await ctx.replyWithInvoice({
title: 'Premium Feature',
description: 'Unlock premium features',
payload: JSON.stringify({ userId: ctx.from!.id }),
currency: 'XTR',
prices: [{ label: 'Premium', amount: 5000 }],
});
});

// Telegram Bot: Handle payment
bot.on('successful_payment', async (ctx) => {
const payment = ctx.message.successful_payment;

// Send to Payment Gateway
await axios.post(
${process.env.TG_PAYMENT_API_URL}/payments/webhook,
{
update_id: ctx.update.update_id,
message: { successful_payment: payment }
},
{
headers: { 'X-User-Id': process.env.USER_ID! }
}
);

await ctx.reply('✅ Payment received! Converting to TON...');

// Auto-convert to TON
try {
const { payments } = await gateway.listPayments({
status: 'received',
limit: 1
});

text
const conversion = await gateway.createConversion({
  paymentIds: [payments.id],
  targetCurrency: 'TON'
});

// Wait for conversion
const status = await waitForConversion(conversion.id);

if (status.status === 'completed') {
  const userId = ctx.from!.id;
  const currentBalance = userBalances.get(userId) || 0;
  userBalances.set(userId, currentBalance + status.conversion.targetAmount!);
  
  await ctx.reply(
    `✅ Conversion complete!\n` +
    `Received: ${status.conversion.targetAmount} TON\n` +
    `Your balance: ${userBalances.get(userId)} TON`
  );
}
} catch (error) {
await ctx.reply('❌ Conversion failed. Please contact support.');
}
});

// Webhook: Receive events from Payment Gateway
app.post('/webhook', async (req, res) => {
const { event, data } = req.body;

if (event === 'conversion.completed') {
// Notify user via Telegram
await bot.telegram.sendMessage(
data.telegramUserId,
✅ Your conversion is complete!\n +
Received: ${data.tonAmount} TON\n +
TX: ${data.txHash}
);
}

res.json({ success: true });
});

// Start servers
bot.launch();
app.listen(3000);

console.log('✅ Bot and webhook server running');

text

---

## Production Checklist

### Security

- ✅ Store API credentials in environment variables (never in code)
- ✅ Use HTTPS for all webhook endpoints
- ✅ Verify webhook signatures
- ✅ Implement rate limiting
- ✅ Validate all user inputs
- ✅ Use API secret for sensitive operations

### Reliability

- ✅ Implement retry logic for failed API calls
- ✅ Handle network timeouts gracefully
- ✅ Log all payment and conversion events
- ✅ Monitor webhook delivery failures
- ✅ Set up alerting for failed conversions

### Performance

- ✅ Cache exchange rates (update every 5-10 minutes)
- ✅ Use pagination for large result sets
- ✅ Implement connection pooling
- ✅ Use async/await for non-blocking operations

### Testing

- ✅ Test with small amounts first (1000 Stars minimum)
- ✅ Test webhook signature verification
- ✅ Test rate limit handling
- ✅ Test conversion failure scenarios
- ✅ Test network error handling

### Monitoring

- ✅ Track payment success rate
- ✅ Monitor conversion completion times
- ✅ Alert on failed conversions
- ✅ Monitor API response times
- ✅ Track Stars → TON exchange rate fluctuations

---

## Common Issues & Solutions

### Issue: "Minimum amount not met"

**Solution:** Minimum conversion is 1000 Stars. Accumulate payments before converting.

const { payments } = await gateway.listPayments({ status: 'received' });
const totalStars = payments.reduce((sum, p) => sum + p.starsAmount, 0);

if (totalStars >= 1000) {
await gateway.createConversion({
paymentIds: payments.map(p => p.id),
targetCurrency: 'TON'
});
}

text

### Issue: "Rate lock expired"

**Solution:** Lock rates have maximum 10-minute duration. Create conversion immediately after locking.

const rateLock = await gateway.lockRate({
starsAmount: 5000,
targetCurrency: 'TON',
durationSeconds: 300
});

// Create conversion within 5 minutes
const conversion = await gateway.createConversion({
paymentIds: paymentIds,
targetCurrency: 'TON',
rateLockId: rateLock.id
});

text

### Issue: "Webhook not receiving events"

**Solutions:**
1. Verify webhook URL is publicly accessible
2. Check webhook signature verification
3. Ensure HTTPS is enabled
4. Test with webhook testing tools (webhook.site)

---

## Next Steps

- **[API Reference](./API.md)** - Complete API documentation
- **[SDK Documentation](../packages/sdk/README.md)** - TypeScript SDK reference
- **[Examples](../examples/)** - Code examples and templates

## Support

- GitHub Issues: [Report a bug](https://github.com/toxzak-svg/telegram-payment-gateway/issues)
- Documentation: [docs.yourgateway.com](https://docs.yourgateway.com)