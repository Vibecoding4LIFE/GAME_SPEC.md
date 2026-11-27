// src/ui/icons.ts – Pixel-Symbole als SVG (eigene Zeichnung, scharf über shape-rendering="crispEdges").
// "X" = Vordergrund (currentColor), "o" = Zweitfarbe (CSS-Variable --icon-2), "." = durchsichtig. Reine Logik.

type Bitmap = readonly string[];

const mirrorX = (b: Bitmap): Bitmap => b.map((r) => [...r].reverse().join(''));
const transpose = (b: Bitmap): Bitmap => {
  const w = Math.max(...b.map((r) => r.length));
  return Array.from({ length: w }, (_, x) => b.map((r) => r[x] ?? '.').join(''));
};

const ARROW_LEFT: Bitmap = [
  '...X.....',
  '..XX.....',
  '.XXXXXXXX',
  'XXXXXXXXX',
  '.XXXXXXXX',
  '..XX.....',
  '...X.....',
];

const STAR: Bitmap = [
  '....X....',
  '....X....',
  '...XXX...',
  'XXXXXXXXX',
  '.XXXXXXX.',
  '..XXXXX..',
  '..XXXXX..',
  '.XX...XX.',
  '.X.....X.',
];

export const ICONS = {
  rarCommon: [
    '...XXX...',
    '.XXXXXXX.',
    '.XXXXXXX.',
    'XXXXXXXXX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    '.XXXXXXX.',
    '.XXXXXXX.',
    '...XXX...',
  ],
  rarUncommon: [
    '....X....',
    '....X....',
    '...XXX...',
    '...XXX...',
    '..XXXXX..',
    '..XXXXX..',
    '.XXXXXXX.',
    '.XXXXXXX.',
    'XXXXXXXXX',
  ],
  rarRare: [
    '....X....',
    '...XXX...',
    '..XXXXX..',
    '.XXXXXXX.',
    'XXXXXXXXX',
    '.XXXXXXX.',
    '..XXXXX..',
    '...XXX...',
    '....X....',
  ],
  rarEpic: [
    '.........',
    'X...X...X',
    'XX.XXX.XX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    '.XXXXXXX.',
    '.........',
    '.XXXXXXX.',
  ],
  rarLegendary: STAR,
  star: STAR,
  shiny: [
    '....X....',
    '....X....',
    '...XXX...',
    '..XXXXX..',
    'XXXXXXXXX',
    '..XXXXX..',
    '...XXX...',
    '....X....',
    '....X....',
  ],
  book: [
    '............',
    '.XXXX..XXXX.',
    'XooooXXooooX',
    'XooooXXooooX',
    'XoXXoXXoXXoX',
    'XooooXXooooX',
    'XoXXoXXoXXoX',
    'XooooXXooooX',
    'XooooXXooooX',
    'XXXXXXXXXXXX',
    '.....XX.....',
  ],
  bucket: [
    '...XXXXXX...',
    '..X......X..',
    '.X........X.',
    'XXXXXXXXXXXX',
    'XooooooooooX',
    '.XooooooooX.',
    '.XoXooooooX.',
    '.XoXooooooX.',
    '.XooooooooX.',
    '..XooooooX..',
    '..XXXXXXXX..',
  ],
  gear: [
    '....XXX....',
    '.XX.XXX.XX.',
    '.XXXXXXXXX.',
    '..XXXXXXX..',
    'XXXX...XXXX',
    'XXXX...XXXX',
    'XXXX...XXXX',
    '..XXXXXXX..',
    '.XXXXXXXXX.',
    '.XX.XXX.XX.',
    '....XXX....',
  ],
  fullscreen: [
    'XXXX...XXXX',
    'XXXX...XXXX',
    'XX.......XX',
    'XX.......XX',
    '...........',
    '...........',
    '...........',
    'XX.......XX',
    'XX.......XX',
    'XXXX...XXXX',
    'XXXX...XXXX',
  ],
  fullscreenExit: [
    '..XX...XX..',
    '..XX...XX..',
    'XXXX...XXXX',
    'XXXX...XXXX',
    '...........',
    '...........',
    '...........',
    'XXXX...XXXX',
    'XXXX...XXXX',
    '..XX...XX..',
    '..XX...XX..',
  ],
  close: [
    'XX.....XX',
    'XXX...XXX',
    '.XXX.XXX.',
    '..XXXXX..',
    '...XXX...',
    '..XXXXX..',
    '.XXX.XXX.',
    'XXX...XXX',
    'XX.....XX',
  ],
  coin: [
    '..XXXXX..',
    '.XoooooX.',
    'XooXXXooX',
    'XooXooooX',
    'XooXooooX',
    'XooXooooX',
    'XooXXXooX',
    '.XoooooX.',
    '..XXXXX..',
  ],
  hook: [
    '....XX..',
    '....XX..',
    '....XX..',
    '....XX..',
    'X...XX..',
    'XX..XX..',
    'XX..XX..',
    'XX..XX..',
    '.XXXXX..',
    '..XXX...',
  ],
  item: [
    'XXXXXXXXX',
    'XoooooooX',
    'XooXXXooX',
    'XoXoooXoX',
    'XooooXooX',
    'XoooXoooX',
    'XoooooooX',
    'XoooXoooX',
    'XXXXXXXXX',
  ],
  arrowLeft: ARROW_LEFT,
  arrowRight: mirrorX(ARROW_LEFT),
  arrowUp: transpose(ARROW_LEFT),
  arrowDown: transpose(ARROW_LEFT).slice().reverse(),
  bug: [
    '..X...X..',
    '...XXX...',
    '.XXXXXXX.',
    'X.XoXoX.X',
    '.XXXXXXX.',
    'X.XXXXX.X',
    '.XXXXXXX.',
    'X..XXX..X',
  ],
} satisfies Record<string, Bitmap>;

export type IconName = keyof typeof ICONS;

export function iconSize(name: IconName): { w: number; h: number } {
  const b = ICONS[name];
  return { w: Math.max(...b.map((r) => r.length)), h: b.length };
}

/**
 * SVG-Markup eines Symbols. `px` = CSS-Pixel pro Symbolpixel (ganzzahlig).
 * Ergebnis ist reines, festes Markup (keine Nutzereingaben) und darf per innerHTML gesetzt werden.
 */
export function iconSvg(name: IconName, px = 2, extraClass = ''): string {
  const b = ICONS[name];
  const { w, h } = iconSize(name);
  const rects: string[] = [];
  b.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x] ?? '.';
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      if (ch === 'X') rects.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1"/>`);
      else if (ch === 'o') rects.push(`<rect class="i2" x="${x}" y="${y}" width="${end - x}" height="1"/>`);
      x = end;
    }
  });
  const s = Math.max(1, Math.round(px));
  return (
    `<svg class="px-icon ${extraClass}" aria-hidden="true" focusable="false" viewBox="0 0 ${w} ${h}" ` +
    `width="${w * s}" height="${h * s}" shape-rendering="crispEdges" fill="currentColor">${rects.join('')}</svg>`
  );
}
