/**
 * Simple cookie consent manager
 * Helps manage third-party cookies and improve site security perception
 */

class CookieConsentManager {
  constructor() {
    this.consentKey = 'tvvc_cookie_consent';
    this.consentBanner = null;
    
    // Check if consent has already been given
    if (!this.hasConsent()) {
      this.createConsentBanner();
    }
  }
  
  hasConsent() {
    return localStorage.getItem(this.consentKey) === 'true';
  }
  
  setConsent(value) {
    localStorage.setItem(this.consentKey, value);
  }
  
  createConsentBanner() {
    // Create banner element
    this.consentBanner = document.createElement('div');
    this.consentBanner.className = 'cookie-consent-banner';
    this.consentBanner.innerHTML = `
      <div class="cookie-content">
        <p>This site uses cookies to enhance your experience and analyze site usage. 
        Some features may use third-party cookies from services like Google. 
        <a href="privacy.html">Learn more</a></p>
        <div class="cookie-buttons">
          <button id="cookie-accept" class="cookie-btn accept">Accept All</button>
          <button id="cookie-reject" class="cookie-btn reject">Reject Non-Essential</button>
        </div>
      </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .cookie-consent-banner {
        position: fixed;
        bottom: 20px;
        left: 20px;
        right: 20px;
        max-width: 1200px;
        margin: 0 auto;
        background-color: rgba(18, 18, 18, 0.95);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        z-index: 9999;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        font-family: 'Inter', sans-serif;
        animation: slideUp 0.5s ease-out;
      }
      
      @keyframes slideUp {
        from { transform: translateY(100px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      
      .cookie-content {
        display: flex;
        flex-direction: column;
        gap: 15px;
      }
      
      .cookie-content p {
        margin: 0;
        line-height: 1.5;
      }
      
      .cookie-content a {
        color: var(--color-teal);
        text-decoration: underline;
      }
      
      .cookie-buttons {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      
      .cookie-btn {
        padding: 8px 16px;
        border-radius: 4px;
        border: none;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .cookie-btn.accept {
        background-color: var(--color-teal);
        color: white;
      }
      
      .cookie-btn.accept:hover {
        background-color: var(--color-coral);
        transform: translateY(-2px);
      }
      
      .cookie-btn.reject {
        background-color: transparent;
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
      }
      
      .cookie-btn.reject:hover {
        background-color: rgba(255, 255, 255, 0.1);
      }
      
      @media (min-width: 768px) {
        .cookie-content {
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
        }
        
        .cookie-content p {
          flex: 1;
          padding-right: 20px;
        }
      }
    `;
    document.head.appendChild(style);
    
    // Add to DOM
    document.body.appendChild(this.consentBanner);
    
    // Add event listeners
    document.getElementById('cookie-accept').addEventListener('click', () => {
      this.setConsent(true);
      this.hideBanner();
    });
    
    document.getElementById('cookie-reject').addEventListener('click', () => {
      this.setConsent(false);
      this.hideBanner();
      this.disableNonEssentialCookies();
    });
  }
  
  hideBanner() {
    if (this.consentBanner) {
      this.consentBanner.style.animation = 'slideDown 0.5s ease-out forwards';
      
      // Add slideDown animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideDown {
          from { transform: translateY(0); opacity: 1; }
          to { transform: translateY(100px); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
      
      // Remove banner after animation completes
      setTimeout(() => {
        if (this.consentBanner && this.consentBanner.parentNode) {
          this.consentBanner.parentNode.removeChild(this.consentBanner);
        }
      }, 500);
    }
  }
  
  disableNonEssentialCookies() {
    // Set cookies to SameSite=Lax
    document.cookie = "SameSite=Lax; Secure; Path=/";
    
    // Disable Google Analytics if it exists
    if (window.ga) {
      window['ga-disable-UA-XXXXXXXX-X'] = true;
    }
    
    // Disable Google Tag Manager if it exists
    if (window.dataLayer) {
      window.dataLayer.push({'config': {'anonymize_ip': true}});
    }
    
    // Add meta tag to prevent Google from setting cookies
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Cookie-Control';
    meta.content = 'third-party=false';
    document.head.appendChild(meta);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new CookieConsentManager();
});