// Pixel art, 16×16 grids drawn as SVG at 128px or larger. One char per pixel; '.' is empty.
// Colors come from the theme, so icons follow the color settings.
const ICON_COLORS = {
  k: 'var(--outline)', r: 'var(--apple)', d: 'var(--apple-deep)', h: '#ffffff', w: '#f4f1ff',
  g: '#22c55e', G: '#15803d', b: '#7c4a1e', m: 'var(--muted)', i: 'var(--ink)',
  a: 'var(--accent)', A: 'var(--accent-deep)', y: 'var(--accent2)', Y: 'var(--accent2-deep)',
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
};

// size is never below 128: every picture in the app is 128px or larger.
function icon(name, size = 128, label = '') {
  const grid = ICONS[name];
  size = Math.max(128, size);
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
