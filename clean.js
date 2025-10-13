#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');

// Recursively remove directory
function removeDirectory(dir) {
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach((file) => {
      const curPath = path.join(dir, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        removeDirectory(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(dir);
  }
}

console.log('Cleaning build artifacts...');
removeDirectory(distDir);
console.log('✓ Clean complete!');
