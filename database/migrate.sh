#!/bin/bash

# Database migration script for Telegram Payment Gateway
# Usage: ./database/migrate.sh [command]
# Commands: up, down, reset, status

set -e

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Database connection string
DB_URL="${DATABASE_URL:-postgresql://tg_user:tg_pass@localhost:5432/tg_payment_dev}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run SQL file
run_sql() {
    local file=$1
    echo -e "${YELLOW}Running: $file${NC}"
    psql "$DB_URL" -f "$file"
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Success: $file${NC}"
    else
        echo -e "${RED}✗ Failed: $file${NC}"
        exit 1
    fi
}

# Create migration tracking table
create_migration_table() {
    psql "$DB_URL" << EOF
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP DEFAULT NOW()
);
EOF
}

# Get applied migrations
get_applied_migrations() {
    psql "$DB_URL" -t -c "SELECT version FROM schema_migrations ORDER BY version;" 2>/dev/null || echo ""
}

# Record migration
record_migration() {
    local version=$1
    psql "$DB_URL" -c "INSERT INTO schema_migrations (version) VALUES ('$version') ON CONFLICT (version) DO NOTHING;"
}

# Command: migrate up
migrate_up() {
    echo -e "${GREEN}Starting database migration...${NC}"
    
    create_migration_table
    
    applied=$(get_applied_migrations)
    
    for file in database/migrations/*.sql; do
        filename=$(basename "$file")
        version="${filename%.*}"
        
        if echo "$applied" | grep -q "^ *$version *$"; then
            echo -e "${YELLOW}⊙ Skipping (already applied): $filename${NC}"
        else
            run_sql "$file"
            record_migration "$version"
        fi
    done
    
    echo -e "${GREEN}✓ Migration complete!${NC}"
}

# Command: show status
migrate_status() {
    echo -e "${GREEN}Migration Status:${NC}"
    echo ""
    
    create_migration_table
    applied=$(get_applied_migrations)
    
    echo "Applied migrations:"
    if [ -z "$applied" ]; then
        echo "  (none)"
    else
        echo "$applied" | sed 's/^/  ✓ /'
    fi
    
    echo ""
    echo "Pending migrations:"
    has_pending=false
    for file in database/migrations/*.sql; do
        filename=$(basename "$file")
        version="${filename%.*}"
        
        if ! echo "$applied" | grep -q "^ *$version *$"; then
            echo "  ⊙ $filename"
            has_pending=true
        fi
    done
    
    if [ "$has_pending" = false ]; then
        echo "  (none)"
    fi
}

# Command: reset database (DANGEROUS - dev only!)
migrate_reset() {
    echo -e "${RED}WARNING: This will DROP ALL TABLES!${NC}"
    read -p "Are you sure? Type 'yes' to continue: " confirm
    
    if [ "$confirm" != "yes" ]; then
        echo "Aborted."
        exit 0
    fi
    
    echo -e "${YELLOW}Dropping all tables...${NC}"
    
    psql "$DB_URL" << EOF
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO ${POSTGRES_USER:-tg_user};
GRANT ALL ON SCHEMA public TO public;
EOF
    
    echo -e "${GREEN}✓ Database reset complete${NC}"
    echo -e "${YELLOW}Running migrations...${NC}"
    migrate_up
}

# Main command router
case "${1:-up}" in
    up)
        migrate_up
        ;;
    status)
        migrate_status
        ;;
    reset)
        migrate_reset
        ;;
    *)
        echo "Usage: $0 {up|status|reset}"
        echo ""
        echo "Commands:"
        echo "  up     - Apply all pending migrations"
        echo "  status - Show migration status"
        echo "  reset  - Drop all tables and re-run migrations (DANGEROUS!)"
        exit 1
        ;;
esac
