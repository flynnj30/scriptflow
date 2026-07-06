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

// Initialize Firestore
const db = firebase.firestore();

// Apply settings with proper configuration
try {
    db.settings({
        cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
        merge: true
    });
} catch (error) {
    console.warn('Firestore settings already applied:', error);
}

// Enable offline persistence with proper error handling
try {
    db.enablePersistence({ synchronizeTabs: true })
        .catch(err => {
            if (err.code !== 'failed-precondition' && err.code !== 'unavailable') {
                console.warn('Firebase persistence error:', err);
            }
        });
} catch (err) {
    console.warn('Firebase persistence setup:', err);
}

// Initialize Auth
const auth = firebase.auth();

// Enable persistence for auth
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch(err => {
        console.warn('Auth persistence error:', err);
    });

// Make available globally
window.db = db;
window.auth = auth;
window.firebase = firebase;

console.log('✅ Firebase initialized successfully');