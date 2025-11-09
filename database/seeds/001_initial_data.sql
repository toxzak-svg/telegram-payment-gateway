-- Insert test user
INSERT INTO users (
  api_key, api_secret, app_name, description, kyc_status, is_active
) VALUES (
  'pk_test_' || encode(gen_random_bytes(12), 'hex'),
  encode(gen_random_bytes(32), 'hex'),
  'Test App',
  'Test application for local development',
  'verified',
  true
) ON CONFLICT DO NOTHING;

-- Insert common exchange rates (will be updated by background job)
INSERT INTO exchange_rates (source_currency, target_currency, rate, source_provider) VALUES
  ('STARS', 'TON', 0.013, 'fragment'),
  ('TON', 'USD', 5.50, 'binance'),
  ('TON', 'EUR', 5.00, 'kraken'),
  ('TON', 'GBP', 4.35, 'kraken')
ON CONFLICT DO NOTHING;
