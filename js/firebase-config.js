// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDmsZlmti2s_-tnmfzu2dl3JXHc-O_MFIo",
  authDomain: "tvvc-website.firebaseapp.com",
  projectId: "tvvc-website",
  storageBucket: "tvvc-website.firebasestorage.app",
  messagingSenderId: "235626883938",
  appId: "1:235626883938:web:109885d0682b9080bd1a3b"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();

// Collection references
const registrationsCollection = db.collection('tryout-registration-2025');

// Export for use in other files
window.db = db;
window.registrationsCollection = registrationsCollection;