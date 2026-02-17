# School Dinner Choice Hub

## What this includes
- Backend API in Python with SQLite database
- Frontend with live poll split, nutrition comparison, and daily meal suggestions
- No sign-in required
- Enforced rules:
  - One vote per device/browser
  - One suggestion per device/browser per day

## Run locally
```bash
cd "/Users/williamlaramccannon/Documents/SUS Board Website"
python3 server.py
```

Then open:

[http://127.0.0.1:8000](http://127.0.0.1:8000)

## Files
- `server.py`: API + static server + SQLite setup
- `index.html`: UI and styles
- `app.js`: frontend logic and API calls
- `school_meals.db`: SQLite database (created automatically on first run)

## Notes
- The app creates a local device ID in browser storage and uses that to enforce the one-vote and daily-suggestion limits.
- Clearing browser storage or using another browser/device creates a new device ID.

## Make it public (easy path: Render)
1. Put this project on GitHub (new repository).
2. Go to [https://render.com](https://render.com) and sign in.
3. Click `New +` -> `Web Service`.
4. Connect your GitHub repo and select this project.
5. Use these settings:
   - Runtime: `Python 3`
   - Build Command: leave blank
   - Start Command: `python3 server.py`
6. Click `Create Web Service`.
7. Wait for deploy, then open the generated public URL.
8. Share that URL or make a QR code from it.

Once deployed, anyone can open the same URL on any device.
