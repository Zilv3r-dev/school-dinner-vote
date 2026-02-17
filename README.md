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
ADMIN_PASSWORD="choose-a-password" python3 server.py
```

Then open:

[http://127.0.0.1:8000](http://127.0.0.1:8000)
[http://127.0.0.1:8000/admin.html](http://127.0.0.1:8000/admin.html)

## Files
- `server.py`: API + static server + SQLite setup + admin settings endpoints
- `index.html`: UI and styles
- `app.js`: frontend logic and API calls
- `admin.html`: admin settings page
- `admin.js`: admin page logic
- `school_meals.db`: SQLite database (created automatically on first run)

## Notes
- The app creates a local device ID in browser storage and uses that to enforce the one-vote and daily-suggestion limits.
- Clearing browser storage or using another browser/device creates a new device ID.
- Admin settings are protected by the `ADMIN_PASSWORD` environment variable.

## Make it public (easy path: Render)
1. Put this project on GitHub (new repository).
2. Go to [https://render.com](https://render.com) and sign in.
3. Click `New +` -> `Web Service`.
4. Connect your GitHub repo and select this project.
5. Use these settings:
   - Runtime: `Python 3`
   - Build Command: `echo "No build step needed"`
   - Start Command: `HOST=0.0.0.0 python3 server.py`
6. In Render service settings, add Environment Variable:
   - Key: `ADMIN_PASSWORD`
   - Value: your admin password
7. Click `Create Web Service`.
8. Wait for deploy, then open the generated public URL.
9. Open `/admin.html` on your site URL to update meal options and nutrition without redeploying.
10. In admin page, set each option's `Meat Label` individually (for example one meal can be `Chicken`, another can be `Steak`).

Once deployed, anyone can open the same URL on any device.
