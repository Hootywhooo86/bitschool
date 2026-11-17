// Pixel art drawn as SVG at 128px or larger. One char per pixel; '.' is empty. The detailed 64×64
// art (icons-hd.js, made by tools/pixelart.py) is used everywhere except the Classic Pixel look, which
// keeps the original chunky 16×16 drawings below. Colors come from the theme, so icons follow the
// color settings.
const ICON_COLORS = {
  k: 'var(--outline)', r: 'var(--apple)', d: 'var(--apple-deep)', h: '#ffffff', w: '#f4f1ff',
  g: '#22c55e', G: '#15803d', b: '#7c4a1e', m: 'var(--muted)', i: 'var(--ink)',
  a: 'var(--accent)', A: 'var(--accent-deep)', y: 'var(--accent2)', Y: 'var(--accent2-deep)',
  // lighter rims and the fixed colors of the detailed art
  R: 'color-mix(in srgb, var(--apple) 55%, #fff)', L: 'color-mix(in srgb, var(--accent) 50%, #fff)', N: 'color-mix(in srgb, var(--accent2) 45%, #fff)',
  q: '#86efac', B: '#4a2c12', n: '#b77a3f', e: '#d6dbe3', E: '#8b95a5', F: '#4b5563', o: '#fb923c', O: '#c2410c',
  s: '#f2c29b', S: '#d39a6a', p: '#f9a8d4', P: '#db2777', c: '#38bdf8', C: '#0369a1',
};

