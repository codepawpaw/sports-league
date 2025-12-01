# Challenge Notification Troubleshooting Guide

## Problem
Challenge notifications are not appearing in Google Chat when new challenges are created.

## Quick Diagnosis

### Step 1: Run the Debug Script

```bash
# Install dependencies if needed
npm install @supabase/supabase-js

# Set your environment variables and run the debug script
SUPABASE_URL=your_supabase_url SUPABASE_ANON_KEY=your_anon_key node debug-challenge-notifications.js your-league-slug
```

### Step 2: Check Server Logs

After creating a challenge, check your server logs (Vercel logs, console, etc.) for these messages:
- `"Sending challenge notification:"` - Should show the notification payload
- `"Challenge notification sent successfully:"` - Indicates successful notification
- `"Challenge notification failed:"` - Shows any errors

## Common Issues & Solutions

### Issue 1: No Chat Integration Configured
**Symptoms:** Debug script shows "❌ No chat integration configured"

**Solution:**
1. Go to your league admin page
2. Navigate to Chat Integration settings
3. Add a Google Chat webhook URL
4. Enable challenge notifications

### Issue 2: Chat Integration Disabled
**Symptoms:** Debug script shows integration exists but is disabled

**Solution:**
1. Go to league admin settings
2. Enable the chat integration
3. Make sure "Challenge notifications" is checked

### Issue 3: Invalid Webhook URL
**Symptoms:** Debug script shows "❌ Invalid webhook URL format"

**Solution:**
1. Verify your webhook URL starts with `https://chat.googleapis.com/v1/spaces/`
2. Re-generate the webhook in Google Chat if needed
3. Update the URL in admin settings

### Issue 4: Network/Server Issues
**Symptoms:** Debug script shows "❌ Failed to reach notification endpoint"

**Solutions:**
1. Check if your app is running and accessible
2. Verify `NEXT_PUBLIC_APP_URL` environment variable is set correctly
3. Check firewall settings
4. Test with a simple curl request

### Issue 5: Google Chat Webhook Expired
**Symptoms:** Endpoint responds successfully but no message appears in chat

**Solutions:**
1. Webhook URLs can expire - regenerate a new one
2. Check Google Chat space permissions
3. Verify the bot/app is still added to the space

## Manual Testing

### Test the Notification Endpoint Directly

```bash
curl -X POST "https://your-app-url.vercel.app/api/leagues/your-league-slug/chat-integration/notify-challenge" \
  -H "Content-Type: application/json" \
  -d '{
    "challengerName": "Test Player 1",
    "challengedName": "Test Player 2", 
    "tournamentName": "Test Tournament",
    "leagueName": "Your League Name",
    "challengeId": "test-123",
    "appUrl": "https://your-app-url.vercel.app"
  }'
```

### Test Google Chat Webhook Directly

```bash
curl -X POST "https://chat.googleapis.com/v1/spaces/YOUR_SPACE/messages?key=YOUR_KEY&token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Test message from curl"
  }'
```

## Database Verification

Check if challenge notifications are enabled in your database:

```sql
SELECT 
  l.name as league_name,
  lci.enabled,
  lci.notify_challenge_requests,
  lci.webhook_url
FROM leagues l
LEFT JOIN league_chat_integrations lci ON l.id = lci.league_id
WHERE l.slug = 'your-league-slug';
```

## Recent Improvements Made

1. **Enhanced Error Logging**: The challenge creation endpoint now logs detailed information about notification attempts
2. **Better Error Handling**: Notifications won't fail silently anymore
3. **Environment-aware URLs**: Proper handling of production vs development URLs
4. **Debug Script**: Comprehensive diagnostic tool to identify issues quickly

## Next Steps

1. Run the debug script with your actual league slug
2. Check the output for any red ❌ indicators
3. Follow the specific solutions for any issues found
4. Test creating a new challenge and check server logs
5. If all else fails, regenerate your Google Chat webhook URL

## Need More Help?

If you're still having issues after following this guide:
1. Share the output from the debug script
2. Check your server logs for any error messages
3. Verify your Google Chat space settings and permissions
