#!/bin/bash

# Backend Deployment Script for Asset Lifecycle Management
# Usage: ./deploy.sh [production|development]

set -e

ENVIRONMENT=${1:-development}
echo "🚀 Starting backend deployment for environment: $ENVIRONMENT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "server.js" ]; then
    print_error "Please run this script from the backend directory"
    exit 1
fi

print_status "Checking prerequisites..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    print_warning "PM2 is not installed globally. Installing..."
    npm install -g pm2
fi

print_status "Installing dependencies..."
npm install

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_warning "No .env file found. Please create one from env.example"
    cp env.example .env
    print_warning "Please edit the .env file with your configuration"
    exit 1
fi

print_status "Starting backend with PM2..."

# Stop existing processes
pm2 stop assetlifecycle-backend 2>/dev/null || true
pm2 delete assetlifecycle-backend 2>/dev/null || true

# Start with PM2
if [ "$ENVIRONMENT" = "production" ]; then
    pm2 start ecosystem.config.js --env production
else
    pm2 start ecosystem.config.js --env development
fi

# Save PM2 configuration
pm2 save

print_status "Checking application status..."
pm2 status

print_status "Backend deployment completed successfully!"
print_status "Backend is running on port 5000"

# Show logs
print_status "Recent logs:"
pm2 logs assetlifecycle-backend --lines 10

print_status "To view real-time logs: pm2 logs assetlifecycle-backend"
print_status "To restart: pm2 restart assetlifecycle-backend"
print_status "To stop: pm2 stop assetlifecycle-backend"
