// Firebase Authentication Module
import { 
  getAuth, 
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";

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
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// DOM Elements
const authSection = document.getElementById('auth-section');
const authForm = document.getElementById('auth-form');
const authError = document.getElementById('auth-error');
const adminPanel = document.getElementById('admin-panel');
const logoutBtn = document.getElementById('logout-btn');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const loginText = document.getElementById('login-text');
const loginSpinner = document.getElementById('login-spinner');
const forgotPasswordLink = document.getElementById('forgot-password');

// Check authentication state
onAuthStateChanged(auth, (user) => {
  if (user) {
    // User is signed in
    showAdminPanel();
  } else {
    // User is signed out
    showAuthForm();
  }
});

// Show the authentication form
function showAuthForm() {
  authSection.style.display = 'block';
  adminPanel.style.display = 'none';
  logoutBtn.style.display = 'none';
}

// Show the admin panel
function showAdminPanel() {
  authSection.style.display = 'none';
  adminPanel.style.display = 'block';
  logoutBtn.style.display = 'inline-block';
  
  // Load registrations data
  if (typeof window.loadRegistrations === 'function') {
    window.loadRegistrations();
  }
}

// Set loading state for login button
function setLoginLoading(isLoading) {
  if (isLoading) {
    loginBtn.disabled = true;
    loginText.style.display = 'none';
    loginSpinner.style.display = 'inline-block';
  } else {
    loginBtn.disabled = false;
    loginText.style.display = 'inline';
    loginSpinner.style.display = 'none';
  }
}

// Logout functionality
logoutBtn.addEventListener('click', async function() {
  try {
    await signOut(auth);
    // UI will update via onAuthStateChanged
  } catch (error) {
    console.error("Error signing out:", error);
  }
});

// Handle authentication form submission
authForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  
  // Show loading state
  setLoginLoading(true);
  authError.style.display = 'none';
  
  try {
    // Sign in with Firebase Auth
    await signInWithEmailAndPassword(auth, email, password);
    // Success - UI will update via onAuthStateChanged
    
    // Clear form fields
    emailInput.value = '';
    passwordInput.value = '';
  } catch (error) {
    console.error("Login error:", error);
    setLoginLoading(false);
    
    let errorMessage = 'Invalid email or password. Please try again.';
    
    // Provide more specific error messages
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      errorMessage = 'Invalid email or password. Please try again.';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Too many failed login attempts. Please try again later or reset your password.';
    } else if (error.code === 'auth/network-request-failed') {
      errorMessage = 'Network error. Please check your internet connection and try again.';
    }
    
    authError.textContent = errorMessage;
    authError.style.display = 'block';
  }
});

// Forgot password handler
if (forgotPasswordLink) {
  forgotPasswordLink.addEventListener('click', async function(e) {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    
    if (!email) {
      authError.textContent = 'Please enter your email address first.';
      authError.style.display = 'block';
      emailInput.focus();
      return;
    }
    
    // Show loading state
    setLoginLoading(true);
    authError.style.display = 'none';
    
    try {
      // Send password reset email
      await sendPasswordResetEmail(auth, email);
      
      // Show success message
      authError.textContent = 'Password reset email sent! Check your inbox.';
      authError.style.color = 'var(--color-teal)';
      authError.style.display = 'block';
      setLoginLoading(false);
    } catch (error) {
      console.error("Password reset error:", error);
      setLoginLoading(false);
      
      let errorMessage = 'Failed to send reset email. Please try again.';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      }
      
      authError.style.color = 'var(--color-coral)';
      authError.textContent = errorMessage;
      authError.style.display = 'block';
    }
  });
}

export { auth };