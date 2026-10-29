// Copies the web app (../app) into www/, which both Electron and Capacitor package.
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', '..', 'app');
const dest = path.join(__dirname, '..', 'www');
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log('Copied app/ to www/');
