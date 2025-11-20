# Telegram Payment Gateway SDK

TypeScript/JavaScript SDK for integrating with the Telegram Payment Gateway API.

## Installation

npm install @tg-payment/sdk

text

## Quick Start

import TelegramPaymentGateway from '@tg-payment/sdk';

// Initialize client
const gateway = new TelegramPaymentGateway({
  apiKey: 'pk_your_api_key',
  apiSecret: 'sk_your_api_secret',
  apiUrl: '<https://api.yourgateway.com/v1>', // optional
});// Estimate conversion
const estimate = await gateway.estimateConversion({
starsAmount: 5000,
targetCurrency: 'TON',
});

console.log('Estimated TON:', estimate.tonEquivalent);
console.log('Fees:', estimate.fees.total);

text

## Features

✅ **Full TypeScript support** - Complete type definitions for all methods  
✅ **Rate locking** - Lock exchange rates for time-sensitive conversions  
✅ **Payment tracking** - Monitor payment status in real-time  
✅ **Conversion management** - Create and track Stars → TON conversions  
✅ **Error handling** - Comprehensive error types and messages  

## API Reference

### Initialize Client

const gateway = new TelegramPaymentGateway({
apiKey: 'pk_xxx', // Required: Your public API key
apiSecret: 'sk_xxx', // Optional: Your secret API key
apiUrl: 'https://...', // Optional: Custom API URL
timeout: 30000, // Optional: Request timeout (default: 30s)
});

text

### Conversion Methods

#### Estimate Conversion

const estimate = await gateway.estimateConversion({
starsAmount: 5000,
targetCurrency: 'TON',
});

text

**Response:**
{
starsAmount: 5000,
tonEquivalent: 4.95,
exchangeRate: 0.00099,
fees: {
telegram: 50,
dex: 25,
total: 75
}
}

text

#### Lock Conversion Rate

const rateLock = await gateway.lockRate({
starsAmount: 5000,
targetCurrency: 'TON',
durationSeconds: 300, // 5 minutes
});

text

**Response:**
{
id: 'lock-uuid',
exchangeRate: 0.00099,
lockedUntil: 1699564800000,
starsAmount: 5000,
targetCurrency: 'TON'
}

text

#### Create Conversion

const conversion = await gateway.createConversion({
paymentIds: ['payment-uuid-1', 'payment-uuid-2'],
targetCurrency: 'TON',
rateLockId: 'lock-uuid', // optional
});

text

**Response:**
{
id: 'conversion-uuid',
status: 'pending',
sourceAmount: 5000,
targetAmount: 4.95,
exchangeRate: 0.00099,
createdAt: '2025-11-12T18:00:00Z'
}

text

#### Get Conversion Status

const status = await gateway.getConversionStatus('conversion-uuid');

text

**Response:**
{
status: 'completed',
  conversion: { /* conversion object */ },
progress: {
phase: 'phase3_confirmed',
percentage: 100,
estimatedCompletion: null
}
}

text

#### List Conversions

const result = await gateway.listConversions({
page: 1,
limit: 20,
status: 'completed', // optional filter
});

text

### Payment Methods

#### Get Payment

const payment = await gateway.getPayment('payment-uuid');

text

#### List Payments

const result = await gateway.listPayments({
page: 1,
limit: 20,
status: 'received', // optional filter
});

text

#### Get Payment Statistics

const stats = await gateway.getPaymentStats();

text

**Response:**
{
totalPayments: 150,
totalStars: 750000,
byStatus: {
pending: 5,
received: 120,
converting: 10,
completed: 15
}
}

text

### User Methods

#### Get User Profile

const profile = await gateway.getProfile();

text

#### Regenerate API Keys

const newKeys = await gateway.regenerateApiKeys();
console.log('New API Key:', newKeys.apiKey);
console.log('New Secret:', newKeys.apiSecret);

text

### Rate Methods

#### Get Exchange Rates

const rates = await gateway.getExchangeRates();

text

**Response:**
{
STARS: {
TON: 0.00099,
USD: 2.50,
EUR: 2.35
},
TON: {
USD: 2525.25,
EUR: 2375.50
}
}

text

## Error Handling

All methods throw `APIError` on failure:

import { APIError } from '@tg-payment/sdk';

try {
const estimate = await gateway.estimateConversion({
starsAmount: 500, // Below minimum
targetCurrency: 'TON',
});
} catch (error) {
if ((error as APIError).code === 'MINIMUM_AMOUNT_NOT_MET') {
console.error('Amount too small:', error.message);
}
}

text

**Error Structure:**
interface APIError {
message: string; // Human-readable error message
code: string; // Machine-readable error code
status: number; // HTTP status code
details?: any; // Additional error details
}

text

## TypeScript Support

All types are exported for your convenience:

import {
Conversion,
Payment,
ConversionStatusType,
Currency
} from '@tg-payment/sdk';

text

## License

MIT
