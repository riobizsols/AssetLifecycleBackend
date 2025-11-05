#!/bin/bash

# PostgreSQL Backup Cron Setup Script
# This script sets up a cron job to run database backups every 24 hours

set -e

echo "=== PostgreSQL Backup Cron Setup ==="

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
BACKUP_SCRIPT="$PROJECT_ROOT/scripts/backup-database.js"
NODE_PATH=$(which node)

# Check if Node.js is installed
if [ -z "$NODE_PATH" ]; then
    echo "❌ Error: Node.js is not installed or not in PATH"
    exit 1
fi

echo "✅ Node.js found: $NODE_PATH"

# Check if backup script exists
if [ ! -f "$BACKUP_SCRIPT" ]; then
    echo "❌ Error: Backup script not found at $BACKUP_SCRIPT"
    exit 1
fi

echo "✅ Backup script found: $BACKUP_SCRIPT"

# Make backup script executable
chmod +x "$BACKUP_SCRIPT"
echo "✅ Made backup script executable"

# Check if .env file exists
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    echo "⚠️  Warning: .env file not found. Please ensure environment variables are set."
else
    echo "✅ .env file found"
fi

# Backup schedule (every day at 2:00 AM)
CRON_SCHEDULE="0 2 * * *"
CRON_COMMAND="$NODE_PATH $BACKUP_SCRIPT >> $PROJECT_ROOT/logs/backup-cron.log 2>&1"

# Create cron job entry
CRON_ENTRY="$CRON_SCHEDULE $CRON_COMMAND"

echo ""
echo "Cron job configuration:"
echo "  Schedule: Every day at 2:00 AM"
echo "  Command: $CRON_COMMAND"
echo ""

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "$BACKUP_SCRIPT"; then
    echo "⚠️  Warning: A backup cron job already exists"
    read -p "Do you want to replace it? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Remove existing cron job
        crontab -l 2>/dev/null | grep -v "$BACKUP_SCRIPT" | crontab -
        echo "✅ Removed existing cron job"
    else
        echo "❌ Cancelled. Keeping existing cron job."
        exit 0
    fi
fi

# Add new cron job
(crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -

echo "✅ Cron job added successfully!"
echo ""
echo "To view current cron jobs: crontab -l"
echo "To remove this cron job: crontab -e (then delete the line)"
echo ""
echo "=== Setup Complete ==="