const ICONS = {
  apple: [
    '................', '........kk......', '.......kbk.kkk..', '.......kbk.kgggk',
    '..kkkkkkbkkgGk..', '.krrrrrkbkrrrrk.', 'krhhrrrrrrrrrrdk', 'krhrrrrrrrrrrrdk',
    'krhrrrrrrrrrrrdk', 'krrrrrrrrrrrrrdk', 'krrrrrrrrrrrrddk', 'krrrrrrrrrrrrddk',
    '.krrrrrrrrrrddk.', '.kdrrrrrrrrdddk.', '..kddrrkkrrddk..', '...kkkk..kkkk...',
  ],
  book: [
    '................', '................', '.kkkkkkkkkkkkkk.', '.kwwwwwkkwwwwwk.',
    '.kwmmmwkkwmmmwk.', '.kwwwwwkkwwwwwk.', '.kwmmmwkkwmmmwk.', '.kwwwwwkkwwwwwk.',
    '.kwmmwwkkwmmmwk.', '.kwwwwwkkwwwwwk.', '.kwmmmwkkwmmwwk.', '.kwwwwwkkwwwwwk.',
    'kaaaaaakkaaaaaak', '.kAAAAAAAAAAAAk.', '..kkkkkkkkkkkk..', '................',
  ],
  mic: [
    '................', '......kkkk......', '.....kaaaak.....', '.....kahaak.....',
    '.....kahaak.....', '.....kaaaak.....', '...k.kaaaak.k...', '...k.kAAAAk.k...',
    '...k..kkkk..k...', '....k......k....', '.....kkkkkk.....', '.......kk.......',
    '.......kk.......', '.....kkkkkk.....', '................', '................',
  ],
  star: [
    '................', '.......kk.......', '......kyyk......', '......kyyk......',
    '.....kyyyyk.....', '.kkkkkyyyykkkkk.', '.kyyyyyyyyyyyyk.', '..kyyyyyyyyyyk..',
    '...kyyyyyyyyk...', '....kyyyyyyk....', '....kyyyyyyk....', '...kyyykkyyyk...',
    '..kyyk....kyyk..', '..kyk......kyk..', '..kk........kk..', '................',
  ],
  chart: [
    '................', '................', '..........kkk...', '..........kyk...',
    '..........kyk...', '......kkk.kyk...', '......kak.kyk...', '......kak.kyk...',
    '..kkk.kak.kyk...', '..krk.kak.kyk...', '..krk.kak.kyk...', '..krk.kak.kyk...',
    '..krk.kak.kyk...', '.kkkkkkkkkkkkkk.', '................', '................',
  ],
  gear: [
    '................', '......kkkk......', '......kmmk......', '..kk.kmmmmk.kk..',
    '..kmkkmmmmkkmk..', '...kmmmmmmmmk...', '.kkkmmmkkmmmkkk.', '.kmmmmk..kmmmmk.',
    '.kmmmmk..kmmmmk.', '.kkkmmmkkmmmkkk.', '...kmmmmmmmmk...', '..kmkkmmmmkkmk..',
    '..kk.kmmmmk.kk..', '......kmmk......', '......kkkk......', '................',
  ],
  flag: [
    '................', '..kk............', '..kkkkkkkkk.....', '..kkaaaaaaakk...',
    '..kkaaaaaaaaak..', '..kkaayyyaaaak..', '..kkaayyyaaak...', '..kkaaaaaaakk...',
    '..kkkkkkkkk.....', '..kk............', '..kk............', '..kk............',
    '..kk............', '..kk............', '.kkkk...........', 'kkkkkk..........',
  ],
  trophy: [
    '................', '...kkkkkkkkkk...', '.kkkyyyyyyyykkk.', 'kykyyhyyyyyykyk.',
    'kykyyhyyyyyykyk.', '.kkyyyyyyyyykk..', '...kyyyyyyyk....', '....kyyyyyk.....',
    '.....kyyyk......', '......kyk.......', '......kyk.......', '.....kYYYk......',
    '....kkkkkkk.....', '....kYYYYYk.....', '....kkkkkkk.....', '................',
  ],
  speaker: [
    '................', '................', '........k.......', '.......kk...k...',
    '......kik....k..', '..kkkkiik.k..k..', '..kiiiiik..k.k..', '..kiiiiik..k.k..',
    '..kiiiiik..k.k..', '..kkkkiik.k..k..', '......kik....k..', '.......kk...k...',
    '........k.......', '................', '................', '................',
  ],
  palette: [
    '................', '................', '................', '.....kkkkkk.....',
    '...kkwwwwwwkk...', '..kwwrrwwyywwk..', '.kwwwrrwwyywwwk.', '.kwaawwwwwwwwwk.',
    '.kwaawwwkkwwwwk.', '.kwwwwwk..kwwk..', '.kwwggwwk..kwk..', '..kwggwwwkkwk...',
    '...kkwwwwwwk....', '.....kkkkkk.....', '................', '................',
  ],
  rocket: [
    '................', '.......kk.......', '......kwwk......', '.....kwwwwk.....',
    '.....kwaawk.....', '.....kwaawk.....', '.....kwwwwk.....', '....kkwwwwkk....',
    '...krkwwwwkrk...', '...krkwwwwkrk...', '...kkkwwwwkkk...', '......kkkk......',
    '.....kyyyyk.....', '......kyyk......', '.......kk.......', '................',
  ],
  robot: [
    '................', '.......kk.......', '.......kk.......', '...kkkkkkkkkk...',
    '...kmmmmmmmmk...', '...kmaammaamk...', '...kmmmmmmmmk...', '...kmmkkkkmmk...',
    '...kkkkkkkkkk...', '.kkkmmmmmmmmkkk.', '.kmkmmrrmmmmkmk.', '.kkkmmmmmmmmkkk.',
    '....kmmmmmmk....', '....kmk..kmk....', '....kkk..kkk....', '................',
  ],
  dino: [
    '................', '........kkkkk...', '.......kgggggk..', '.......kgkggggk.',
    '.......kggggkkk.', '.......kgggk....', 'k......kgggkk...', 'kk....kgggggk...',
    'kgk..kggggggk...', '.kgkkgggggggk...', '..kgggggggggk...', '...kgggggggk....',
    '....kggkkggk....', '....kgk..kgk....', '....kkk..kkk....', '................',
  ],
  helmet: [
    '................', '................', '......kkkk......', '....kkGGGGkk....',
    '...kGGGGGGGGk...', '..kGGgGGGGGGGk..', '..kGgGGGGGGGGk..', '..kGGGGGGGGGGk..',
    '.kkkkkkkkkkkkkk.', '.kyyyyyyyyyyyyk.', '.kkkkkkkkkkkkkk.', '...kk......kk...',
    '....kk....kk....', '.....kkkkkk.....', '................', '................',
  ],
  ball: [
    '................', '.....kkkkkk.....', '...kkwwwwwwkk...', '..kwwwkkkkwwwk..',
    '.kwwwkkkkkkwwwk.', '.kwwwwkkkkwwwwk.', 'kwkwwwwwwwwwwkwk', 'kkkkwwwwwwwwkkkk',
    'kkkwwwwwwwwwwkkk', 'kwwwwwkkkkwwwwwk', '.kwwwkkkkkkwwwk.', '.kwwwwkkkkwwwwk.',
    '..kwwwwwwwwwwk..', '...kkwwwwwwkk...', '.....kkkkkk.....', '................',
  ],
  mask: [
    '................', '................', '................', '................',
    '................', '..kkkkkkkkkkkk..', '.krrrrrrrrrrrrk.', 'krrkkkrrrrkkkrrk',
    'krkwwwkrrkwwwkrk', 'krrkkkrrrrkkkrrk', '.krrrrrkkrrrrrk.', '..kkkkk..kkkkk..',
    '................', '................', '................', '................',
  ],
  castle: [
    '................', '................', '.kk.kk....kk.kk.', '.kmkmk....kmkmk.',
    '.kmmmk....kmmmk.', '.kmmmkkkkkkmmmk.', '.kmmmmmmmmmmmmk.', '.kmmmmmyymmmmmk.',
    '.kmmmmmyymmmmmk.', '.kmmmmmmmmmmmmk.', '.kmmmmkkkkmmmmk.', '.kmmmkbbbbkmmmk.',
    '.kmmmkbbbbkmmmk.', '.kkkkkbbbbkkkkk.', '................', '................',
  ],
  bug: [
    '................', '................', '................', '...k........k...',
    '....k......k....', '.....kkkkkk.....', '....kaaaaaak....', '...kahaaaahak...',
    'kk.kaaaaaaaak.kk', '..kkaaakkaaakk..', 'kk.kaaakkaaak.kk', '..kkaaakkaaakk..',
    'kk.kaaakkaaak.kk', '....kkkkkkkk....', '................', '................',
  ],
  pencil: [
    '................', '............kk..', '...........krrk.', '..........krrrk.',
    '.........kyYk...', '........kyYk....', '.......kyYk.....', '......kyYk......',
    '.....kyYk.......', '....kyYk........', '...kyYk.........', '..kyYk..........',
    '.kbbk...........', '.bbkk...........', '.kk.............', 'k...............',
  ],
  flame: [
    '................', '.......k........', '......kyk.......', '......kyyk......',
    '.....kyyyk......', '.....kyyyyk..k..', '....kyyryyk.kyk.', '...kyyrryyykyyk.',
    '...kyrrrryyyyyk.', '..kyyrrrrryyyyk.', '..kyrrrhrrryyk..', '..kyrrhhhrrryk..',
    '..kyrrhhhhrryk..', '...kyrrhhrryk...', '....kkyyyykk....', '......kkkk......',
  ],
  worm: [
    '................', '................', '.....kkkkkk.....', '....kggggggk....',
    '...kghhgghhgk...', '...kghkgghkgk...', '...kggggggggk...', '...kgggkkgggk...',
    '....kgggggggk...', '.....kGggggk....', '.....kgGggk.....', '....kggGgk......',
    '....kgggGk......', '.....kggGk......', '......kgGk......', '......kggk......',
  ],
  sheet: [
    '................', '..kkkkkkkkkk....', '..kwwwwwwwwk....', '..kwmmmmmmwk....',
    '..kwwwwwwwwk....', '..kwmmmmmwwk....', '..kwwwwwwwwk....', '..kwmmmmmmwk....',
    '..kwwwwwwwwk....', '..kwwwwwwwak....', '..kwawwwwawk....', '..kwwawwawwk....',
    '..kwwwaawwwk....', '..kkkkkkkkkk....', '................', '................',
  ],
};

