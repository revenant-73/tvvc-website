// Simple script to check file sizes
const fs = require('fs');

const originalFile = 'assets/site-styles.css';
const minifiedFile = 'assets/site-styles.min.css';

try {
  const originalSize = fs.statSync(originalFile).size;
  const minifiedSize = fs.statSync(minifiedFile).size;
  
  const savings = originalSize - minifiedSize;
  const savingsPercentage = (savings / originalSize * 100).toFixed(2);
  
  console.log(`Original CSS: ${(originalSize / 1024).toFixed(2)} KB`);
  console.log(`Minified CSS: ${(minifiedSize / 1024).toFixed(2)} KB`);
  console.log(`Savings: ${(savings / 1024).toFixed(2)} KB (${savingsPercentage}%)`);
} catch (err) {
  console.error('Error checking file sizes:', err);
}