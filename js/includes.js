// Function to load HTML includes
document.addEventListener('DOMContentLoaded', function() {
  // Load all elements with data-include attribute
  const includes = document.querySelectorAll('[data-include]');
  
  includes.forEach(function(element) {
    const file = element.getAttribute('data-include');
    
    // Fetch the include file
    fetch(file)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.text();
      })
      .then(html => {
        element.innerHTML = html;
        
        // Execute any scripts in the included HTML
        const scripts = element.querySelectorAll('script');
        scripts.forEach(script => {
          const newScript = document.createElement('script');
          
          // Copy all attributes
          Array.from(script.attributes).forEach(attr => {
            newScript.setAttribute(attr.name, attr.value);
          });
          
          // Copy the content
          newScript.innerHTML = script.innerHTML;
          
          // Replace the old script with the new one
          script.parentNode.replaceChild(newScript, script);
        });
        
        // Dispatch an event when the include is loaded
        const event = new CustomEvent('includeLoaded', { detail: { element, file } });
        document.dispatchEvent(event);
      })
      .catch(error => {
        // Silently handle error but show user-friendly message
        element.innerHTML = `<p>Error loading ${file}</p>`;
      });
  });
});