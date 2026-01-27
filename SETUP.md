# Multiview.video Setup Guide

## ✅ Already Done
- Database schema run in Neon ✓
- Google OAuth credentials created ✓
- Site deployed on Netlify ✓

## 🔧 Environment Variables to Add in Netlify

Go to **Netlify Dashboard → Site settings → Environment variables** and add:

| Variable | Value |
|----------|-------|
| `GOOGLE_CLIENT_ID` | `556116943472-p3g5ds05kla20fu34245r7jcm3tubqu6.apps.googleusercontent.com` |

The `DATABASE_URL` or `NETLIFY_DATABASE_URL` should already be set by the Neon extension.

## 📁 File Structure

```
multiview-video/
├── netlify.toml              # Netlify config & redirects
├── package.json              # Dependencies
├── schema.sql                # Database schema (already run)
├── public/                   # Frontend files
│   ├── index.html           # Main HTML with Google Client ID
│   ├── app.js               # React app (uses API, not localStorage)
│   ├── api.js               # API client helper
│   └── styles.css           # Styles
└── netlify/functions/        # Backend API (serverless)
    ├── auth.js              # Login/register/Google OAuth
    ├── rooms.js             # Room CRUD & kick
    ├── playlists.js         # Playlist/video CRUD
    └── presence.js          # Online status tracking
```

## 🚀 Deploy Steps

1. **Add the environment variable** (`GOOGLE_CLIENT_ID`) in Netlify
2. **Push these files to your GitHub repo**
3. Netlify will auto-deploy

## 🔄 How Data Flows Now

```
[Browser] → API calls → [Netlify Functions] → [Neon PostgreSQL]
```

- **Auth**: Token stored in localStorage, validated on server
- **Rooms/Playlists**: All stored in database
- **Presence**: Heartbeats sent every 10 seconds to track who's online
- **Guest users**: Get a guest_id stored in localStorage

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Login with email/username |
| POST | /api/auth/google | Google OAuth login |
| GET | /api/auth/me | Get current user |
| POST | /api/auth/logout | Logout |
| GET | /api/rooms | List user's rooms |
| POST | /api/rooms | Create room |
| GET | /api/rooms/:id | Get room details |
| POST | /api/rooms/:id/join | Join room |
| POST | /api/rooms/:id/kick | Kick user (owner only) |
| GET | /api/playlists?roomId=x | List playlists |
| POST | /api/playlists | Create playlist |
| POST | /api/playlists/:id/videos | Add video |
| DELETE | /api/playlists/:id/videos/:vid | Remove video |
| POST | /api/presence/heartbeat | Update presence |
| GET | /api/presence/:roomId | Get room members |

## Troubleshooting

### "The given client ID is not found"
- Make sure `GOOGLE_CLIENT_ID` env variable is set in Netlify
- Verify `https://multiview.video` is in Google OAuth authorized origins

### Database errors
- Check Netlify function logs: **Netlify → Functions → [function name] → Logs**
- Verify Neon extension is connected and DATABASE_URL is set

### CORS issues
- All functions include CORS headers, should work
- Check browser console for specific errors
