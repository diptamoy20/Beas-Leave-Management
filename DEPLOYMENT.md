# Deployment Guide

## Option 1: Render (Recommended - Easiest Full-Stack Deployment)

### Steps:
1. Create account at https://render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Render will auto-detect the `render.yaml` file
5. Click "Apply" and your app will deploy automatically!

**Features:**
- Free tier available
- Automatic HTTPS
- Database included
- Both frontend and backend hosted
- Auto-deploys on git push

**URL:** Your app will be at `https://your-app-name.onrender.com`

---

## Option 2: Railway (Good Alternative)

### Steps:
1. Go to https://railway.app
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway auto-detects Node.js and deploys

**Features:**
- $5 free credit monthly
- Easy database setup
- Fast deployment

---

## Option 3: Vercel (Frontend) + Render (Backend)

### Frontend on Vercel:
1. Go to https://vercel.com
2. Import your GitHub repository
3. Set root directory to `client`
4. Deploy

### Backend on Render:
1. Create new Web Service on Render
2. Set build command: `npm install`
3. Set start command: `node server/index.js`
4. Add environment variables

---

## Option 4: Netlify (Frontend) + Railway (Backend)

### Frontend on Netlify:
1. Go to https://netlify.com
2. Drag and drop the `client/build` folder
3. Or connect GitHub repo

### Backend on Railway:
Same as Option 2

---

## Environment Variables to Set:

For any platform, set these environment variables:

```
PORT=5000
JWT_SECRET=your_random_secret_key_here
NODE_ENV=production
```

---

## Before Deploying:

1. **Build the frontend:**
```bash
cd client
npm run build
```

2. **Test production build locally:**
```bash
npm start
```

3. **Push to GitHub:**
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/your-repo.git
git push -u origin main
```

---

## Free Tier Limitations:

- **Render:** Apps sleep after 15 min of inactivity (takes 30s to wake up)
- **Railway:** $5 credit/month (usually enough for small apps)
- **Vercel:** Unlimited for frontend, serverless functions have limits
- **Netlify:** 100GB bandwidth/month

---

## Recommended: Render

Render is the easiest because:
- One-click deployment with `render.yaml`
- Handles both frontend and backend
- Free SSL certificate
- SQLite database works out of the box
- No credit card required for free tier

Just push your code to GitHub and connect to Render!
