// JavaScript Minification Script
const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

// Files to minify
const filesToMinify = [
  { input: 'assets/site-main.js', output: 'assets/site-main.min.js' },
  { input: 'js/firebase-config.js', output: 'js/firebase-config.min.js' },
  { input: 'js/includes.js', output: 'js/includes.min.js' }
];

async function minifyFiles() {
  console.log('Starting JavaScript minification...');
  
  for (const file of filesToMinify) {
    try {
      // Read the input file
      const inputPath = path.join(__dirname, file.input);
      const outputPath = path.join(__dirname, file.output);
      
      console.log(`Processing: ${file.input}`);
      
      const code = fs.readFileSync(inputPath, 'utf8');
      
      // Minify the code
      const result = await minify(code, {
        compress: {
          drop_console: true, // Remove console.log statements
          drop_debugger: true // Remove debugger statements
        },
        mangle: true
      });
      
      // Write the minified code to the output file
      fs.writeFileSync(outputPath, result.code);
      
      console.log(`✓ Created: ${file.output}`);
      
      // Calculate size reduction
      const originalSize = fs.statSync(inputPath).size;
      const minifiedSize = fs.statSync(outputPath).size;
      const reduction = ((originalSize - minifiedSize) / originalSize * 100).toFixed(2);
      
      console.log(`  Original size: ${(originalSize / 1024).toFixed(2)} KB`);
      console.log(`  Minified size: ${(minifiedSize / 1024).toFixed(2)} KB`);
      console.log(`  Reduction: ${reduction}%`);
      console.log('-----------------------------------');
    } catch (error) {
      console.error(`Error processing ${file.input}:`, error);
    }
  }
  
  console.log('JavaScript minification completed!');
}

minifyFiles().catch(console.error);