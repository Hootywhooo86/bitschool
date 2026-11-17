// Redraws the Android launcher icons and splash screens with the pixel apple.
// Needs Playwright (dev tool only): node scripts/make-icons.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const res = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
// The detailed 64×64 apple (icons-hd.js) drawn by the app's own icon().
const iconsJs = ['icons-hd.js', 'icons.js'].map(f => fs.readFileSync(path.join(__dirname, '..', '..', 'app', 'js', f), 'utf8')).join('\n');
const pngSize = f => { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

(async () => {
  const browser = await chromium.launch();
  for (const dir of fs.readdirSync(res)) {
    for (const file of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png', 'splash.png']) {
      const f = path.join(res, dir, file);
      if (!fs.existsSync(f)) continue;
      const [w, h] = pngSize(f);
      const share = file === 'splash.png' ? 0.3 : file === 'ic_launcher_foreground.png' ? 0.5 : 0.72;
      // Whole multiples of 32 keep the pixels even (64×64 art at half, full or double size).
      const apple = Math.max(32, Math.floor(Math.min(w, h) * share / 32) * 32);
      const bg = file === 'ic_launcher_foreground.png' ? 'transparent' : '#0f172a';
      const radius = file === 'ic_launcher_round.png' ? '50%' : '0';
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.setContent(`<html><body style="margin:0;background:transparent">
        <style>:root{--outline:#000;--apple:#ff3b3b;--apple-deep:#a01818}</style>
        <div style="width:${w}px;height:${h}px;background:${bg};border-radius:${radius};display:grid;place-items:center"><div id="a"></div></div>
        <script>${iconsJs};const s=icon('apple',128);document.getElementById('a').innerHTML=s.replace('width="128" height="128"','width="${apple}" height="${apple}"');</script></body></html>`);
      await page.screenshot({ path: f, omitBackground: true });
      await page.close();
      console.log(path.join(dir, file), w + 'x' + h);
    }
  }
  await browser.close();
})();
