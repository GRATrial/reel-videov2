# MongoDB Tracking Not Working - Fix Guide

## Issue
Events are not being saved to MongoDB for reel-video.

## Root Causes to Check

### 1. **MONGODB_URI Environment Variable Missing**
The API requires `MONGODB_URI` to be set in Vercel.

**Fix:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add: `MONGODB_URI` = `mongodb+srv://estatedeliuser:estatedeli12345@cluster0.xwvmm93.mongodb.net/instagram_study?retryWrites=true&w=majority`
3. Redeploy the project

### 2. **API Endpoint Not Deployed**
Check if `/api/track` endpoint is accessible.

**Test:**
```bash
curl -X POST https://your-vercel-url.vercel.app/api/track \
  -H "Content-Type: application/json" \
  -d '{"event_name":"test","participant_id":"test123","study_type":"reel_video","properties":{"condition":"reel_video"}}'
```

### 3. **Console Errors**
Open browser console (F12) and check for:
- `MongoTracker: ❌ Event tracking failed` - API error
- `MongoTracker: ❌ Event tracking error` - Network error
- `MongoTracker: ✅ Event tracked successfully` - Working!

### 4. **CORS Issues**
The API should allow CORS. Check if requests are being blocked.

## Enhanced Logging Added

I've added better error logging that will show:
- The API URL being called
- The full event being sent
- Detailed error messages
- Response status codes

## Testing Steps

1. **Open the app in browser**
2. **Open Developer Console (F12)**
3. **Look for these logs:**
   - `MongoTracker: Base tracker loaded`
   - `MongoTracker: Initialized successfully`
   - `MongoTracker: Sending event to: /api/track`
   - `MongoTracker: ✅ Event tracked successfully` OR error messages

4. **Check Network Tab:**
   - Look for POST requests to `/api/track`
   - Check response status (should be 200)
   - Check response body for success/error

5. **Test API Directly:**
   ```bash
   # Replace with your actual Vercel URL
   curl -X POST https://reel-videov2.vercel.app/api/track \
     -H "Content-Type: application/json" \
     -d '{
       "event_name": "test_event",
       "participant_id": "test123",
       "study_type": "reel_video",
       "properties": {
         "condition": "reel_video",
         "test": true
       }
     }'
   ```

## Expected Behavior

When working correctly, you should see:
1. Console logs showing events being sent
2. Network requests to `/api/track` with 200 status
3. Events appearing in MongoDB `reel_video_events` collection

## Quick Fix Checklist

- [ ] MONGODB_URI set in Vercel environment variables
- [ ] Project redeployed after setting environment variable
- [ ] API endpoint accessible (test with curl)
- [ ] No CORS errors in browser console
- [ ] Events showing in console logs
- [ ] Network requests succeeding

## Verify in MongoDB

After fixing, run:
```bash
cd mongo-version
node query_reel_video_all.js
```

This will show all tracked events.

