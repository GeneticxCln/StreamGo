#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const distDir = path.join(__dirname, 'dist');

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy files from src to dist
function copyDirectory(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    // Skip old/backup files
    if (entry.name.endsWith('_old.html') || 
        entry.name.endsWith('_old.js') || 
        entry.name.endsWith('_old.css') ||
        entry.name === 'test.html') {
      console.log(`Skipping: ${entry.name}`);
      continue;
    }
    
    if (entry.isDirectory()) {
      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied: ${entry.name}`);
    }
  }
}

console.log('Building frontend...');
copyDirectory(srcDir, distDir);
console.log('✓ Build complete!');
