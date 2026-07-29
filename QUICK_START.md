# 🚀 Quick Start - Fix Login Issue

## The Problem

The browser is showing the **Home page** instead of the **login form** because old session cookies from mock users are still active.

## The Solution (Choose One)

### ⭐ Option 1: Automatic Cookie Clearing (EASIEST)

1. **Open this URL in your browser:**
   ```
   http://localhost:3001/clear-cookies.html
   ```

2. **Click "Clear Cookies"** button

3. **Click "Go to Dashboard"** button

4. **You should now see the login form!**

---

### Option 2: Manual Cookie Clearing (DevTools)

1. **Open DevTools**: Press `F12`

2. **Go to Application tab** (Chrome) or **Storage tab** (Firefox)

3. **Find Cookies**:
   - Expand "Cookies" in the left sidebar
   - Click on `http://localhost:3001`

4. **Delete the `manus-session` cookie**:
   - Right-click on it
   - Select "Delete"

5. **Refresh the page**: Press `F5`

6. **You should now see the login form!**

---

### Option 3: Console Command (Quick)

1. **Open DevTools**: Press `F12`

2. **Go to Console tab**

3. **Paste this command** and press Enter:
   ```javascript
   document.cookie.split(";").forEach(c => {
     document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
   });
   location.reload();
   ```

4. **The page will reload and show the login form!**

---

### Option 4: Incognito Window (No Cookie Clearing Needed)

1. **Open a new incognito/private window**:
   - Chrome: `Ctrl+Shift+N`
   - Firefox: `Ctrl+Shift+P`
   - Edge: `Ctrl+Shift+N`

2. **Navigate to**: `http://localhost:3001`

3. **You should see the login form!**

---

## After Clearing Cookies

### Step 1: Register Your Account

1. You should see a **login form** with "VA Dashboard" title
2. Click **"Register"** at the bottom
3. Fill in:
   - **Display Name**: Your name (e.g., "Kamal Uddin")
   - **Username**: Any username (e.g., "admin" or "kamal")
   - **Password**: At least 6 characters
4. Click **"Create account"**
5. You'll be logged in automatically! 🎉

### Step 2: Test Login/Logout

1. Click your **avatar** in the top-right corner
2. Click **"Sign out"**
3. You should see the login form again
4. Enter your **username** and **password**
5. Click **"Sign in"**
6. You're back in! ✅

### Step 3: Add Groq API Key (Optional - for AI features)

1. Get a **free API key** at: https://console.groq.com
2. Open `.env` file in the project root
3. Replace this line:
   ```
   GROQ_API_KEY=your_groq_api_key_here
   ```
   With your actual key:
   ```
   GROQ_API_KEY=gsk_abc123...
   ```
4. **Restart the dev server**:
   - Stop: `Ctrl+C` in the terminal
   - Start: `pnpm dev`

---

## Troubleshooting

### "Still seeing Home page, not login form"

**Try this in order:**

1. **Hard refresh**: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. **Clear browser cache**: `Ctrl+Shift+Delete` → Clear cache
3. **Try incognito window** (Option 4 above)
4. **Try different browser** (Chrome, Firefox, Edge)

### "Getting errors in console"

**Expected errors when not logged in:**
- ❌ `401 Unauthorized` - Normal, means you need to log in
- ❌ `Failed to load resource` - Normal, API calls fail without auth

**These are GOOD signs** - they mean the auth system is working!

### "Login form appears but login fails"

**Check:**
1. Username and password are correct
2. Password is at least 6 characters
3. Dev server is running (`pnpm dev`)
4. Database is running (Docker Desktop → `va-mysql` container)

### "Dev server not running"

**Start it:**
```bash
cd va-dashboard
pnpm dev
```

**Should see:**
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:3001/
```

---

## What's Next?

Once logged in, you can test:

1. **Founder Dashboard** (`/founder`)
   - Register Trello boards
   - Assign tasks to workers
   - View analytics

2. **Worker Dashboard** (`/worker`)
   - See assigned tasks
   - Complete tasks
   - Track progress

3. **APTLSS Management** (`/aptlss`)
   - Generate checklists
   - Analyze tasks
   - View task details

4. **Settings** (`/settings`)
   - Configure integrations
   - Set up automation
   - Customize preferences

---

## Summary

**The fix is simple**: Clear browser cookies to remove old mock user sessions.

**Fastest method**: Open `http://localhost:3001/clear-cookies.html` and click the button.

**After that**: Register a new account and you're done! 🎉

**Total time**: 2-5 minutes

---

## Need Help?

If you're still stuck after trying all options:

1. Check `CURRENT_STATUS.md` for detailed status
2. Check `LOCAL_AUTH_TESTING.md` for more details
3. Look at browser console (F12) for specific errors
4. Check server logs in the terminal running `pnpm dev`

