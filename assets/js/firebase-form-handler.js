/**
 * Optimized Firebase form handler for tryout registrations
 */

// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  serverTimestamp,
  writeBatch,
  doc 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

class FormHandler {
  constructor(formId, successId, errorId) {
    // Store element IDs
    this.formId = formId;
    this.successId = successId;
    this.errorId = errorId;
    
    // Get DOM elements
    this.form = document.getElementById(formId);
    this.successElement = document.getElementById(successId);
    this.errorElement = document.getElementById(errorId);
    
    // Set up state
    this.isSubmitting = false;
    this.lastSubmitTime = 0;
    this.minSubmitInterval = 2000; // 2 seconds between submissions (rate limiting)
    
    // Initialize Firebase
    this.initFirebase();
    
    // Bind event handlers
    if (this.form) {
      this.form.addEventListener('submit', this.handleSubmit.bind(this));
    }
  }
  
  // Initialize Firebase
  initFirebase() {
    const firebaseConfig = {
      apiKey: "AIzaSyDmsZlmti2s_-tnmfzu2dl3JXHc-O_MFIo",
      authDomain: "tvvc-website.firebaseapp.com",
      projectId: "tvvc-website",
      storageBucket: "tvvc-website.firebasestorage.app",
      messagingSenderId: "235626883938",
      appId: "1:235626883938:web:109885d0682b9080bd1a3b"
    };
    
    this.app = initializeApp(firebaseConfig);
    this.db = getFirestore(this.app);
  }
  
  // Show loading state
  showLoading() {
    // Create or show loading indicator
    if (!this.loadingElement) {
      this.loadingElement = document.createElement('div');
      this.loadingElement.className = 'form-loading';
      this.loadingElement.innerHTML = `
        <div class="loading-spinner"></div>
        <p>Submitting your registration...</p>
      `;
      this.loadingElement.style.display = 'flex';
      this.loadingElement.style.flexDirection = 'column';
      this.loadingElement.style.alignItems = 'center';
      this.loadingElement.style.justifyContent = 'center';
      this.loadingElement.style.padding = '20px';
      this.loadingElement.style.position = 'absolute';
      this.loadingElement.style.top = '0';
      this.loadingElement.style.left = '0';
      this.loadingElement.style.width = '100%';
      this.loadingElement.style.height = '100%';
      this.loadingElement.style.backgroundColor = 'rgba(18, 18, 18, 0.9)';
      this.loadingElement.style.zIndex = '10';
      this.loadingElement.style.borderRadius = 'var(--radius-lg)';
      
      // Add spinner styles
      const style = document.createElement('style');
      style.textContent = `
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(255, 255, 255, 0.1);
          border-radius: 50%;
          border-top-color: var(--color-teal);
          animation: spin 1s linear infinite;
          margin-bottom: 15px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
      
      // Add to form
      this.form.style.position = 'relative';
      this.form.appendChild(this.loadingElement);
    } else {
      this.loadingElement.style.display = 'flex';
    }
    
    // Disable form inputs
    const inputs = this.form.querySelectorAll('input, select, textarea, button');
    inputs.forEach(input => {
      input.disabled = true;
    });
  }
  
  // Hide loading state
  hideLoading() {
    if (this.loadingElement) {
      this.loadingElement.style.display = 'none';
    }
    
    // Re-enable form inputs
    const inputs = this.form.querySelectorAll('input, select, textarea, button');
    inputs.forEach(input => {
      input.disabled = false;
    });
  }
  
  // Get form data as structured object
  getFormData() {
    return {
      playerInfo: {
        firstName: document.getElementById('player-first-name').value,
        lastName: document.getElementById('player-last-name').value,
        birthDate: document.getElementById('birth-date').value,
        grade: document.getElementById('grade').value,
        ageGroup: document.getElementById('age-group').value,
        school: document.getElementById('school').value
      },
      volleyballExperience: {
        primaryPosition: document.getElementById('position').value,
        secondaryPosition: document.getElementById('secondary-position').value || 'none',
        experienceLevel: document.getElementById('experience').value,
        previousClub: document.getElementById('previous-club').value || 'None'
      },
      guardianInfo: {
        name: document.getElementById('parent-name').value,
        relationship: document.getElementById('relationship').value,
        email: document.getElementById('parent-email').value,
        phone: document.getElementById('parent-phone').value,
        address: document.getElementById('address').value,
        city: document.getElementById('city').value,
        zip: document.getElementById('zip').value
      },
      tryoutSession: document.getElementById('tryout-date').value,
      termsAgreed: document.querySelector('input[name="termsAgreed"]').checked,
      emailConsent: document.querySelector('input[name="emailConsent"]').checked,
      registrationDate: serverTimestamp(),
      status: 'pending',
      source: 'website',
      metadata: {
        userAgent: navigator.userAgent,
        referrer: document.referrer || 'direct',
        submissionTime: new Date().toISOString()
      }
    };
  }
  
  // Handle form submission
  async handleSubmit(e) {
    e.preventDefault();
    
    // Check if already submitting or rate limiting
    const now = Date.now();
    if (this.isSubmitting || (now - this.lastSubmitTime < this.minSubmitInterval)) {
      return;
    }
    
    // Update state
    this.isSubmitting = true;
    this.lastSubmitTime = now;
    
    // Show loading state
    this.showLoading();
    
    try {
      // Get form data
      const formData = this.getFormData();
      
      // Save to Firestore with retry logic
      let attempts = 0;
      const maxAttempts = 3;
      let success = false;
      
      while (attempts < maxAttempts && !success) {
        try {
          const docRef = await addDoc(collection(this.db, 'tryoutRegistrations'), formData);
          console.log('Registration saved with ID: ', docRef.id);
          success = true;
        } catch (error) {
          attempts++;
          if (attempts >= maxAttempts) {
            throw error;
          }
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }
      
      // Show success message
      this.form.style.display = 'none';
      this.successElement.style.display = 'block';
      
      // Scroll to success message
      this.successElement.scrollIntoView({ behavior: 'smooth' });
      
      // Analytics event (if you want to track conversions)
      if (typeof gtag !== 'undefined') {
        gtag('event', 'form_submission', {
          'event_category': 'tryout',
          'event_label': formData.playerInfo.ageGroup
        });
      }
    } catch (error) {
      console.error('Error adding registration: ', error);
      
      // Show error message
      this.errorElement.style.display = 'block';
      
      // Add error details for debugging (hidden in production)
      const errorDetails = document.createElement('small');
      errorDetails.style.display = 'none'; // Hidden in production
      errorDetails.textContent = `Error: ${error.message}`;
      this.errorElement.appendChild(errorDetails);
      
      // Scroll to error message
      this.errorElement.scrollIntoView({ behavior: 'smooth' });
    } finally {
      // Reset state
      this.hideLoading();
      this.isSubmitting = false;
    }
  }
  
  // Reset the form
  resetForm() {
    this.form.reset();
    this.successElement.style.display = 'none';
    this.errorElement.style.display = 'none';
    this.form.style.display = 'block';
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const formHandler = new FormHandler(
    'tryout-registration-form',
    'form-success',
    'form-error'
  );
  
  // Register another player button
  const registerAnotherBtn = document.getElementById('register-another');
  if (registerAnotherBtn) {
    registerAnotherBtn.addEventListener('click', () => {
      formHandler.resetForm();
    });
  }
  
  // Try again button
  const tryAgainBtn = document.getElementById('try-again');
  if (tryAgainBtn) {
    tryAgainBtn.addEventListener('click', () => {
      document.getElementById('form-error').style.display = 'none';
    });
  }
});