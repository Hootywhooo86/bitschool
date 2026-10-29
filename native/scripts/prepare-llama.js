// Unpacks the llama.cpp source that ships inside the node-llama-cpp npm package to native/.llama.cpp,
// where the Android build (android/app/src/main/cpp/CMakeLists.txt) compiles it. Not committed.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const bundle = path.join(__dirname, '..', 'node_modules', 'node-llama-cpp', 'llama', 'gitRelease.bundle');
const dest = path.join(__dirname, '..', '.llama.cpp');
if (fs.existsSync(path.join(dest, 'CMakeLists.txt'))) { console.log('llama.cpp source ready'); process.exit(0); }
if (!fs.existsSync(bundle)) { console.error('Run npm install first (node-llama-cpp provides the llama.cpp source).'); process.exit(1); }
execFileSync('git', ['clone', '--quiet', bundle, dest], { stdio: 'inherit' });
console.log('Unpacked llama.cpp source to .llama.cpp');
