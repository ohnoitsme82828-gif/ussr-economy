# 🚀 USSR Economic System - Deployment Guide (Vercel + Supabase)

> **Complete step-by-step guide to deploy on Vercel free tier for your Discord server. Takes ~15 minutes.**

## 📋 Prerequisites

- A GitHub account (free)
- A Vercel account (free) - https://vercel.com
- A Supabase account (free) - https://supabase.com
- Node.js 18+ installed locally (for testing)
- 15 minutes of your time

---

## 🔧 Phase 1: Local Setup & Testing (5 minutes)

### Step 1: Install Dependencies

```bash
# Navigate to project directory
cd SOV_BANK

# Install all dependencies
npm install
# or if you use yarn
yarn install
```

### Step 2: Verify Build Works

```bash
# Create a test build locally
npm run build

# If build completes without errors, you're good to go!
# You should see "✓ Compiled successfully" message
```

**Troubleshooting:**
- If you get "MongoDB is not installed" error: Already fixed! MongoDB is removed from package.json
- If you get JWT_SECRET error: That's expected for now, we'll set it in Supabase section

---

## 🗄️ Phase 2: Database Setup (Supabase) - Free Tier (5 minutes)

### Step 1: Create Supabase Project

1. Go to https://supabase.com and sign up (free)
2. Click **"New Project"** 
3. Fill in:
   - **Project Name**: `ussr-economy`
   - **Database Password**: Generate a secure password (save it!)
   - **Region**: Choose closest to your location
4. Click **"Create new project"** (takes 2-3 minutes)
5. Wait for the project to initialize

### Step 2: Get Database Connection String

1. Once initialized, go to **Settings → Database → Connection Strings**
2. Click on the **"Pooler"** tab (important! Use Pooler, not Direct)
3. Copy the connection string (looks like: `postgresql://postgres.xxxxx:password@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`)
4. **Replace `[YOUR-PASSWORD]` with your database password** from Step 1

Your final connection string should look like:
```
postgresql://postgres.xxxxxxxxxxxx:YOUR_PASSWORD@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
```

✅ **Save this connection string - you'll need it in Vercel**

---

## 🚀 Phase 3: Deploy to Vercel (3 minutes)

### Step 1: Push Code to GitHub

1. Go to https://github.com and create a **new repository** named `ussr-economy`
2. In your terminal:

```bash
# Initialize git and push your code
git init
git add .
git commit -m "Initial commit: USSR Economic System"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ussr-economy.git
git push -u origin main
```

### Step 2: Create Vercel Project

1. Go to https://vercel.com and sign in
2. Click **"Add New" → "Project"**
3. Click **"Import Git Repository"**
4. Find and select your `ussr-economy` repository
5. Click **"Import"**

### Step 3: Configure Environment Variables

Before clicking Deploy, scroll down to **"Environment Variables"** section:

Add these variables:

| Variable | Value | Example |
|----------|-------|---------|
| `DATABASE_URL` | Your Supabase connection string | `postgresql://postgres.xxxxx:password@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres` |
| `JWT_SECRET` | Generate strong random string | `a7f3k9x2m1p8q4r6v9w2j5h8g0b1n3z5x7c9m0k2` |
| `INITIAL_ADMIN_USERNAME` | Admin login username | `admin` |
| `INITIAL_ADMIN_PASSWORD` | Admin login password (strong!) | `MySecurePass2025!Admin` |
| `NODE_ENV` | Set to production | `production` |

**🔐 Generate JWT_SECRET:**

On Windows (PowerShell):
```powershell
-join ((1..40) | % { [char][byte]::MinValue..(127) | Get-Random } | ? { $_ -match '[a-zA-Z0-9]' } | Select-Object -First 40)
```

Or use online generator: https://generate-random.org/ (copy 40+ random alphanumeric characters)

### Step 4: Deploy

1. Click **"Deploy"** button
2. Wait 3-5 minutes for deployment to complete
3. Once done, you'll see **"Visit"** button with your URL (example: `ussr-economy.vercel.app`)

✅ **Your app is now live!** Save your Vercel URL

---

## ✅ Phase 4: Test Deployment (2 minutes)

1. Click the **"Visit"** link from Vercel dashboard
2. You should see the Soviet propaganda-themed login page
3. Login with:
   - **Username**: Value from `INITIAL_ADMIN_USERNAME` (default: `admin`)
   - **Password**: Value from `INITIAL_ADMIN_PASSWORD`
4. If login works → ✅ Deployment successful!

**If it doesn't work:**
- Check Vercel deployment logs: Go to Vercel dashboard → Project → Deployments → Click the failed deployment → "Logs"
- Common issues:
  - DATABASE_URL is wrong or password has special characters (URL encode them)
  - JWT_SECRET contains special characters (use only alphanumeric + hyphen/underscore)
  - Database password incorrect

---

## 📱 Phase 5: Share on Discord (1 minute)

Your app is now ready! Share it with your Discord server:

### Option 1: Direct Link (Recommended)
Share the Vercel URL directly:
```
https://your-project.vercel.app
```

Members visit the link → Full USSR economic simulator experience!

### Option 2: Discord Bot Integration (Optional)
Create a Discord command that opens your app:
```
/economy - Opens the USSR Economic System
```

Users in Discord can:
- Access via web link
- Login with their Discord username or custom account
- Participate in the economy with other server members

### Option 3: Embed as Embed
You can link to it from your server description, welcome message, or rules channel.

---

