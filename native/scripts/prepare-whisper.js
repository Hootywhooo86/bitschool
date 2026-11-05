// Unpacks the whisper.cpp source that ships in the whisper.rn npm package (MIT) to native/.whisper,
// where the Android build (android/app/src/main/cpp/CMakeLists.txt) compiles it. Not committed.
// whisper.rn's copy renames its ggml symbols (wsp_ggml…), so it sits beside llama.cpp's ggml.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const VERSION = '0.7.4';
const root = path.join(__dirname, '..');
const dest = path.join(root, '.whisper');
if (fs.existsSync(path.join(dest, 'whisper.cpp'))) { console.log('whisper.cpp source ready'); process.exit(0); }
const work = path.join(root, '.whisper-pkg');
fs.mkdirSync(work, { recursive: true });
execFileSync('npm', ['pack', `whisper.rn@${VERSION}`, '--pack-destination', work, '--silent'], { stdio: 'inherit', shell: process.platform === 'win32' });
execFileSync('tar', ['-xzf', path.join(work, `whisper.rn-${VERSION}.tgz`), '-C', work], { stdio: 'inherit' });
fs.cpSync(path.join(work, 'package', 'cpp'), dest, { recursive: true });
console.log('Unpacked whisper.cpp source to .whisper');
