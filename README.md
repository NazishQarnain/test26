# 🌐 MujConnects – A Community Platform for MUJ Students

MujConnects is a **college-exclusive community web application** built for students of **Manipal University Jaipur (MUJ)** to connect, chat, and collaborate within their respective batches.

This is a **frontend-only demo** created as a **PBL (Project-Based Learning)** project using **HTML, Tailwind CSS, and JavaScript**, hosted on **GitHub Pages**.

---



---

## 📖 Overview

MujConnects allows students to:
- Register and log in using their **college email ID** (`@muj.manipal.edu`)
- Join their **batch-specific chat room**
- Interact with peers, discuss topics, and share information
- Manage their **profile** (name, email, batch)
- Enjoy a **modern, responsive, dark/light mode UI**

---

## 💡 Features

✅ **User Authentication (frontend simulation)**  
✅ **Batch-wise Chat Room UI**  
✅ **Profile Management**  
✅ **Responsive Design (Mobile + Desktop)**  
✅ **Light/Dark Mode Toggle**  
✅ **LocalStorage Data Persistence**  
✅ **Smooth Hash-based Routing**

---

## 🧱 Folder Structure

## 🎨 Styling (Tailwind CSS — production build)

This app used to load Tailwind via the Play CDN (`cdn.tailwindcss.com`), which
prints a "should not be used in production" warning in the console and ships
an unminified, runtime-generated stylesheet. It's now a real Tailwind CLI
build instead:

- `nova.css` — the source file: Tailwind's `@tailwind` directives plus all
  of this app's hand-written "Nova" theme (glass cards, gradient buttons,
  avatar rings, etc).
- `tailwind.config.js` — content globs (`index.html`, `*.js`) so Tailwind scans
  every JS file for the classes used in its template-literal HTML, plus the
  custom font/color tokens.
- `style.css` — the **compiled, minified output**. This is the file
  `index.html` actually links to; it's already built and committed, so the
  site works as-is with no build step required to just view it.

**You only need to rebuild `style.css` if you add new Tailwind classes**
(e.g. a new component with `bg-emerald-500` that isn't used anywhere else
yet) or edit `nova.css`:

```bash
npm install        # one-time, installs the Tailwind CLI (devDependency only)
npm run build:css  # rebuilds style.css from nova.css
```

While actively developing, `npm run watch:css` rebuilds automatically on save.

`node_modules/` is git-ignored — it's only needed locally to run the build,
never shipped to GitHub Pages.


mujconnects/
│
├── index.html
├── css/
│ └── style.css
├── js/
│ ├── main.js
│ ├── auth.js
│ ├── home.js
│ ├── chat.js
│ └── utils.js
├── images/

---

## 🔥 Firebase Backend Setup

MujConnects now includes **Firebase Authentication** and **Firebase Realtime Database** for real-time chat functionality.

### Prerequisites
1. A Google account
2. Basic knowledge of Firebase console

### Setup Instructions

#### Step 1: Create a Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click on "Add project" or "Create a project"
3. Enter project name (e.g., "MujConnects")
4. Follow the setup wizard

#### Step 2: Enable Authentication
1. In Firebase Console, click on "Authentication" from the left sidebar
2. Click on "Get Started"
3. Go to "Sign-in method" tab
4. Enable **Email/Password** authentication

#### Step 3: Create Realtime Database
1. In Firebase Console, click on "Realtime Database" from the left sidebar
2. Click on "Create Database"
3. Choose a location (preferably closest to your users)
4. Start in **Test mode** (for development)
   - ⚠️ **Test mode rules expire after 30 days** — after that, Firebase automatically
     switches to denying *all* reads and writes. This is the #1 cause of "it works
     today but stops saving anything a few weeks later" bugs (e.g. batch selection
     silently failing to save, so it keeps asking again after every logout). See
     **Security Rules** below — deploy the real rules well before the 30 days are up,
     don't rely on test mode.

#### Step 4: Get Your Firebase Config
1. Go to Project Settings (gear icon → Project settings)
2. Scroll down to "Your apps" section
3. Click on the Web icon (</>) to add a web app
4. Register your app with a nickname
5. Copy the Firebase configuration object

#### Step 5: Update Your Project
1. Open `js/firebase-config.js` in your project
2. Replace the placeholder values with your actual Firebase config:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

3. Save the file

### Security Rules (Production)

⚠️ **Deploy these before test mode expires, and redeploy any time `FIREBASE_RULES.json`
changes** (e.g. after pulling an update to this app that adds a new feature/data path —
recent additions include `blocks`, `hates`, `hateCounts`, `dms`, `stories`, `rollIndex`).
The rules living in this repo are **not** automatically applied to your live project —
you have to paste them in yourself:

1. Open [Firebase Console](https://console.firebase.google.com/) → your project
2. **Realtime Database** → **Rules** tab
3. Delete everything there and paste in the entire contents of `FIREBASE_RULES.json`
   from this repo (don't retype it — copy the file exactly, it's kept up to date with
   every feature the app uses)
4. Click **Publish**

**How to tell if this is your problem:** open the browser console (F12) while using
the app. Any Firebase write that gets rejected by the rules logs a
`PERMISSION_DENIED` error there — if you see that, the rules in the console don't
match (or don't exist / expired), and you need to redo the steps above.

### Features with Firebase

✅ **Real-time Authentication** - Secure user login and registration  
✅ **Real-time Chat** - Messages sync instantly across all users  
✅ **Batch-wise Rooms** - Students chat within their batch groups  
✅ **User Profiles** - Display names and email stored securely  
✅ **Message Persistence** - Chat history preserved in Firebase

---
│ └── logo.png
└── README.md
