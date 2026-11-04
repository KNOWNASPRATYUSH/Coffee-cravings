// =============================================================================
// Coffee & Cravings — Firebase Configuration (Option C: Google + Phone OTP)
// =============================================================================
// How to connect your Firebase Project:
// 1. Visit https://console.firebase.google.com and open/create your project.
// 2. Go to "Authentication" -> "Sign-in method":
//    - Enable "Google"
//    - Enable "Phone"
// 3. Go to Project Settings (gear icon) -> General -> Your apps -> Web app (</>)
// 4. Copy the firebaseConfig keys below:

window.FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "coffee-cravings-cafe.firebaseapp.com",
  projectId: "coffee-cravings-cafe",
  storageBucket: "coffee-cravings-cafe.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456789"
};

window.isFirebaseConfigured = function() {
  return window.FIREBASE_CONFIG && 
         window.FIREBASE_CONFIG.apiKey && 
         !window.FIREBASE_CONFIG.apiKey.startsWith('YOUR_');
};
