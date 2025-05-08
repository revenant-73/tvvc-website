/**
 * Enhanced form validation for tryout registration
 */

function validateTryoutForm() {
  // Get form elements
  const form = document.getElementById('tryout-registration-form');
  if (!form) return false;
  
  // Basic validation patterns
  const patterns = {
    email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    phone: /^(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/,
    zip: /^\d{5}(-\d{4})?$/
  };
  
  // Custom validation messages
  const messages = {
    required: 'This field is required',
    email: 'Please enter a valid email address',
    phone: 'Please enter a valid phone number',
    zip: 'Please enter a valid ZIP code',
    date: 'Please select a valid date',
    checkbox: 'You must agree to the terms'
  };
  
  // Create validation error element
  function createErrorElement(message) {
    const error = document.createElement('div');
    error.className = 'validation-error';
    error.textContent = message;
    error.style.color = '#ff4d4d';
    error.style.fontSize = '0.8rem';
    error.style.marginTop = '5px';
    return error;
  }
  
  // Clear previous validation errors
  function clearValidationErrors() {
    const errors = form.querySelectorAll('.validation-error');
    errors.forEach(error => error.remove());
  }
  
  // Validate a specific field
  function validateField(field) {
    // Skip fields that aren't required and are empty
    if (!field.required && field.value === '') return true;
    
    let isValid = true;
    let message = '';
    
    // Check for empty required fields
    if (field.required && field.value === '') {
      isValid = false;
      message = messages.required;
    } 
    // Email validation
    else if (field.type === 'email' && !patterns.email.test(field.value)) {
      isValid = false;
      message = messages.email;
    }
    // Phone validation
    else if (field.id === 'parent-phone' && !patterns.phone.test(field.value)) {
      isValid = false;
      message = messages.phone;
    }
    // ZIP validation
    else if (field.id === 'zip' && !patterns.zip.test(field.value)) {
      isValid = false;
      message = messages.zip;
    }
    // Date validation
    else if (field.type === 'date' && field.value === '') {
      isValid = false;
      message = messages.date;
    }
    // Checkbox validation
    else if (field.type === 'checkbox' && field.required && !field.checked) {
      isValid = false;
      message = messages.checkbox;
    }
    
    // Show error message if invalid
    if (!isValid) {
      const parent = field.parentElement;
      const existingError = parent.querySelector('.validation-error');
      
      if (!existingError) {
        const error = createErrorElement(message);
        parent.appendChild(error);
      }
    }
    
    return isValid;
  }
  
  // Add input event listeners for real-time validation
  const inputs = form.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    input.addEventListener('blur', function() {
      // Remove existing error for this field
      const existingError = this.parentElement.querySelector('.validation-error');
      if (existingError) existingError.remove();
      
      // Validate the field
      validateField(this);
    });
  });
  
  // Form submission validation
  form.addEventListener('submit', function(e) {
    // Clear all previous errors
    clearValidationErrors();
    
    // Validate all fields
    let formValid = true;
    inputs.forEach(input => {
      if (!validateField(input)) {
        formValid = false;
      }
    });
    
    // Prevent submission if invalid
    if (!formValid) {
      e.preventDefault();
      
      // Scroll to first error
      const firstError = form.querySelector('.validation-error');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    
    return formValid;
  });
  
  return true;
}

// Initialize validation when DOM is loaded
document.addEventListener('DOMContentLoaded', validateTryoutForm);

// Export for use in other scripts
if (typeof module !== 'undefined') {
  module.exports = { validateTryoutForm };
}