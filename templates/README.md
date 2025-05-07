# TVVC Website Templates

This directory contains templates and includes for maintaining consistent headers and footers across all pages of the TVVC website.

## Available Templates

### 1. HTML Template (Simplest)
- **File**: `page-template.html`
- **Usage**: Copy this file and rename it to create a new page
- **Pros**: Simple, works everywhere
- **Cons**: If you update the header/footer, you need to update all pages manually

### 2. PHP Template (Server-Side Includes)
- **File**: `php-template.php`
- **Usage**: Copy this file, rename it, and modify the page-specific variables
- **Pros**: Header/footer changes automatically apply to all pages
- **Cons**: Requires a server with PHP support

### 3. JavaScript Template (Client-Side Includes)
- **File**: `js-template.html`
- **Usage**: Copy this file and rename it to create a new page
- **Pros**: Works without PHP, header/footer changes automatically apply
- **Cons**: Requires JavaScript, may cause a brief flash before content loads

## How to Create a New Page

### Using the HTML Template (Simplest)
1. Copy `page-template.html` to a new file (e.g., `new-page.html`)
2. Edit the meta information (title, description, etc.)
3. Replace the content in the `<main>` section with your page content

### Using PHP Includes (Recommended if you have PHP)
1. Copy `php-template.php` to a new file (e.g., `new-page.php`)
2. Edit the page variables at the top:
   ```php
   $pageTitle = "Your Page Title";
   $pageDescription = "Your page description";
   $canonicalUrl = "your-page.php";
   ```
3. Replace the content in the `<main>` section with your page content

### Using JavaScript Includes
1. Copy `js-template.html` to a new file (e.g., `new-page.html`)
2. Edit the meta information (title, description, etc.)
3. Replace the content in the `<main>` section with your page content
4. Make sure `js/includes.js` is accessible from your page

## Updating Headers and Footers

### HTML Template
If using the HTML template, you'll need to manually update the header and footer in each page.

### PHP Includes
1. Edit `includes/header.php` to update the header on all pages
2. Edit `includes/footer.php` to update the footer on all pages

### JavaScript Includes
1. Edit `includes/header.html` to update the header on all pages
2. Edit `includes/footer.html` to update the footer on all pages

## Best Practices

1. **Consistent Navigation**: Ensure all pages have the same navigation structure
2. **Update Copyright Year**: The PHP footer automatically updates the year, but check the HTML versions annually
3. **Test All Links**: After creating a new page, test all navigation links
4. **Mobile Testing**: Always test new pages on mobile devices
5. **Keep Templates Updated**: If you make improvements to one template, update the others