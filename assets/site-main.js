// TVVC Website - Main JavaScript

// Image optimization helper
function optimizeImages() {
  // Check for IntersectionObserver support
  if ('IntersectionObserver' in window) {
    // Find all images with data-src attribute
    const lazyImages = document.querySelectorAll('img[data-src]');
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          
          // Optional: load high-res version after the low-res is loaded
          if (img.dataset.srcset) {
            img.srcset = img.dataset.srcset;
          }
          
          img.classList.add('loaded');
          imageObserver.unobserve(img);
        }
      });
    });
    
    lazyImages.forEach(img => {
      imageObserver.observe(img);
    });
  } else {
    // Fallback for browsers that don't support IntersectionObserver
    const lazyImages = document.querySelectorAll('img[data-src]');
    lazyImages.forEach(img => {
      img.src = img.dataset.src;
      if (img.dataset.srcset) {
        img.srcset = img.dataset.srcset;
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', function() {
  // Initialize image optimization
  optimizeImages();
  // Mobile menu toggle
  const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
  const mainNav = document.querySelector('.main-nav');
  const menuOverlay = document.querySelector('.menu-overlay');
  const menuIcon = document.querySelector('.menu-icon');
  const closeIcon = document.querySelector('.close-icon');
  const body = document.body;
  
  function openMobileMenu() {
    mainNav.classList.add('active');
    menuOverlay.classList.add('active');
    mobileMenuToggle.classList.add('active');
    mobileMenuToggle.setAttribute('aria-expanded', 'true');
    menuIcon.style.display = 'none';
    closeIcon.style.display = 'block';
    body.style.overflow = 'hidden'; // Prevent scrolling when menu is open
  }
  
  function closeMobileMenu() {
    mainNav.classList.remove('active');
    menuOverlay.classList.remove('active');
    mobileMenuToggle.classList.remove('active');
    mobileMenuToggle.setAttribute('aria-expanded', 'false');
    menuIcon.style.display = 'block';
    closeIcon.style.display = 'none';
    body.style.overflow = ''; // Restore scrolling
  }
  
  if (mobileMenuToggle && mainNav && menuOverlay) {
    mobileMenuToggle.addEventListener('click', function() {
      if (mainNav.classList.contains('active')) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
    });
    
    // Close menu when clicking on overlay
    menuOverlay.addEventListener('click', closeMobileMenu);
    
    // Close menu when clicking on a nav link
    const navLinks = mainNav.querySelectorAll('a');
    navLinks.forEach(link => {
      link.addEventListener('click', closeMobileMenu);
    });
    
    // Close menu when pressing Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && mainNav.classList.contains('active')) {
        closeMobileMenu();
      }
    });
  }
  
  // Add active class to current page in navigation
  const currentPage = window.location.pathname.split('/').pop();
  const navLinks = document.querySelectorAll('.main-nav a');
  
  // Set the first nav item as active by default on homepage
  if (currentPage === '' || currentPage === 'index.html') {
    const firstNavLink = document.querySelector('.main-nav a');
    if (firstNavLink) {
      firstNavLink.classList.add('active');
    }
  }
  
  // Function to highlight the active navigation item based on scroll position
  function highlightNavigation() {
    const sections = document.querySelectorAll('section[id]');
    const scrollPosition = window.scrollY + 100; // Offset for header height
    
    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      const sectionId = section.getAttribute('id');
      
      if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
        // Remove active class from all nav links
        document.querySelectorAll('.main-nav a').forEach(link => {
          link.classList.remove('active');
        });
        
        // Add active class to corresponding nav link
        const correspondingNavLink = document.querySelector(`.main-nav a[href="#${sectionId}"]`);
        if (correspondingNavLink) {
          correspondingNavLink.classList.add('active');
        }
      }
    });
  }
  
  // Add scroll event listener for navigation highlighting
  window.addEventListener('scroll', highlightNavigation);
  
  // Scroll indicator functionality
  const scrollIndicator = document.querySelector('.scroll-indicator');
  if (scrollIndicator) {
    scrollIndicator.addEventListener('click', function() {
      const aboutSection = document.querySelector('#about');
      if (aboutSection) {
        aboutSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
    
    // Hide scroll indicator when scrolling down
    window.addEventListener('scroll', function() {
      if (window.scrollY > 200) {
        scrollIndicator.style.opacity = '0';
        scrollIndicator.style.pointerEvents = 'none';
      } else {
        scrollIndicator.style.opacity = '0.8';
        scrollIndicator.style.pointerEvents = 'auto';
      }
    });
  }
  
  navLinks.forEach(link => {
    const linkHref = link.getAttribute('href');
    if (linkHref === currentPage || (currentPage === '' && linkHref === 'index.html')) {
      link.classList.add('active');
    }
  });
  
  // Smooth scrolling for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
        
        // Update URL but don't add to history
        history.replaceState(null, null, targetId);
      }
    });
  });
  
  // Form validation
  const contactForm = document.querySelector('.contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      let isValid = true;
      const nameInput = contactForm.querySelector('input[name="name"]');
      const emailInput = contactForm.querySelector('input[name="email"]');
      const messageInput = contactForm.querySelector('textarea[name="message"]');
      
      // Reset previous error messages
      contactForm.querySelectorAll('.error-message').forEach(el => el.remove());
      
      // Validate name
      if (nameInput && !nameInput.value.trim()) {
        addErrorMessage(nameInput, 'Please enter your name');
        isValid = false;
      }
      
      // Validate email
      if (emailInput) {
        if (!emailInput.value.trim()) {
          addErrorMessage(emailInput, 'Please enter your email');
          isValid = false;
        } else if (!isValidEmail(emailInput.value)) {
          addErrorMessage(emailInput, 'Please enter a valid email address');
          isValid = false;
        }
      }
      
      // Validate message
      if (messageInput && !messageInput.value.trim()) {
        addErrorMessage(messageInput, 'Please enter your message');
        isValid = false;
      }
      
      if (isValid) {
        // In a real application, you would send the form data to a server here
        const submitButton = contactForm.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        
        submitButton.disabled = true;
        submitButton.textContent = 'Sending...';
        
        // Simulate form submission
        setTimeout(() => {
          contactForm.reset();
          submitButton.disabled = false;
          submitButton.textContent = originalText;
          
          // Show success message
          const successMessage = document.createElement('div');
          successMessage.className = 'success-message';
          successMessage.textContent = 'Thank you! Your message has been sent.';
          contactForm.appendChild(successMessage);
          
          // Remove success message after 5 seconds
          setTimeout(() => {
            successMessage.remove();
          }, 5000);
        }, 1500);
      }
    });
  }
  
  // Helper functions
  function addErrorMessage(inputElement, message) {
    const errorMessage = document.createElement('div');
    errorMessage.className = 'error-message';
    errorMessage.textContent = message;
    errorMessage.style.color = 'var(--error)';
    errorMessage.style.fontSize = '0.875rem';
    errorMessage.style.marginTop = '0.25rem';
    
    inputElement.parentNode.appendChild(errorMessage);
    inputElement.style.borderColor = 'var(--error)';
    
    inputElement.addEventListener('input', function() {
      errorMessage.remove();
      inputElement.style.borderColor = '';
    }, { once: true });
  }
  
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  // Animate elements when they come into view
  const animatedElements = document.querySelectorAll('.animate-fadeIn');
  
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    
    animatedElements.forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      observer.observe(el);
    });
  } else {
    // Fallback for browsers that don't support IntersectionObserver
    animatedElements.forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });
  }
});