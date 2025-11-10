-- Migration: Create users table for API key/token auth

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_name VARCHAR(255) UNIQUE NOT NULL,
  api_key VARCHAR(100) UNIQUE NOT NULL,
  api_secret VARCHAR(100) NOT NULL,
  webhook_url TEXT,
  kyc_status VARCHAR(10) DEFAULT 'pending',
  is_active BOOLEAN DEFAULT TRUE,
  total_stars_received INT DEFAULT 0,
  total_conversions INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index to optimize key lookup
CREATE INDEX IF NOT EXISTS idx_users_api_key ON users (api_key);
