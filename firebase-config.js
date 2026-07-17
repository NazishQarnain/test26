// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCRYMfJvp4SYv7uYHDL4twNVkFZCYyl_hc",
  authDomain: "studio-3196397526-cc488.firebaseapp.com",
  databaseURL: "https://studio-3196397526-cc488-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "studio-3196397526-cc488",
  storageBucket: "studio-3196397526-cc488.firebasestorage.app",
  messagingSenderId: "665135764429",
  appId: "1:665135764429:web:3f6bb631a45c76421dcea84"
};

// BUG FIX: Initialize Firebase immediately (not inside a function)
// so auth/database are available when other scripts load
let app, auth, database;

function initializeFirebase() {
  try {
    if (firebase.apps.length === 0) {
      app = firebase.initializeApp(firebaseConfig);
    } else {
      app = firebase.app();
    }
    auth = firebase.auth();
    database = firebase.database();

    // BUG FIX: Set globals AFTER initialization, not before
    window.firebaseApp = app;
    window.firebaseAuth = auth;
    window.firebaseDatabase = database;

    console.log('Firebase initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase:', error);
  }
}

window.initializeFirebase = initializeFirebase;

// ── STORAGE CONFIG (fill these two in — see DRIVE_SETUP.md) ──────
// 1. IMGBB_API_KEY: free key from https://api.imgbb.com (login → Get API key)
// 2. DRIVE_UPLOAD_URL: your deployed Google Apps Script web-app URL
//    (step-by-step in DRIVE_SETUP.md — takes ~5 minutes, browser only)
window.IMGBB_API_KEY   = '768e1ce163b9328959c465eb8932866a';
window.DRIVE_UPLOAD_URL = 'https://script.google.com/macros/s/AKfycbxOpm6a8FM65AVpPunvcqvawkYA8VpHiFGTjMuXqLMaSCeOdqInhKdkTBnQCaaTYWu0/exec';
