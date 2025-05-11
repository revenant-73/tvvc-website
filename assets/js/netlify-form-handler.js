/**
 * Netlify form handler for tryout registrations
 * Simplified version that works with Netlify Forms
 */

class NetlifyFormHandler {
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
    this.loadingElement = null;
    
    // Bind event handlers
    if (this.form) {
      // Set up email copy for reply-to functionality
      const emailField = document.getElementById('parent-email');
      const emailCopy = document.getElementById('parent-email-copy');
      
      if (emailField && emailCopy) {
        emailField.addEventListener('input', () => {
          emailCopy.value = emailField.value;
        });
      }
      
      // Netlify handles the actual form submission
      // We just need to handle the UI states
      this.form.addEventListener('submit', this.handleSubmit.bind(this));
    }
    
    // Register another player button
    const registerAnotherBtn = document.getElementById('register-another');
    if (registerAnotherBtn) {
      registerAnotherBtn.addEventListener('click', () => {
        this.resetForm();
      });
    }
    
    // Try again button
    const tryAgainBtn = document.getElementById('try-again');
    if (tryAgainBtn) {
      tryAgainBtn.addEventListener('click', () => {
        document.getElementById(this.errorId).style.display = 'none';
        this.form.style.display = 'block';
      });
    }
  }
  
  // Show loading state
  showLoading() {
    if (!this.loadingElement) {
      // Create loading overlay
      this.loadingElement = document.createElement('div');
      this.loadingElement.className = 'form-loading-overlay';
      this.loadingElement.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 10;
        border-radius: 8px;
      `;
      
      // Create spinner
      const spinner = document.createElement('div');
      spinner.className = 'loading-spinner';
      this.loadingElement.appendChild(spinner);
      
      // Create message
      const message = document.createElement('p');
      message.textContent = 'Submitting registration...';
      message.style.color = 'white';
      message.style.marginTop = '15px';
      this.loadingElement.appendChild(message);
      
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
  }
  
  // Hide loading state
  hideLoading() {
    if (this.loadingElement) {
      this.loadingElement.style.display = 'none';
    }
  }
  
  // Handle form submission
  handleSubmit(e) {
    // Note: We don't prevent default here because we want Netlify to handle the form
    // e.preventDefault();
    
    // Show loading state
    this.showLoading();
    this.isSubmitting = true;
    
    // Netlify will handle the actual form submission
    // We just need to handle the UI feedback
    
    // The form will be submitted to Netlify and the page will be reloaded
    // If you want to handle success/error without page reload, you would need
    // to use Netlify's JavaScript API or fetch API to submit the form
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
  new NetlifyFormHandler(
    'tryout-registration-form',
    'form-success',
    'form-error'
  );
});