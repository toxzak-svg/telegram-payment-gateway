-- Sample seed data for development
-- Insert sample user
INSERT INTO users (id, api_key, api_secret, app_name, webhook_url, kyc_status)
VALUES 
  (gen_random_uuid(), 'dev_api_key_123', 'dev_api_secret_456', 'Dev Test App', 'http://localhost:3001/webhook', 'pending')
ON CONFLICT DO NOTHING;

-- Sample exchange rates
INSERT INTO exchange_rates (id, source_currency, target_currency, rate, source_provider)
VALUES
  (gen_random_uuid(), 'STARS', 'TON', 0.0013, 'dedust'),
  (gen_random_uuid(), 'TON', 'USD', 2.45, 'coingecko'),
  (gen_random_uuid(), 'TON', 'EUR', 2.28, 'coingecko')
ON CONFLICT DO NOTHING;

COMMIT;
