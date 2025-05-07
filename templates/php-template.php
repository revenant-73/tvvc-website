<?php
// Define page-specific variables
$pageTitle = "Page Title";
$pageDescription = "Page description goes here.";
$canonicalUrl = "page-url.html";
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <!-- Basic Meta Tags -->
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, shrink-to-fit=no">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title><?php echo $pageTitle; ?> - Tualatin Valley Volleyball Club</title>
  <meta name="description" content="<?php echo $pageDescription; ?>">
  <meta name="keywords" content="volleyball, TVVC, Portland volleyball, youth volleyball">
  <meta name="author" content="Tualatin Valley Volleyball Club">
  <meta name="robots" content="index, follow">
  
  <!-- Canonical URL -->
  <link rel="canonical" href="https://www.tualatinvalleyvb.com/<?php echo $canonicalUrl; ?>">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://www.tualatinvalleyvb.com/<?php echo $canonicalUrl; ?>">
  <meta property="og:title" content="<?php echo $pageTitle; ?> - Tualatin Valley Volleyball Club">
  <meta property="og:description" content="<?php echo $pageDescription; ?>">
  <meta property="og:image" content="https://www.tualatinvalleyvb.com/assets/images/tvvc-social-share.jpg">
  <meta property="og:image:alt" content="Tualatin Valley Volleyball Club logo and players">
  <meta property="og:site_name" content="Tualatin Valley Volleyball Club">
  <meta property="og:locale" content="en_US">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="https://www.tualatinvalleyvb.com/<?php echo $canonicalUrl; ?>">
  <meta name="twitter:title" content="<?php echo $pageTitle; ?> - Tualatin Valley Volleyball Club">
  <meta name="twitter:description" content="<?php echo $pageDescription; ?>">
  <meta name="twitter:image" content="https://www.tualatinvalleyvb.com/assets/images/tvvc-social-share.jpg">
  <meta name="twitter:image:alt" content="Tualatin Valley Volleyball Club logo and players">
  
  <!-- Favicons -->
  <link rel="apple-touch-icon" sizes="180x180" href="assets/favicon/apple-touch-icon.png">
  <link rel="icon" type="image/png" sizes="32x32" href="assets/favicon/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="assets/favicon/favicon-16x16.png">
  <link rel="manifest" href="assets/favicon/site.webmanifest">
  <link rel="mask-icon" href="assets/favicon/safari-pinned-tab.svg" color="#008080">
  <meta name="msapplication-TileColor" content="#008080">
  <meta name="theme-color" content="#121212">
  
  <!-- Fonts - optimized loading -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Outfit:wght@600;700;800&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet"></noscript>
  
  <!-- Font Awesome Icons - with preload for performance -->
  <link rel="preload" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"></noscript>
  
  <!-- Custom CSS - Minified for performance -->
  <link rel="stylesheet" href="assets/site-styles.min.css">
</head>
<body>
  <!-- Page Loader -->
  <div id="page-loader" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: #121212; display: flex; justify-content: center; align-items: center; z-index: 9999; transition: opacity 0.5s ease, visibility 0.5s ease;">
    <div style="text-align: center;">
      <div style="width: 80px; height: 80px; position: relative; margin: 0 auto 20px;">
        <div style="position: absolute; width: 100%; height: 100%; border: 4px solid rgba(0, 128, 128, 0.2); border-radius: 50%; animation: pulse 1.5s ease-in-out infinite;"></div>
        <div style="position: absolute; width: 100%; height: 100%; border: 4px solid transparent; border-top-color: var(--color-teal); border-radius: 50%; animation: spin 1s linear infinite;"></div>
      </div>
      <h2 style="color: white; font-family: 'Outfit', sans-serif; letter-spacing: 2px; font-size: 1.5rem; background: linear-gradient(135deg, var(--color-teal), var(--color-coral)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;">TVVC</h2>
    </div>
  </div>
  
  <script>
    // Hide loader when page is loaded
    window.addEventListener('load', function() {
      const loader = document.getElementById('page-loader');
      loader.style.opacity = '0';
      loader.style.visibility = 'hidden';
    });
  </script>
  
  <?php include 'includes/header.php'; ?>

  <!-- Main Content -->
  <main>
    <!-- YOUR PAGE CONTENT GOES HERE -->
    <section class="section">
      <div class="container">
        <h1><?php echo $pageTitle; ?></h1>
        <p>Page content goes here.</p>
      </div>
    </section>
  </main>

  <?php include 'includes/footer.php'; ?>

  <!-- Firebase SDK -->
  <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js"></script>
  <script src="js/firebase-config.js"></script>
  
  <!-- Custom JavaScript -->
  <script src="assets/site-main.js"></script>
  
  <!-- Site Navigation Script -->
  <script>
    // Mobile menu toggle
    document.addEventListener('DOMContentLoaded', function() {
      const menuToggle = document.querySelector('.mobile-menu-toggle');
      const menuIcon = document.querySelector('.menu-icon');
      const closeIcon = document.querySelector('.close-icon');
      const mainNav = document.getElementById('main-nav');
      const menuOverlay = document.querySelector('.menu-overlay');
      
      if (menuToggle) {
        menuToggle.addEventListener('click', function() {
          document.body.classList.toggle('menu-open');
          mainNav.classList.toggle('active');
          menuOverlay.classList.toggle('active');
          
          // Toggle aria-expanded attribute
          const expanded = menuToggle.getAttribute('aria-expanded') === 'true' || false;
          menuToggle.setAttribute('aria-expanded', !expanded);
          
          // Toggle icons
          if (menuIcon && closeIcon) {
            if (menuIcon.style.display === 'none') {
              menuIcon.style.display = 'inline-block';
              closeIcon.style.display = 'none';
            } else {
              menuIcon.style.display = 'none';
              closeIcon.style.display = 'inline-block';
            }
          }
        });
      }
      
      // Close mobile menu when clicking on a link
      const navLinks = document.querySelectorAll('.nav-link');
      navLinks.forEach(link => {
        link.addEventListener('click', function() {
          document.body.classList.remove('menu-open');
          if (mainNav) mainNav.classList.remove('active');
          if (menuOverlay) menuOverlay.classList.remove('active');
          
          // Reset icons
          if (menuIcon && closeIcon) {
            menuIcon.style.display = 'inline-block';
            closeIcon.style.display = 'none';
          }
          
          // Reset aria-expanded
          if (menuToggle) {
            menuToggle.setAttribute('aria-expanded', 'false');
          }
        });
      });
      
      // Close menu when clicking on overlay
      if (menuOverlay) {
        menuOverlay.addEventListener('click', function() {
          document.body.classList.remove('menu-open');
          mainNav.classList.remove('active');
          menuOverlay.classList.remove('active');
          
          // Reset icons
          if (menuIcon && closeIcon) {
            menuIcon.style.display = 'inline-block';
            closeIcon.style.display = 'none';
          }
          
          // Reset aria-expanded
          if (menuToggle) {
            menuToggle.setAttribute('aria-expanded', 'false');
          }
        });
      }
      
      // Back to top button functionality
      const backToTopButton = document.querySelector('.back-to-top');
      
      function handleScroll() {
        if (window.scrollY > 300) {
          if (backToTopButton) backToTopButton.classList.add('visible');
        } else {
          if (backToTopButton) backToTopButton.classList.remove('visible');
        }
      }
      
      window.addEventListener('scroll', handleScroll);
      handleScroll(); // Check initial position
    });
  </script>
</body>
</html>