# Telegram Payment Gateway - Fragment-Free Architecture
## Complete Development Plan for VS Code Copilot

<!-- 
PROJECT CONTEXT FOR COPILOT:
- Tech Stack: TypeScript, Node.js, PostgreSQL, Docker, npm workspaces
- Architecture: Microservices with shared core package
- Payment Flow: Telegram Stars → Manual TON withdrawal → Fiat conversion
- Key Constraint: No Fragment.com API (cannot complete KYC)
- Repository: github.com/toxzak-svg/telegram-payment-gateway
-->

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Project Structure](#project-structure)
4. [Database Schema](#database-schema)
5. [Core Services Implementation](#core-services-implementation)
6. [API Endpoints](#api-endpoints)
7. [SDK Development](#sdk-development)
8. [Deployment Guide](#deployment-guide)
9. [Development Timeline](#development-timeline)

---

## Project Overview

### Purpose
Build a payment processing gateway that converts Telegram Stars → TON → Fiat without using Fragment.com's KYC-gated services.

### Key Features
- ✅ Telegram Stars payment processing
- ✅ TON blockchain wallet management
- ✅ Manual TON deposit flow (user withdraws Stars themselves)
- ✅ DEX rate aggregation
- ✅ Automated fiat conversion tracking
- ✅ Developer-friendly SDK

### Technology Stack
language: TypeScript 5.x
runtime: Node.js 20.x LTS
framework: Express.js 4.x
database: PostgreSQL 16.x
blockchain: TonWeb SDK, @ton/core
containerization: Docker + Docker Compose
workspace: npm workspaces (monorepo)
hosting: Render/Railway (API), Vercel (docs)

text

### Cost Estimate
- **Development**: $0 (AI-assisted solo dev)
- **Monthly Hosting**: $25-40 (Render + PostgreSQL)
- **No Fragment fees**: Direct blockchain integration

---

## Architecture

### System Overview
┌─────────────────┐
│ Telegram Bot │
│ (User Payment) │
└────────┬────────┘
│ Stars Payment Received
▼
┌─────────────────────────────────────────┐
│ Payment Gateway API Server │
│ ┌───────────────────────────────────┐ │
│ │ Payment Webhook Handler │ │
│ └───────────┬───────────────────────┘ │
│ ▼ │
│ ┌───────────────────────────────────┐ │
│ │ Wallet Manager Service │ │
│ │ - Generate deposit address │ │
│ │ - Monitor blockchain │ │
│ │ - Verify confirmations │ │
│ └───────────┬───────────────────────┘ │
└──────────────┼──────────────────────────┘
│
▼
┌──────────────────────────────────────────┐
│ TON Blockchain │
│ ┌──────────────────────────────────┐ │
│ │ User manually withdraws: │ │
│ │ Stars → TON (via Telegram app) │ │
│ │ Sends TON to deposit address │ │
│ └──────────────┬───────────────────┘ │
└─────────────────┼────────────────────────┘
│ TON received
▼
┌─────────────────────────────────────────┐
│ Payment Gateway API Server │
│ ┌───────────────────────────────────┐ │
│ │ Transaction Monitor │ │
│ │ - Detect deposit │ │
│ │ - Wait for confirmations │ │
│ └───────────┬───────────────────────┘ │
│ ▼ │
│ ┌───────────────────────────────────┐ │
│ │ Rate Aggregator │ │
│ │ - Fetch DEX rates │ │
│ │ - Calculate best conversion │ │
│ └───────────┬───────────────────────┘ │
│ ▼ │
│ ┌───────────────────────────────────┐ │
│ │ Fiat Settlement Service │ │
│ │ - Track conversion │ │
│ │ - Process payout │ │
│ └───────────────────────────────────┘ │
└─────────────────────────────────────────┘

text

### Payment Flow Sequence
/* PAYMENT FLOW STATES */
enum PaymentStatus {
PENDING = 'pending', // Initial state
RECEIVED = 'received', // Stars payment confirmed
AWAITING_TON = 'awaiting_ton', // Deposit address created
TON_PENDING = 'ton_pending', // TON received, awaiting confirmations
TON_CONFIRMED = 'ton_confirmed', // TON confirmed (10+ blocks)
CONVERTING = 'converting', // Converting TON → Fiat
SETTLED = 'settled', // Fiat paid out
FAILED = 'failed' // Error occurred
}

text

---

## Project Structure

telegram-payment-gateway/
├── package.json # Workspace root
├── tsconfig.json # Shared TypeScript config
├── .env.example # Environment variables template
├── docker-compose.yml # Local development setup
│
├── packages/
│ ├── core/ # @tg-gateway/core
│ │ ├── package.json
│ │ ├── tsconfig.json
│ │ └── src/
│ │ ├── index.ts # Main exports
│ │ ├── types/
│ │ │ ├── payment.types.ts
│ │ │ ├── wallet.types.ts
│ │ │ ├── conversion.types.ts
│ │ │ └── index.ts
│ │ ├── services/
│ │ │ ├── telegram.service.ts # Telegram Bot API integration
│ │ │ ├── ton-blockchain.service.ts # TON blockchain operations
│ │ │ ├── wallet-manager.service.ts # Custody wallet management
│ │ │ ├── dex-aggregator.service.ts # DEX rate aggregation
│ │ │ ├── rate-aggregator.service.ts # Multi-source rate fetching
│ │ │ ├── payment-processor.service.ts # Payment state machine
│ │ │ ├── settlement.service.ts # Fiat settlement
│ │ │ └── reconciliation.service.ts # Balance reconciliation
│ │ ├── models/
│ │ │ ├── payment.model.ts
│ │ │ ├── wallet.model.ts
│ │ │ ├── transaction.model.ts
│ │ │ └── conversion.model.ts
│ │ └── utils/
│ │ ├── encryption.util.ts # Private key encryption
│ │ ├── ton-helper.util.ts # TON address helpers
│ │ ├── logger.util.ts # Winston logger
│ │ └── retry.util.ts # Retry logic
│ │
│ ├── api/ # @tg-gateway/api
│ │ ├── package.json
│ │ ├── tsconfig.json
│ │ └── src/
│ │ ├── server.ts # Express server entry
│ │ ├── app.ts # Express app configuration
│ │ ├── controllers/
│ │ │ ├── payment.controller.ts
│ │ │ ├── wallet.controller.ts
│ │ │ ├── conversion.controller.ts
│ │ │ ├── webhook.controller.ts
│ │ │ └── health.controller.ts
│ │ ├── routes/
│ │ │ ├── v1/
│ │ │ │ ├── payment.routes.ts
│ │ │ │ ├── wallet.routes.ts
│ │ │ │ ├── conversion.routes.ts
│ │ │ │ └── index.ts
│ │ │ └── index.ts
│ │ ├── middleware/
│ │ │ ├── auth.middleware.ts # API key validation
│ │ │ ├── rate-limit.middleware.ts # Rate limiting
│ │ │ ├── validation.middleware.ts # Request validation
│ │ │ ├── error.middleware.ts # Error handling
│ │ │ └── cors.middleware.ts
│ │ └── config/
│ │ ├── database.config.ts
│ │ ├── redis.config.ts
│ │ └── env.config.ts
│ │
│ ├── sdk/ # @tg-gateway/sdk
│ │ ├── package.json
│ │ ├── tsconfig.json
│ │ └── src/
│ │ ├── index.ts
│ │ ├── client.ts # Main SDK client
│ │ ├── types.ts # SDK type definitions
│ │ ├── errors.ts # Custom error classes
│ │ └── utils/
│ │ └── http.util.ts
│ │
│ └── worker/ # @tg-gateway/worker (Background jobs)
│ ├── package.json
│ ├── tsconfig.json
│ └── src/
│ ├── index.ts
│ ├── jobs/
│ │ ├── deposit-monitor.job.ts # Monitor blockchain deposits
│ │ ├── rate-updater.job.ts # Update exchange rates
│ │ ├── webhook-dispatcher.job.ts # Send webhooks to developers
│ │ └── settlement-processor.job.ts # Process fiat settlements
│ └── queue/
│ └── bull.config.ts
│
├── database/
│ ├── migrations/
│ │ ├── 001_initial_schema.sql
│ │ ├── 002_wallets_and_transactions.sql
│ │ ├── 003_deposits_and_conversions.sql
│ │ ├── 004_indexes.sql
│ │ └── 005_webhook_events.sql
│ └── seeds/
│ └── exchange_rates.seed.sql
│
├── docker/
│ ├── Dockerfile.api
│ ├── Dockerfile.worker
│ └── nginx.conf
│
└── docs/
├── API.md # API documentation
├── INTEGRATION.md # Developer integration guide
└── DEPLOYMENT.md # Deployment guide

text

---

## Database Schema

<!-- CONTEXT FOR COPILOT: PostgreSQL 16.x schema with UUID primary keys, JSONB for flexible data -->

-- database/migrations/001_initial_schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- USERS & AUTHENTICATION
-- ============================================================================

CREATE TABLE users (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
api_key VARCHAR(255) UNIQUE NOT NULL,
api_secret VARCHAR(255) NOT NULL,
app_name VARCHAR(255),
webhook_url TEXT,
webhook_secret VARCHAR(255),
settlement_address TEXT, -- Developer's TON wallet for withdrawals
is_active BOOLEAN DEFAULT true,
metadata JSONB DEFAULT '{}',
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_api_key ON users(api_key);

-- ============================================================================
-- PAYMENTS
-- ============================================================================

CREATE TABLE payments (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID REFERENCES users(id) ON DELETE CASCADE,

-- Telegram payment info
telegram_invoice_id VARCHAR(255),
telegram_payment_id VARCHAR(255) UNIQUE,
telegram_user_id BIGINT NOT NULL,
telegram_charge_id VARCHAR(255),

-- Payment details
stars_amount INTEGER NOT NULL, -- Amount in Stars
currency VARCHAR(10) DEFAULT 'STARS',

-- Status tracking
status VARCHAR(50) NOT NULL CHECK (status IN (
'pending',
'received',
'awaiting_ton',
'ton_pending',
'ton_confirmed',
'converting',
'settled',
'failed'
)),

-- Metadata
raw_payload JSONB, -- Full Telegram webhook payload
error_message TEXT,

-- Timestamps
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW(),
completed_at TIMESTAMP
);

CREATE INDEX idx_payments_user_id ON payments(user_id, created_at DESC);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_telegram_user ON payments(telegram_user_id);

-- ============================================================================
-- WALLETS
-- ============================================================================

CREATE TABLE wallets (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID REFERENCES users(id) ON DELETE CASCADE,

-- Wallet identification
wallet_address VARCHAR(255) UNIQUE NOT NULL,
wallet_type VARCHAR(50) NOT NULL CHECK (wallet_type IN (
'custody', -- Gateway-managed wallet
'hot', -- Hot wallet for operations
'cold', -- Cold storage
'user_provided' -- Developer's own wallet
)),

-- Cryptographic keys
public_key TEXT NOT NULL,
encrypted_private_key TEXT, -- AES-256 encrypted
encryption_iv VARCHAR(32), -- Initialization vector

-- Balance tracking
balance_ton DECIMAL(18, 8) DEFAULT 0,
balance_usd_equivalent DECIMAL(18, 2) DEFAULT 0,
last_sync_at TIMESTAMP,

-- Metadata
metadata JSONB DEFAULT '{}',
is_active BOOLEAN DEFAULT true,

-- Timestamps
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_wallets_address ON wallets(wallet_address);
CREATE INDEX idx_wallets_type ON wallets(wallet_type);

-- ============================================================================
-- TON TRANSACTIONS
-- ============================================================================

CREATE TABLE ton_transactions (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,

-- Transaction details
transaction_hash VARCHAR(255) UNIQUE NOT NULL,
from_address VARCHAR(255),
to_address VARCHAR(255),
amount_ton DECIMAL(18, 8) NOT NULL,

-- Transaction type
transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
'deposit', -- Incoming TON
'withdrawal', -- Outgoing TON
'internal_transfer', -- Between gateway wallets
'gas_fee' -- Gas payment
)),

-- Status
status VARCHAR(50) NOT NULL CHECK (status IN (
'pending',
'confirmed',
'failed'
)),

-- Blockchain info
block_number BIGINT,
confirmations INT DEFAULT 0,
gas_used DECIMAL(18, 8),
memo TEXT,

-- Metadata
raw_data JSONB,

-- Timestamps
created_at TIMESTAMP DEFAULT NOW(),
confirmed_at TIMESTAMP
);

CREATE INDEX idx_ton_tx_hash ON ton_transactions(transaction_hash);
CREATE INDEX idx_ton_tx_wallet ON ton_transactions(wallet_id, created_at DESC);
CREATE INDEX idx_ton_tx_status ON ton_transactions(status);
CREATE INDEX idx_ton_tx_addresses ON ton_transactions(from_address, to_address);

-- ============================================================================
-- MANUAL DEPOSITS (for Stars → TON manual withdrawal flow)
-- ============================================================================

CREATE TABLE manual_deposits (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID REFERENCES users(id) ON DELETE CASCADE,
wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,

-- Deposit details
expected_amount_ton DECIMAL(18, 8) NOT NULL,
received_amount_ton DECIMAL(18, 8),
deposit_address VARCHAR(255) NOT NULL,

-- Status tracking
status VARCHAR(50) NOT NULL CHECK (status IN (
'pending', -- Awaiting deposit
'awaiting_confirmation', -- Deposit detected
'confirmed', -- Deposit confirmed
'expired', -- Deposit window expired
'failed' -- Deposit failed
)),

-- Blockchain reference
ton_tx_hash VARCHAR(255),

-- Instructions
qr_code_data TEXT, -- TON payment deep link
instructions TEXT,

-- Timing
expires_at TIMESTAMP NOT NULL,
created_at TIMESTAMP DEFAULT NOW(),
confirmed_at TIMESTAMP
);

CREATE INDEX idx_deposits_user ON manual_deposits(user_id);
CREATE INDEX idx_deposits_payment ON manual_deposits(payment_id);
CREATE INDEX idx_deposits_status ON manual_deposits(status);
CREATE INDEX idx_deposits_expires ON manual_deposits(expires_at) WHERE status = 'pending';

-- ============================================================================
-- CONVERSIONS
-- ============================================================================

CREATE TABLE conversions (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
wallet_id UUID REFERENCES wallets(id),

-- Conversion details
source_currency VARCHAR(10) NOT NULL, -- STARS, TON
target_currency VARCHAR(10) NOT NULL, -- TON, USD, EUR, USDT
source_amount DECIMAL(18, 8) NOT NULL,
target_amount DECIMAL(18, 8),

-- Exchange rate
exchange_rate DECIMAL(18, 8) NOT NULL,
rate_source VARCHAR(50), -- dedust, stonfi, binance
rate_locked_at TIMESTAMP,
rate_locked_until BIGINT, -- Unix timestamp

-- Status tracking
status VARCHAR(50) NOT NULL CHECK (status IN (
'pending',
'rate_locked',
'awaiting_ton',
'ton_received',
'converting_fiat',
'completed',
'failed'
)),

-- Blockchain reference
ton_tx_hash VARCHAR(255),

-- Fees breakdown
fees JSONB DEFAULT '{}', -- {gas: 0.01, gateway: 0.15, exchange: 1.5}

-- Error handling
error_message TEXT,
retry_count INT DEFAULT 0,

-- Timestamps
created_at TIMESTAMP DEFAULT NOW(),
completed_at TIMESTAMP
);

CREATE INDEX idx_conversions_payment ON conversions(payment_id);
CREATE INDEX idx_conversions_status ON conversions(status);
CREATE INDEX idx_conversions_wallet ON conversions(wallet_id);

-- ============================================================================
-- SETTLEMENTS (Fiat payouts)
-- ============================================================================

CREATE TABLE settlements (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID REFERENCES users(id) ON DELETE CASCADE,
conversion_id UUID REFERENCES conversions(id) ON DELETE CASCADE,

-- Settlement details
fiat_amount DECIMAL(18, 2) NOT NULL,
fiat_currency VARCHAR(3) NOT NULL, -- USD, EUR, GBP

-- Payout details
exchange_platform VARCHAR(50), -- binance, kraken, manual
bank_account_id VARCHAR(255),
settlement_address TEXT,

-- Status tracking
status VARCHAR(50) NOT NULL CHECK (status IN (
'pending',
'processing',
'completed',
'failed'
)),

-- Metadata
settlement_reference VARCHAR(255), -- External transaction ID
metadata JSONB DEFAULT '{}',

-- Timestamps
settlement_date TIMESTAMP,
created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_settlements_user ON settlements(user_id, created_at DESC);
CREATE INDEX idx_settlements_status ON settlements(status);
CREATE INDEX idx_settlements_conversion ON settlements(conversion_id);

-- ============================================================================
-- EXCHANGE RATES CACHE
-- ============================================================================

CREATE TABLE exchange_rates (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
source_currency VARCHAR(10) NOT NULL,
target_currency VARCHAR(10) NOT NULL,
rate DECIMAL(18, 8) NOT NULL,
source VARCHAR(50) NOT NULL, -- coingecko, dedust, binance
timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rates_pair ON exchange_rates(source_currency, target_currency, timestamp DESC);
CREATE INDEX idx_rates_timestamp ON exchange_rates(timestamp DESC);

-- ============================================================================
-- WEBHOOK EVENTS
-- ============================================================================

CREATE TABLE webhook_events (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID REFERENCES users(id) ON DELETE CASCADE,

-- Event details
event_type VARCHAR(50) NOT NULL, -- payment.received, deposit.confirmed
payload JSONB NOT NULL,

-- Delivery tracking
status VARCHAR(50) NOT NULL CHECK (status IN (
'pending',
'sent',
'failed'
)),

-- Retry logic
retry_count INT DEFAULT 0,
max_retries INT DEFAULT 3,
next_retry_at TIMESTAMP,
last_error TEXT,

-- Response tracking
response_status INT,
response_body TEXT,

-- Timestamps
created_at TIMESTAMP DEFAULT NOW(),
sent_at TIMESTAMP
);

CREATE INDEX idx_webhooks_user ON webhook_events(user_id, created_at DESC);
CREATE INDEX idx_webhooks_status ON webhook_events(status, next_retry_at);
CREATE INDEX idx_webhooks_retry ON webhook_events(status) WHERE status = 'failed';

-- ============================================================================
-- AUDIT LOG
-- ============================================================================

CREATE TABLE audit_logs (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID REFERENCES users(id) ON DELETE SET NULL,

-- Action details
action VARCHAR(100) NOT NULL, -- payment.created, wallet.withdrawal
entity_type VARCHAR(50), -- payment, wallet, conversion
entity_id UUID,

-- Context
ip_address INET,
user_agent TEXT,
metadata JSONB DEFAULT '{}',

-- Timestamp
created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_action ON audit_logs(action);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = NOW();
RETURN NEW;
END;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); ``` --- ## Core Services Implementation ### 1. TON Blockchain Service <!-- COPILOT CONTEXT: Uses TonWeb SDK for blockchain interaction --> ``` // packages/core/src/services/ton-blockchain.service.ts import TonWeb from 'tonweb'; import { Address, Cell, toNano, fromNano } from '@ton/core'; import { Logger } from '../utils/logger.util'; import { RetryUtil } from '../utils/retry.util'; /* INTERFACES */ export interface WalletInfo { address: string; publicKey: string; privateKey: string; userId: string; type: 'custody' | 'hot' | 'cold'; } export interface Transaction { hash: string; from: string; to: string; amount: number; timestamp: number; confirmed: boolean; confirmations: number; } export interface TransactionDetails extends Transaction { fee: number; blockNumber: number; memo?: string; } export interface WalletCredentials { publicKey: string; privateKey: string; } /* SERVICE IMPLEMENTATION */ export class TonBlockchainService { private tonweb: TonWeb; private logger: Logger; private httpProvider: TonWeb.HttpProvider; private retryUtil: RetryUtil; constructor() { // Initialize TonWeb with public API this.httpProvider = new TonWeb.HttpProvider( process.env.TON_API_ENDPOINT || 'https://toncenter.com/api/v2/jsonRPC', { apiKey: process.env.TON_API_KEY || '' } ); this.tonweb = new TonWeb(this.httpProvider); this.logger = new Logger('TonBlockchainService'); this.retryUtil = new RetryUtil(); } /** * Generate new custody wallet for user deposits * @param userId - User identifier * @returns WalletInfo with address and keys */ async createCustodyWallet(userId: string): Promise<WalletInfo> { try { // Generate new key pair const keyPair = TonWeb.utils.nacl.sign.keyPair(); // Create wallet contract const WalletClass = this.tonweb.wallet.all['v4R2']; const wallet = new WalletClass(this.tonweb.provider, { publicKey: keyPair.publicKey, wc: 0 // Workchain 0 (main chain) }); const address = await wallet.getAddress(); const addressString = address.toString(true, true, true); // user-friendly format const walletInfo: WalletInfo = { address: addressString, publicKey: TonWeb.utils.bytesToHex(keyPair.publicKey), privateKey: TonWeb.utils.bytesToHex(keyPair.secretKey), userId: userId, type: 'custody' }; this.logger.info(`Created custody wallet for user ${userId}: ${addressString}`); return walletInfo; } catch (error) { this.logger.error(`Failed to create custody wallet:`, error); throw new Error(`Wallet creation failed: ${error}`); } } /** * Monitor TON deposits to a specific address * @param walletAddress - Address to monitor * @param callback - Function to call when deposit detected */ async monitorDeposits( walletAddress: string, callback: (tx: Transaction) => Promise<void> ): Promise<void> { const address = new TonWeb.utils.Address(walletAddress); let lastProcessedLt: string | null = null; const poll = async () => { try { const transactions = await this.tonweb.getTransactions(address, 20); for (const tx of transactions) { // Skip if already processed if (lastProcessedLt && tx.transaction_id.lt <= lastProcessedLt) { continue; } // Check if transaction is incoming if (tx.in_msg && tx.in_msg.source && tx.in_msg.value) { const amount = parseFloat(TonWeb.utils.fromNano(tx.in_msg.value)); // Get current block for confirmations const masterchainInfo = await this.tonweb.provider.getMasterchainInfo(); const confirmations = masterchainInfo.last.seqno - (tx.data?.block_id?.seqno || 0); const transaction: Transaction = { hash: tx.transaction_id.hash, from: tx.in_msg.source, to: walletAddress, amount: amount, timestamp: tx.utime || Date.now() / 1000, confirmed: confirmations >= 10, confirmations: confirmations }; await callback(transaction); } lastProcessedLt = tx.transaction_id.lt; } } catch (error) { this.logger.error(`Error monitoring deposits for ${walletAddress}:`, error); } }; // Initial poll await poll(); // Set up recurring polling (every 30 seconds) const intervalId = setInterval(poll, 30000); // Store interval ID for cleanup (implement cleanup method separately) return; } /** * Get TON balance of an address * @param walletAddress - Wallet address to check * @returns Balance in TON */ async getBalance(walletAddress: string): Promise<number> { try { const address = new TonWeb.utils.Address(walletAddress); const balance = await this.retryUtil.withRetry( () => this.tonweb.getBalance(address), { maxRetries: 3, delayMs: 1000 } ); return parseFloat(TonWeb.utils.fromNano(balance)); } catch (error) { this.logger.error(`Failed to get balance for ${walletAddress}:`, error); throw new Error(`Balance check failed: ${error}`); } } /** * Send TON from custody wallet to destination * @param fromWallet - Source wallet credentials * @param toAddress - Destination address * @param amount - Amount in TON * @param memo - Optional memo/comment * @returns Transaction hash */ async sendTON( fromWallet: WalletCredentials, toAddress: string, amount: number, memo?: string ): Promise<string> { try { // Reconstruct wallet from credentials const publicKeyBytes = TonWeb.utils.hexToBytes(fromWallet.publicKey); const privateKeyBytes = TonWeb.utils.hexToBytes(fromWallet.privateKey); const WalletClass = this.tonweb.wallet.all['v4R2']; const wallet = new WalletClass(this.tonweb.provider, { publicKey: publicKeyBytes, wc: 0 }); // Get current seqno const seqno = await wallet.methods.seqno().call() || 0; // Prepare transfer const transfer = wallet.methods.transfer({ secretKey: privateKeyBytes, toAddress: toAddress, amount: TonWeb.utils.toNano(amount.toString()), seqno: seqno, payload: memo || '', sendMode: 3 }); // Send transaction const result = await transfer.send(); const txHash = TonWeb.utils.bytesToHex(result); this.logger.info(`Sent ${amount} TON to ${toAddress}, tx: ${txHash}`); return txHash; } catch (error) { this.logger.error(`Failed to send TON:`, error); throw new Error(`Transaction failed: ${error}`); } } /** * Verify transaction has sufficient confirmations * @param txHash - Transaction hash * @param minConfirmations - Minimum confirmations required (default: 10) * @returns true if confirmed */ async verifyTransaction( txHash: string, minConfirmations: number = 10 ): Promise<boolean> { try { // Note: TonWeb doesn't have direct getTransaction by hash // Need to implement custom logic or use TON HTTP API directly const response = await fetch( `${process.env.TON_API_ENDPOINT}/getTransactions?hash=${txHash}`, { headers: { 'X-API-Key': process.env.TON_API_KEY || '' } } ); const data = await response.json(); if (!data.ok || !data.result || data.result.length === 0) { return false; } const tx = data.result; // Get current block const masterchainInfo = await this.tonweb.provider.getMasterchainInfo(); const currentBlock = masterchainInfo.last.seqno; const confirmations = currentBlock - (tx.block_id?.seqno || 0); return confirmations >= minConfirmations; } catch (error) { this.logger.error(`Failed to verify transaction ${txHash}:`, error); return false; } } /** * Get detailed transaction information * @param txHash - Transaction hash * @returns Transaction details */ async getTransactionDetails(txHash: string): Promise<TransactionDetails | null> { try { const response = await fetch( `${process.env.TON_API_ENDPOINT}/getTransactions?hash=${txHash}`, { headers: { 'X-API-Key': process.env.TON_API_KEY || '' } } ); const data = await response.json(); if (!data.ok || !data.result || data.result.length === 0) { return null; } const tx = data.result; const masterchainInfo = await this.tonweb.provider.getMasterchainInfo(); const confirmations = masterchainInfo.last.seqno - (tx.block_id?.seqno || 0); return { hash: txHash, from: tx.in_msg?.source || '', to: tx.out_msgs?.?.destination || '', amount: parseFloat(TonWeb.utils.fromNano(tx.in_msg?.value || '0')), fee: parseFloat(TonWeb.utils.fromNano(tx.fee || '0')), timestamp: tx.utime || 0, confirmed: confirmations >= 10, confirmations: confirmations, blockNumber: tx.block_id?.seqno || 0, memo: tx.in_msg?.message || undefined }; } catch (error) { this.logger.error(`Failed to get transaction details for ${txHash}:`, error); return null; } } /** * Validate TON address format * @param address - Address to validate * @returns true if valid */ isValidAddress(address: string): boolean { try { new TonWeb.utils.Address(address); return true; } catch { return false; } } /** * Generate TON payment deep link for mobile wallets * @param address - Destination address * @param amount - Amount in TON * @param memo - Optional memo * @returns ton:// deep link */ generatePaymentLink(address: string, amount: number, memo?: string): string { const amountNano = Math.floor(amount * 1e9); let link = `ton://transfer/${address}?amount=${amountNano}`; if (memo) { link += `&text=${encodeURIComponent(memo)}`; } return link; } } ``` ### 2. Wallet Manager Service ``` // packages/core/src/services/wallet-manager.service.ts import { TonBlockchainService } from './ton-blockchain.service'; import { EncryptionUtil } from '../utils/encryption.util'; import { Logger } from '../utils/logger.util'; import { Database } from '../database'; /* INTERFACES */ export interface DepositInfo { depositId: string; address: string; expectedAmount: number; expiresAt: Date; qrCode: string; paymentLink: string; } export interface WalletBalance { address: string; balanceTON: number; balanceUSD: number; lastSyncAt: Date; } /* SERVICE IMPLEMENTATION */ export class WalletManagerService { private tonService: TonBlockchainService; private db: Database; private encryptionUtil: EncryptionUtil; private logger: Logger; constructor(db: Database, tonService: TonBlockchainService) { this.db = db; this.tonService = tonService; this.encryptionUtil = new EncryptionUtil(process.env.WALLET_ENCRYPTION_KEY!); this.logger = new Logger('WalletManagerService'); } /** * Create deposit address for user to manually send TON * @param userId - User ID * @param paymentId - Associated payment ID * @param expectedAmount - Expected TON amount * @returns Deposit information including address and QR code */ async createDepositAddress( userId: string, paymentId: string, expectedAmount: number ): Promise<DepositInfo> { try { // Get or create custody wallet for user let wallet = await this.db.wallets.findByUserId(userId); if (!wallet) { const walletInfo = await this.tonService.createCustodyWallet(userId); wallet = await this.db.wallets.create({ user_id: userId, wallet_address: walletInfo.address, wallet_type: 'custody', public_key: walletInfo.publicKey, encrypted_private_key: this.encryptionUtil.encrypt(walletInfo.privateKey), balance_ton: 0, is_active: true }); } // Create manual deposit record const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours const deposit = await this.db.manual_deposits.create({ user_id: userId, wallet_id: wallet.id, payment_id: paymentId, expected_amount_ton: expectedAmount, deposit_address: wallet.wallet_address, status: 'pending', expires_at: expiresAt }); // Generate payment link const paymentLink = this.tonService.generatePaymentLink( wallet.wallet_address, expectedAmount, `Payment ${paymentId.substring(0, 8)}` ); // Start monitoring this address this.startDepositMonitoring(deposit.id, wallet.wallet_address, expectedAmount); return { depositId: deposit.id, address: wallet.wallet_address, expectedAmount: expectedAmount, expiresAt: expiresAt, qrCode: paymentLink, paymentLink: paymentLink }; } catch (error) { this.logger.error(`Failed to create deposit address:`, error); throw new Error(`Deposit address creation failed: ${error}`); } } /** * Monitor incoming deposits to wallet * @private */ private async startDepositMonitoring( depositId: string, address: string, expectedAmount: number ): Promise<void> { await this.tonService.monitorDeposits(address, async (tx) => { const deposit = await this.db.manual_deposits.findById(depositId); // Check if already processed or expired if (!deposit || deposit.status !== 'pending') { return; } // Check if deposit expired if (new Date() > deposit.expires_at) { await this.db.manual_deposits.update(depositId, { status: 'expired' }); return; } // Verify amount matches (with 1% tolerance) const tolerance = expectedAmount * 0.01; const amountMatch = Math.abs(tx.amount - expectedAmount) <= tolerance; if (amountMatch) { await this.db.manual_deposits.update(depositId, { received_amount_ton: tx.amount, ton_tx_hash: tx.hash, status: 'awaiting_confirmation' }); this.logger.info(`Deposit detected: ${tx.amount} TON to ${address}, tx: ${tx.hash}`); // Wait for confirmations this.verifyDepositConfirmation(depositId, tx.hash); } }); } /** * Verify deposit has sufficient confirmations * @private */ private async verifyDepositConfirmation( depositId: string, txHash: string ): Promise<void> { const maxAttempts = 60; // 30 minutes (30s intervals) let attempts = 0; const checkConfirmation = async () => { attempts++; const isConfirmed = await this.tonService.verifyTransaction(txHash, 10); if (isConfirmed) { const deposit = await this.db.manual_deposits.findById(depositId); // Update deposit status await this.db.manual_deposits.update(depositId, { status: 'confirmed', confirmed_at: new Date() }); // Update wallet balance if (deposit.wallet_id && deposit.received_amount_ton) { await this.db.wallets.incrementBalance( deposit.wallet_id, deposit.received_amount_ton ); } // Trigger conversion if payment is waiting if (deposit.payment_id) { await this.triggerConversion(deposit.payment_id, deposit.received_amount_ton); } this.logger.info(`Deposit confirmed: ${depositId}, tx: ${txHash}`); } else if (attempts < maxAttempts) { // Retry after 30 seconds setTimeout(checkConfirmation, 30000); } else { this.logger.error(`Deposit confirmation timeout: ${depositId}`); await this.db.manual_deposits.update(depositId, { status: 'failed' }); } }; // Start checking checkConfirmation(); } /** * Get wallet balance (synced with blockchain) * @param userId - User ID * @returns Wallet balance information */ async getWalletBalance(userId: string): Promise<WalletBalance> { const wallet = await this.db.wallets.findByUserId(userId); if (!wallet) { throw new Error('Wallet not found'); } // Sync on-chain balance const onChainBalance = await this.tonService.getBalance(wallet.wallet_address); // Update database if different if (Math.abs(onChainBalance - wallet.balance_ton) > 0.0001) { await this.db.wallets.update(wallet.id, { balance_ton: onChainBalance, last_sync_at: new Date() }); } // Get TON/USD rate const usdValue = await this.convertTONtoUSD(onChainBalance); return { address: wallet.wallet_address, balanceTON: onChainBalance, balanceUSD: usdValue, lastSyncAt: new Date() }; } /** * Withdraw TON from custody wallet to external address * @param userId - User ID * @param toAddress - Destination address * @param amount - Amount in TON * @returns Transaction hash */ async withdrawTON( userId: string, toAddress: string, amount: number ): Promise<string> { const wallet = await this.db.wallets.findByUserId(userId); if (!wallet) { throw new Error('Wallet not found'); } if (wallet.balance_ton < amount) { throw new Error(`Insufficient balance: ${wallet.balance_ton} TON available`); } // Validate destination address if (!this.tonService.isValidAddress(toAddress)) { throw new Error('Invalid destination address'); } // Decrypt private key const privateKey = this.encryptionUtil.decrypt(wallet.encrypted_private_key); // Send transaction const txHash = await this.tonService.sendTON( { publicKey: wallet.public_key, privateKey: privateKey }, toAddress, amount, `Withdrawal by ${userId}` ); // Record transaction await this.db.ton_transactions.create({ wallet_id: wallet.id, transaction_hash: txHash, from_address: wallet.wallet_address, to_address: toAddress, amount_ton: amount, transaction_type: 'withdrawal', status: 'pending' }); // Update balance await this.db.wallets.decrementBalance(wallet.id, amount); this.logger.info(`Withdrawal initiated: ${amount} TON to ${toAddress}, tx: ${txHash}`); return txHash; } /** * Trigger conversion after TON deposit confirmed * @private */ private async triggerConversion( paymentId: string, tonAmount: number ): Promise<void> { // Update payment status await this.db.payments.update(paymentId, { status: 'ton_confirmed' }); // Notify conversion service (implement separately) this.logger.info(`Triggering conversion for payment ${paymentId}: ${tonAmount} TON`); } /** * Convert TON amount to USD equivalent * @private */ private async convertTONtoUSD(tonAmount: number): Promise<number> { const rate = await this.db.exchange_rates.findLatest('TON', 'USD'); if (!rate) { throw new Error('TON/USD rate not available'); } return tonAmount * rate.rate; } } ``` --- ## Configuration Files ### Root package.json ``` { "name": "telegram-payment-gateway", "version": "1.0.0", "private": true, "workspaces": [ "packages/*" ], "scripts": { "dev": "npm run dev --workspace=@tg-gateway/api", "build": "npm run build --workspaces", "test": "npm run test --workspaces", "lint": "eslint packages/*/src --ext .ts", "db:migrate": "node scripts/migrate.js", "db:seed": "node scripts/seed.js", "docker:up": "docker-compose up -d", "docker:down": "docker-compose down" }, "devDependencies": { "@types/node": "^20.10.0", "@typescript-eslint/eslint-plugin": "^6.15.0", "@typescript-eslint/parser": "^6.15.0", "eslint": "^8.56.0", "typescript": "^5.3.3" } } ``` ### docker-compose.yml ``` version: '3.9' services: # PostgreSQL Database postgres: image: postgres:16-alpine container_name: tg-gateway-db environment: POSTGRES_DB: telegram_gateway POSTGRES_USER: gateway_user POSTGRES_PASSWORD: gateway_password ports: - "5432:5432" volumes: - postgres_data:/var/lib/postgresql/data - ./database/migrations:/docker-entrypoint-initdb.d healthcheck: test: ["CMD-SHELL", "pg_isready -U gateway_user -d telegram_gateway"] interval: 10s timeout: 5s retries: 5 # Redis (for job queues) redis: image: redis:7-alpine container_name: tg-gateway-redis ports: - "6379:6379" volumes: - redis_data:/data healthcheck: test: ["CMD", "redis-cli", "ping"] interval: 10s timeout: 3s retries: 5 # API Server api: build: context: . dockerfile: docker/Dockerfile.api container_name: tg-gateway-api environment: NODE_ENV: development DATABASE_URL: postgresql://gateway_user:gateway_password@postgres:5432/telegram_gateway REDIS_URL: redis://redis:6379 TON_API_ENDPOINT: https://toncenter.com/api/v2/jsonRPC TON_API_KEY: ${TON_API_KEY} WALLET_ENCRYPTION_KEY: ${WALLET_ENCRYPTION_KEY} JWT_SECRET: ${JWT_SECRET} ports: - "3000:3000" depends_on: postgres: condition: service_healthy redis: condition: service_healthy volumes: - ./packages:/app/packages - /app/node_modules command: npm run dev --workspace=@tg-gateway/api # Background Worker worker: build: context: . dockerfile: docker/Dockerfile.worker container_name: tg-gateway-worker environment: NODE_ENV: development DATABASE_URL: postgresql://gateway_user:gateway_password@postgres:5432/telegram_gateway REDIS_URL: redis://redis:6379 TON_API_ENDPOINT: https://toncenter.com/api/v2/jsonRPC TON_API_KEY: ${TON_API_KEY} depends_on: postgres: condition: service_healthy redis: condition: service_healthy volumes: - ./packages:/app/packages - /app/node_modules command: npm run dev --workspace=@tg-gateway/worker volumes: postgres_data: redis_data: ``` ### .env.example ``` # Database DATABASE_URL=postgresql://gateway_user:gateway_password@localhost:5432/telegram_gateway # Redis REDIS_URL=redis://localhost:6379 # TON Blockchain TON_API_ENDPOINT=https://toncenter.com/api/v2/jsonRPC TON_API_KEY=your_toncenter_api_key_here # Security WALLET_ENCRYPTION_KEY=your_256_bit_hex_key_here JWT_SECRET=your_jwt_secret_here API_SECRET_KEY=your_api_secret_here # Server PORT=3000 NODE_ENV=development # Telegram TELEGRAM_BOT_TOKEN=your_bot_token_here # Rate Providers COINGECKO_API_KEY=optional BINANCE_API_KEY=optional BINANCE_API_SECRET=optional # Webhook WEBHOOK_TIMEOUT_MS=5000 WEBHOOK_MAX_RETRIES=3 # Monitoring LOG_LEVEL=info SENTRY_DSN=optional ``` --- ## Development Timeline <!-- COPILOT CONTEXT: 16-week development plan for solo developer with AI assistance --> ### **Phase 1: Foundation (Weeks 1-4)** **Week 1: Project Setup** - [ ] Initialize npm workspace - [ ] Set up TypeScript configuration - [ ] Configure ESLint & Prettier - [ ] Create Docker Compose environment - [ ] Set up PostgreSQL database - [ ] Run initial migrations **Week 2: Core Database** - [ ] Implement all database migrations - [ ] Create database utility functions - [ ] Write seed data - [ ] Test database connections - [ ] Set up transaction helpers **Week 3: TON Integration** - [ ] Implement TonBlockchainService - [ ] Test wallet creation - [ ] Test balance checking - [ ] Test transaction sending - [ ] Test transaction monitoring **Week 4: Wallet Management** - [ ] Implement WalletManagerService - [ ] Test deposit address creation - [ ] Test deposit monitoring - [ ] Test encryption/decryption - [ ] Test wallet balance sync ### **Phase 2: Payment Processing (Weeks 5-8)** **Week 5: Telegram Integration** - [ ] Implement TelegramService - [ ] Set up webhook handler - [ ] Test Stars payment reception - [ ] Implement payment validation **Week 6: Payment Flow** - [ ] Implement PaymentProcessorService - [ ] Create payment state machine - [ ] Test Stars → TON conversion flow - [ ] Implement error handling **Week 7: Rate Aggregation** - [ ] Implement DexAggregatorService - [ ] Connect to DeDust API - [ ] Connect to Ston.fi API - [ ] Implement rate caching - [ ] Test rate fetching **Week 8: Conversion Logic** - [ ] Implement conversion service - [ ] Test TON → Fiat calculation - [ ] Implement fee calculation - [ ] Test rate locking ### **Phase 3: API Development (Weeks 9-12)** **Week 9: Express Server** - [ ] Set up Express application - [ ] Implement middleware (auth, rate limit, CORS) - [ ] Create base routes - [ ] Implement error handling **Week 10: API Endpoints** - [ ] Implement payment endpoints - [ ] Implement wallet endpoints - [ ] Implement conversion endpoints - [ ] Write API documentation **Week 11: Webhook System** - [ ] Implement webhook dispatcher - [ ] Create retry logic - [ ] Test webhook delivery - [ ] Implement webhook verification **Week 12: SDK Development** - [ ] Create SDK client - [ ] Write SDK documentation - [ ] Create code examples - [ ] Publish to npm ### **Phase 4: Production Ready (Weeks 13-16)** **Week 13: Background Workers** - [ ] Implement deposit monitor job - [ ] Implement rate updater job - [ ] Implement webhook dispatcher job - [ ] Set up job queues **Week 14: Testing** - [ ] Write unit tests - [ ] Write integration tests - [ ] Perform end-to-end testing - [ ] Security audit **Week 15: Deployment** - [ ] Deploy to Render - [ ] Set up production database - [ ] Configure environment variables - [ ] Set up monitoring **Week 16: Documentation & Launch** - [ ] Write integration guide - [ ] Create video tutorials - [ ] Set up support system - [ ] Soft launch --- ## Next Steps ### Immediate Actions 1. **Clone repository structure** - Create all directories listed in Project Structure 2. **Initialize npm workspace** - Run `npm init` in root and packages 3. **Set up Docker environment** - Copy docker-compose.yml and start containers 4. **Run database migrations** - Execute all migration files 5. **Implement TON service** - Start with TonBlockchainService (most critical) ### First Commands to Run ``` # 1. Clone or create repository git clone https://github.com/toxzak-svg/telegram-payment-gateway.git cd telegram-payment-gateway # 2. Create package.json files npm init -w packages/core npm init -w packages/api npm init -w packages/sdk npm init -w packages/worker # 3. Install dependencies npm install # 4. Start Docker environment docker-compose up -d # 5. Run migrations npm run db:migrate # 6. Start development server npm run dev ``` ### Files to Create First (Priority Order) 1. `packages/core/src/services/ton-blockchain.service.ts` - Core blockchain integration 2. `packages/core/src/utils/encryption.util.ts` - Wallet encryption 3. `packages/core/src/services/wallet-manager.service.ts` - Wallet management 4. `database/migrations/001_initial_schema.sql` - Database schema 5. `packages/api/src/server.ts` - API server entry point --- ## Repository Information - **GitHub**: github.com/toxzak-svg/telegram-payment-gateway - **Tech Stack**: TypeScript, Node.js, PostgreSQL, Docker, TON blockchain - **Constraint**: No Fragment.com API (KYC not completed) - **Architecture**: Microservices with npm workspaces - **Editor**: VS Code with GitHub Copilot enabled **Remember**: After each successful implementation and test run (no errors), push to GitHub: ``` git add . git commit -m "feat: implement [feature name]" git push origin main ``` --- *This document is optimized for VS Code Copilot. Use inline comments like `// COPILOT: implement X` to get context-aware suggestions.* ``` This markdown file is now: 1. **Copilot-optimized** with context markers and clear structure 2. **Downloadable** - ready to save as `TELEGRAM_GATEWAY_PLAN.md` 3. **Implementation-ready** - complete code examples with comments 4. **Fragment-free** - no KYC dependencies 5. **Production-focused** - includes deployment configuration Save this file to your project root, and VS Code Copilot will use it as context for generating code throughout your repository!