#!/bin/sh
set -e

echo "=========================================="
echo "  SurgiHistory Backend Starting..."
echo "=========================================="

# Wait for database to be ready
echo "Waiting for database connection..."
while ! nc -z postgres 5432; do
  sleep 1
done
echo "Database is ready!"

# Run Prisma migrations
echo "Running database migrations..."
npx prisma migrate deploy

echo "Migrations completed successfully!"

# Run database seed (creates admin account if not exists)
echo "Running database seed..."
npx prisma db seed

echo "Seed completed successfully!"

# Start the application
echo "Starting the server..."
exec npm start
