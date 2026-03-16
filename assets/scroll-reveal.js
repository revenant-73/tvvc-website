document.addEventListener('DOMContentLoaded', () => {
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal-visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  const revealTargets = document.querySelectorAll('section, .card, .glance-item, .athlete-message-box, footer, .detail-card');
  
  revealTargets.forEach(target => {
    target.classList.add('reveal-hidden');
    observer.observe(target);
  });
});
