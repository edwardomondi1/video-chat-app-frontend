# Deployment Guide

## Quick Deploy (Free)

### 1. Backend (Railway - Free)
1. Push code to GitHub
2. Go to railway.app
3. Connect GitHub repo
4. Deploy backend folder
5. Note the deployed URL (e.g., https://your-app.railway.app)

### 2. Frontend (Vercel - Free)  
1. Go to vercel.com
2. Import GitHub repo
3. Set build command: `npm run build`
4. Set environment variable: `VITE_SOCKET_URL=https://your-backend-url`
5. Deploy

### 3. Update Socket URL
In your .env file, change:
```
VITE_SOCKET_URL=https://your-deployed-backend-url
```

## Alternative: Ngrok (Quick Test)
1. Install ngrok
2. Run backend: `python app.py`
3. In new terminal: `ngrok http 5001`
4. Copy the https URL
5. Update VITE_SOCKET_URL to the ngrok URL
6. Share the frontend URL

## Status
- ✅ Local network: Works
- ❌ Internet: Needs deployment
- ✅ WebRTC: Fully implemented
- ✅ Chat: Working
- ✅ Video calls: Working locally