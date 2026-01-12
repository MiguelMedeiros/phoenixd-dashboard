#!/bin/sh
set -e

echo "Waiting for PostgreSQL to be ready..."

# Extract database connection info from DATABASE_URL
# Format: postgresql://user:password@host:port/database?schema=public
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')

# Wait for PostgreSQL to be ready
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
  if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
    echo "PostgreSQL is ready!"
    break
  fi
  attempt=$((attempt + 1))
  echo "Waiting for PostgreSQL... (attempt $attempt/$max_attempts)"
  sleep 2
done

if [ $attempt -eq $max_attempts ]; then
  echo "Error: PostgreSQL is not available after $max_attempts attempts"
  exit 1
fi

# Give PostgreSQL a moment to fully initialize
sleep 2

echo "Running Prisma migrations..."
npx prisma db push --skip-generate --accept-data-loss

echo "Starting application..."
exec "$@"
