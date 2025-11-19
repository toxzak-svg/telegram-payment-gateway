#!/bin/bash
set -e

echo "🚀 Running Render deployment script..."

# Run database migrations
echo "📦 Running database migrations..."
node database/migrate.js up

echo "✅ Deployment setup complete!"
