# JavaScript Minification for TVVC Website

This document explains how to use the JavaScript minification script to optimize your website's performance.

## What is Minification?

Minification is the process of removing unnecessary characters from code without changing its functionality. This includes:
- Removing comments
- Removing whitespace and line breaks
- Shortening variable names
- Removing console.log statements
- Optimizing code patterns

The result is smaller file sizes, which leads to faster page loads and better user experience.

## How to Run the Minification Script

1. Make sure you have Node.js installed on your computer
2. Open a terminal/command prompt in the website's root directory
3. Install the required dependencies:
   ```
   npm install
   ```
4. Run the minification script:
   ```
   npm run minify-js
   ```

## What Files Are Being Minified

The script currently minifies these JavaScript files:
- `assets/site-main.js` → `assets/site-main.min.js`
- `js/firebase-config.js` → `js/firebase-config.min.js`
- `js/includes.js` → `js/includes.min.js`

## Adding More Files to Minify

If you want to minify additional JavaScript files, edit the `minify-js.js` file and add entries to the `filesToMinify` array:

```javascript
const filesToMinify = [
  { input: 'path/to/your/file.js', output: 'path/to/your/file.min.js' },
  // Add more files here
];
```

## Important Notes

1. Always keep the original (non-minified) files for development
2. Only use the minified files in production
3. Run the minification script before each deployment
4. The script automatically removes console.log statements from the minified files

## Troubleshooting

If you encounter any issues:
1. Make sure all dependencies are installed (`npm install`)
2. Check that the input files exist at the specified paths
3. Ensure you have write permissions to create the output files