## 🔧 Post-Deployment: Important Next Steps

### 1. Change Admin Password (Security)

1. Login to your app with default admin credentials
2. Go to **Settings → Change Password**
3. Set a new strong password
4. Update `INITIAL_ADMIN_PASSWORD` in Vercel environment variables for future reference

### 2. Create Sample Users

The app auto-creates 5 sample users for testing:
- `ivan_petrov` - Password: `password123`
- `maria_ivanova` - Password: `password123`
- `dmitri_sokolov` - Password: `password123`
- `natasha_volkova` - Password: `password123`
- `sergei_popov` - Password: `password123`

Users can:
1. Login with these accounts
2. View leaderboard
3. Transfer Rubles
4. Access marketplace
5. See their transaction history

### 3. Distribute Initial Credits (Optional)

As admin:
1. Go to **Admin Panel → User Management**
2. Inject Rubles or Token Rubles to specific users
3. Set conversion rates, tax rates, transfer limits

### 4. Start Weekly Economy Events

The app includes:
- **Weekly Salary**: Auto-distributes Monday 00:00 UTC
- **Leaderboard Reset**: Monday 00:01 UTC
- **Top Citizen Reward**: 5,000 Rubles to #1 ranked user

You can manually trigger these in admin panel anytime.

---

## 📊 Monitoring & Maintenance

### Check Deployment Status

1. Go to https://vercel.com
2. Click your project
3. View **Deployments** tab (shows all deploys + status)
4. View **Functions** tab (shows API route performance)

### View Application Logs

```bash
# In Vercel dashboard:
1. Click "Deployments" tab
2. Select most recent deployment
3. Click "View Function Logs"
```

### Database Backups

Supabase free tier automatically backs up your data. To manually backup:

1. Go to Supabase dashboard
2. Click your project
3. Go to **Settings → Backups**
4. Your data is safe - Supabase maintains automatic backups

---

## ⚡ Performance Tips

### For 50-500 Users (Free Tier Limits)

| Metric | Supabase Free | Vercel Free | Your Load |
|--------|--------------|-----------|-----------|
| Storage | 500 MB | N/A | ~5-10 MB (50-500 users) ✅ |
| DB Connections | 100 concurrent | N/A | 10-20 (typical) ✅ |
| API Calls | Unlimited | 1M/month | ~100-500/day ✅ |
| Bandwidth | Unlimited | 100 GB/month | ~1-5 GB/month ✅ |

**Status: ✅ All free tiers support your use case!**

---

## 🐛 Troubleshooting

### "Cannot connect to database"
- **Fix**: Check DATABASE_URL in Vercel environment variables
- Verify Supabase connection string uses Pooler (not Direct)
- Check password contains no special characters (or URL-encode them)

### "JWT_SECRET is not set"
- **Fix**: Add JWT_SECRET to Vercel environment variables
- Generate strong random string (40+ alphanumeric chars)
- Redeploy after adding

### "Admin user not created"
- **Fix**: Check INITIAL_ADMIN_PASSWORD is set
- Try logging in with credentials you set
- Check Vercel Function Logs for initialization errors

### "Cron jobs not running"
- **Note**: Vercel's free tier cron jobs have no guarantee
- **Workaround**: Add manual "Run Now" buttons in admin panel (already included)
- For production: Use external cron service (AWS EventBridge free tier, or EasyCron)

### "Page shows 404 or blank"
- **Fix 1**: Wait 2-3 minutes after deployment completes
- **Fix 2**: Check Vercel deployment logs for build errors
- **Fix 3**: Clear browser cache (Ctrl+Shift+Delete)
- **Fix 4**: Test in incognito/private window

---

## 🔐 Security Checklist

- ✅ JWT_SECRET is strong (40+ random characters)
- ✅ Admin password is strong (avoid common passwords)
- ✅ DATABASE_URL is only in Vercel secrets (not in code)
- ✅ `.env` file is in `.gitignore` (not pushed to GitHub)
- ✅ CORS is set to `*` for Discord sharing (or restrict to your domain)
- ✅ SSL enabled by default on Vercel

---

## 📞 Support & FAQ

**Q: Can I use this for 1000+ users?**
A: Supabase free tier has 100 concurrent connection limit. For 1000+ users, upgrade to paid tier or use a different provider.

**Q: Do I need a credit card?**
A: No! Both Vercel and Supabase free tiers don't require a credit card.

**Q: Can I modify the economy rules?**
A: Yes! Go to Admin Panel → System Configuration to change:
- Tax rates
- Transfer limits
- Conversion rates
- Cooldown periods
- Salary amounts (edit roles)

**Q: How do I add custom marketplace items?**
A: Admin Panel → Marketplace → Create Item. Add name, price, description, stock, and effects.

**Q: Can users trade with each other?**
A: Yes! The P2P transfer system allows users to transfer Rubles to each other with optional tax.

**Q: How do I backup user data?**
A: Supabase auto-backs up daily. To export: Go to Supabase Dashboard → SQL Editor → Run custom query to export as CSV/JSON.

---

## 🎉 You're Done!

Your USSR Economic System is now live on Vercel!

**Next Steps:**
1. Share the URL with your Discord server
2. Invite members to create accounts
3. Start the economic simulation!
4. Monitor user engagement via leaderboard & admin panel

**Have fun! 🚀**

---

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [PostgreSQL Free Resources](https://www.postgresql.org/docs/)

---

**Last Updated:** May 2026  
**Status:** ✅ Production Ready  
**Version:** 1.0
