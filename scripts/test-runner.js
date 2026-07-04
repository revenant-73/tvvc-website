#!/usr/bin/env node
const { execSync } = require('child_process');

try {
  console.log('Running Playwright tests for mobile navigation...\n');
  execSync('npx playwright test tests/mobile-navigation.spec.js', {
    cwd: 'd:/Websites-Apps/TVVC Website',
    stdio: 'inherit'
  });
  console.log('\n✓ Tests completed successfully');
  process.exit(0);
} catch (error) {
  console.error('\n✗ Test execution failed');
  process.exit(1);
}