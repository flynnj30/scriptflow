// ============================================================
// FIREBASE CONFIGURATION
// ============================================================

// Replace with your Firebase config from the console
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyD_Ry0pM7EKSDJeTegt0rY5muiw-xCgrhw",
    authDomain: "scriptflow-pro-2cf4c.firebaseapp.com",
    projectId: "scriptflow-pro-2cf4c",
    storageBucket: "scriptflow-pro-2cf4c.firebasestorage.app",
    messagingSenderId: "250157640936",
    appId: "1:250157640936:web:cd6218470c302b305aed5d"
  };

// Initialize Firebase
firebase.initializeApp(FIREBASE_CONFIG);

// Initialize Firestore with new cache settings (fixes the warning)
const db = firebase.firestore();

// Use the new cache setting instead of deprecated enablePersistence
const settings = {
  cache: {
    sizeBytes: 104857600 // 100 MB cache
  }
};
db.settings(settings);

// Enable offline persistence with the new method
try {
  db.enablePersistence({ synchronizeTabs: true })
    .catch(err => {
      console.warn('Firebase persistence warning:', err);
    });
} catch (err) {
  console.warn('Firebase persistence error:', err);
}

// Initialize Auth
const auth = firebase.auth();

// Make available globally
window.db = db;
window.auth = auth;
window.firebase = firebase;

console.log('✅ Firebase initialized successfully');