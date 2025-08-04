# Cron Job Setup for Maintenance Schedule Generation

## Overview
This document explains the cron job setup for automatically generating maintenance schedules every 24 hours at 12 AM (IST).

## What the Cron Job Does

The cron job calls the maintenance schedule generation API endpoint:
- **Route**: `POST /api/maintenance-schedules/generate`
- **Function**: `generateMaintenanceSchedules` in `maintenanceScheduleController.js`
- **Schedule**: Every day at 12:00 AM (IST timezone)

## How It Works

1. **Schedule**: The cron job runs daily at midnight (12:00 AM) using IST timezone
2. **API Call**: It makes an HTTP POST request to the maintenance schedule generation endpoint
3. **Process**: The API processes all assets that require maintenance and creates workflow schedules
4. **Logging**: All activities are logged with timestamps and emojis for easy identification

## Files Created/Modified

### New Files:
- `services/cronService.js` - Main cron job service
- `services/cronController.js` - Controller for cron-related endpoints
- `routes/cronRoutes.js` - Routes for cron endpoints
- `CRON_JOB_SETUP.md` - This documentation

### Modified Files:
- `server.js` - Added cron service initialization and cron routes
- `package.json` - Added axios dependency

## API Endpoints

### Automatic Cron Job
- **Schedule**: `0 0 * * *` (Every day at 12 AM IST)
- **Function**: Automatically calls maintenance generation

### Manual Trigger (for testing)
- **Endpoint**: `POST /api/cron/trigger-maintenance`
- **Purpose**: Manually trigger maintenance generation for testing
- **Response**: Returns the result of the maintenance generation

### Status Check
- **Endpoint**: `GET /api/cron/status`
- **Purpose**: Check cron job configuration and status
- **Response**: Returns cron job schedule information

## Environment Variables

Add these to your `.env` file (optional):

```env
# Base URL for API calls (defaults to http://localhost:5001)
BASE_URL=http://localhost:5001

# Optional API token for authentication
CRON_API_TOKEN=your_api_token_here
```

## Testing the Cron Job

### 1. Manual Trigger
```bash
curl -X POST http://localhost:5001/api/cron/trigger-maintenance
```

### 2. Check Status
```bash
curl http://localhost:5001/api/cron/status
```

### 3. Monitor Logs
The cron job logs are prefixed with emojis for easy identification:
- 🕐 - Cron job started
- ✅ - Success
- ❌ - Error
- 📊 - Response data
- 📅 - Schedule information

## Maintenance Schedule Generation Process

The cron job triggers the following process:

1. **Get Asset Types**: Finds all asset types that require maintenance
2. **Process Assets**: For each asset type, processes all assets
3. **Check Schedules**: Verifies existing maintenance schedules
4. **Calculate Due Dates**: Determines when maintenance is due
5. **Create Workflows**: Generates workflow maintenance schedules
6. **Create Details**: Creates detailed maintenance schedule items

## Timezone Configuration

The cron job is configured to use IST (Asia/Kolkata) timezone:
- **Schedule**: `0 0 * * *` (midnight)
- **Timezone**: `Asia/Kolkata`
- **Actual Time**: 12:00 AM IST daily

## Error Handling

The cron job includes comprehensive error handling:
- API call failures are logged with details
- Network errors are caught and logged
- Authentication errors are handled gracefully
- All errors are logged with timestamps

## Monitoring

To monitor the cron job:
1. Check server logs for cron-related messages
2. Use the status endpoint to verify configuration
3. Monitor the maintenance schedule generation results
4. Check for any error messages in the logs

## Troubleshooting

### Common Issues:

1. **Cron job not running**: Check if node-cron is installed
2. **API call failing**: Verify the server is running and accessible
3. **Authentication errors**: Check if CRON_API_TOKEN is set correctly
4. **Timezone issues**: Verify the timezone configuration

### Debug Commands:

```bash
# Check if cron jobs are running
curl http://localhost:5001/api/cron/status

# Manually trigger maintenance generation
curl -X POST http://localhost:5001/api/cron/trigger-maintenance

# Check server logs for cron messages
# Look for messages starting with 🕐, ✅, ❌, 📊, 📅
``` 