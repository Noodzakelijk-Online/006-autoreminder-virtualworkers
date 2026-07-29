# Local Authentication Testing Guide

## What Changed

The application now uses **local username/password authentication** instead of Manus OAuth. This allows you to run the app locally without external dependencies.

## How to Test

### Step 1: Clear Browser Cookies

You need to clear any old session cookies from previous mock users:

**Option A: Clear All Cookies (Recommended)**
1. Open DevTools (F12)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Find **Cookies** → `http://localhost:3001`
4. Delete all cookies (especially `manus-session`)
5. Refresh the page (F5)

**Option B: Clear Specific Cookie**
1. Open DevTools (F12)
2. Go to **Application** → **Cookies** → `http://localhost:3001`
3. Find and delete the `manus-session` cookie
4. Refresh the page (F5)

**Option C: Use Incognito/Private Window**
- Open a new incognito/private browsing window
- Navigate to `http://localhost:3001`

### Step 2: Register a New Account

After clearing cookies, you should see a **login form** instead of the home page.

1. Click **"Register"** at the bottom of the form
2. Fill in:
   - **Display Name**: Your name (e.g., "John Doe")
   - **Username**: Any username (e.g., "admin")
   - **Password**: At least 6 characters
3. Click **"Create account"**
4. You should be logged in automatically

### Step 3: Test Login

1. Click the user avatar in the top-right corner
2. Click **"Sign out"**
3. You should see the login form again
4. Enter your username and password
5. Click **"Sign in"**
6. You should be logged back in

## Troubleshooting

### "Still seeing the home page without login form"

**Cause**: Old session cookies are still active

**Solution**:
1. Open DevTools (F12)
2. Go to **Console** tab
3. Run this command:
   ```javascript
   document.cookie.split(";").forEach(c => {
     document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
   });
   location.reload();
   ```
4. This will clear all cookies and reload the page

### "Getting 401 errors in console"

**Expected behavior**: These errors are normal when not logged in. The app tries to fetch data, gets rejected, and shows the login form.

### "Login form not appearing"

1. Make sure the dev server is running (`pnpm dev`)
2. Check the browser console for errors
3. Try hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
4. Try a different browser or incognito window

## What's Next

Once you can log in successfully:

1. **Add Groq API Key** (for AI features):
   - Get a free key at https://console.groq.com
   - Add to `.env`: `GROQ_API_KEY=your_key_here`
   - Restart the dev server

2. **Test Trello Integration**:
   - The Trello credentials in `.env` should already work
   - Try registering boards from the Founder Dashboard

3. **Test Worker Dashboard**:
   - Navigate to `/worker` to see the worker view
   - Assign tasks to test the workflow

## Technical Details

### Authentication Flow

1. **Registration**: Creates user with `loginMethod: 'local'` and hashed password
2. **Login**: Verifies password and creates session cookie
3. **Session**: Stored in `manus-session` cookie, valid for 1 year
4. **Logout**: Clears session cookie

### Mock Users Rejected

Old mock users (with `loginMethod: 'mock'`) are automatically rejected. They must re-register with the new local auth system.

### Database

User accounts are stored in the `users` table with:
- `openId`: Username (unique identifier)
- `name`: Display name
- `passwordHash`: Bcrypt-hashed password
- `loginMethod`: Set to `'local'`