// size is never below 128: every picture in the app is 128px or larger.
const hdCache = {};
// The detailed drawing as one SVG path per color (a few elements instead of thousands of squares).
function hdIcon(name) {
  if (hdCache[name]) return hdCache[name];
  const paths = {};
  ICONS_HD[name].forEach((row, y) => {
    let x = 0;
    for (const [, c, n] of row.matchAll(/([^\d])(\d*)/g)) {
      const run = n ? +n : 1;
      if (c !== '.') paths[c] = (paths[c] || '') + `M${x} ${y}h${run}v1h-${run}z`;
      x += run;
    }
  });
  return (hdCache[name] = Object.entries(paths).map(([c, d]) => `<path d="${d}" style="fill:${ICON_COLORS[c]}"/>`).join(''));
}

function icon(name, size = 128, label = '') {
  const grid = ICONS[name];
  size = Math.max(128, size);
  const look = typeof Store !== 'undefined' && Store.state && Store.state.settings.look;
  if (typeof ICONS_HD !== 'undefined' && ICONS_HD[name] && look !== 'classic') {
    const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
    return `<svg class="px-icon hd" ${a11y} width="${size}" height="${size}" viewBox="0 0 64 64" shape-rendering="crispEdges">${hdIcon(name)}</svg>`;
  }
  let rects = '';
  grid.forEach((row, y) => {
    let x = 0;
    while (x < 16) {
      const c = row[x];
      let run = 1;
      while (x + run < 16 && row[x + run] === c) run++;
      if (c !== '.') rects += `<rect x="${x}" y="${y}" width="${run}" height="1" style="fill:${ICON_COLORS[c]}"/>`;
      x += run;
    }
  });
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="px-icon" ${a11y} width="${size}" height="${size}" viewBox="0 0 16 16" shape-rendering="crispEdges">${rects}</svg>`;
}
