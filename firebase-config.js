// =============================================================================
// Coffee & Cravings — Firebase Configuration (Option C: Google + Phone OTP)
// =============================================================================

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyBVvmJM6nkAF0uuwAVBxzN4z0XvU7QSAQA",
  authDomain: "coffeandcravings-dd3de.firebaseapp.com",
  projectId: "coffeandcravings-dd3de",
  storageBucket: "coffeandcravings-dd3de.firebasestorage.app",
  messagingSenderId: "62239372462",
  appId: "1:62239372462:web:e5833d7126c6b36230293f",
  measurementId: "G-K20NY48FMC"
};

window.isFirebaseConfigured = function() {
  return window.FIREBASE_CONFIG && 
         window.FIREBASE_CONFIG.apiKey && 
         !window.FIREBASE_CONFIG.apiKey.startsWith('YOUR_');
};
