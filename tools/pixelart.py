#!/usr/bin/env python3
"""Draws bitschool's pixel icons at 64x64 and writes app/js/icons-hd.js (and the apple app icons).

Each icon is built from shapes in palette letters (see COLORS in app/js/icons.js), then shaded like
hand-made pixel art: a 1px dark outline around the outside, a light rim on the top-left edges and a
darker band on the bottom-right edges of every color region. Run: python3 tools/pixelart.py
"""
import math, os, sys
from PIL import Image, ImageDraw

N = 64
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EMPTY = '.'

# Palette letters -> preview colors (the app uses theme colors for most; see icons.js).
PREVIEW = {
    'k': '#14121c', 'r': '#ff3b3b', 'd': '#a01818', 'R': '#ff8a8a', 'h': '#ffffff', 'w': '#f4f1ff',
    'g': '#22c55e', 'G': '#15803d', 'q': '#86efac', 'b': '#7c4a1e', 'B': '#4a2c12', 'n': '#b77a3f',
    'm': '#9a97b8', 'i': '#f4f1ff', 'a': '#22c55e', 'A': '#15803d', 'L': '#86efac', 'y': '#facc15',
    'Y': '#a16207', 'N': '#fde68a', 'e': '#d6dbe3', 'E': '#8b95a5', 'F': '#4b5563', 'o': '#fb923c',
    'O': '#c2410c', 's': '#f2c29b', 'S': '#d39a6a', 'p': '#f9a8d4', 'P': '#db2777', 'c': '#38bdf8', 'C': '#0369a1',
}
SHADE = {'r': 'd', 'a': 'A', 'y': 'Y', 'g': 'G', 'b': 'B', 'n': 'b', 'w': 'e', 'e': 'E', 'E': 'F', 'o': 'O',
         's': 'S', 'p': 'P', 'c': 'C', 'q': 'g', 'N': 'y', 'R': 'r', 'L': 'a', 'h': 'e'}
LIGHT = {'r': 'R', 'a': 'L', 'y': 'N', 'g': 'q', 'b': 'n', 'w': 'h', 'e': 'w', 'E': 'e', 'F': 'E', 'o': 'y', 'c': 'h', 'p': 'h'}


class Canvas:
    """A 64x64 grid of palette letters, drawn with PIL (no anti-aliasing) one color at a time."""
    def __init__(self):
        self.g = [[EMPTY] * N for _ in range(N)]

    def _paint(self, c, draw_fn):
        m = Image.new('1', (N, N), 0)
        draw_fn(ImageDraw.Draw(m))
        px = m.load()
        for y in range(N):
            for x in range(N):
                if px[x, y]:
                    self.g[y][x] = c

    def ellipse(self, c, cx, cy, rx, ry):
        self._paint(c, lambda d: d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=1))

    def circle(self, c, cx, cy, r):
        self.ellipse(c, cx, cy, r, r)

    def rect(self, c, x0, y0, x1, y1):
        self._paint(c, lambda d: d.rectangle([x0, y0, x1, y1], fill=1))

    def rrect(self, c, x0, y0, x1, y1, r):
        self._paint(c, lambda d: d.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=1))

    def poly(self, c, pts):
        self._paint(c, lambda d: d.polygon([tuple(p) for p in pts], fill=1))

    def line(self, c, pts, w=1):
        self._paint(c, lambda d: d.line([tuple(p) for p in pts], fill=1, width=w))

    def arc(self, c, cx, cy, r, a0, a1, w=2):
        self._paint(c, lambda d: d.arc([cx - r, cy - r, cx + r, cy + r], a0, a1, fill=1, width=w))

    def clear(self, cx, cy, r):
        self.ellipse(EMPTY, cx, cy, r, r)

    def px(self, c, x, y):
        if 0 <= x < N and 0 <= y < N:
            self.g[y][x] = c

    def rot_rect(self, c, cx, cy, w, h, deg):
        a = math.radians(deg)
        pts = []
        for dx, dy in ((-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)):
            pts.append((cx + dx * math.cos(a) - dy * math.sin(a), cy + dx * math.sin(a) + dy * math.cos(a)))
        self.poly(c, pts)


def shade(g, keep=()):
    """Light top-left rims, dark bottom-right bands, then a dark outline outside everything.
    keep: letters left flat (details like eyes and outlines drawn on purpose)."""
    base = [row[:] for row in g]
    out = [row[:] for row in g]
    size = {}
    for row in base:
        for c in row:
            size[c] = size.get(c, 0) + 1
    def at(x, y):
        return base[y][x] if 0 <= x < N and 0 <= y < N else EMPTY
    for y in range(N):
        for x in range(N):
            c = base[y][x]
            if c == EMPTY or c in keep or c == 'k':
                continue
            big = size.get(c, 0) > 90
            # bottom-right: the pixel 1 (or 2 for big shapes) right/below belongs to something else
            dark = at(x + 1, y) != c or at(x, y + 1) != c or (big and (at(x + 2, y) != c or at(x, y + 2) != c))
            lit = at(x - 1, y) != c or at(x, y - 1) != c
            if dark and c in SHADE:
                out[y][x] = SHADE[c]
            elif lit and c in LIGHT and big:
                out[y][x] = LIGHT[c]
    final = [row[:] for row in out]
    for y in range(N):
        for x in range(N):
            if out[y][x] != EMPTY:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < N and 0 <= yy < N and out[yy][xx] not in (EMPTY, 'k'):
                    final[y][x] = 'k'
                    break
    return final


# ---------------------------------------------------------------- the icons
def apple():
    c = Canvas()
    c.ellipse('r', 21, 38, 16, 19)
    c.ellipse('r', 41, 38, 16, 19)
    c.ellipse('r', 31, 44, 20, 15)
    c.poly('r', [(27, 19), (31, 24), (35, 19), (35, 26), (27, 26)])
    c.line('b', [(31, 25), (31, 15), (33, 9)], 3)                       # stem
    c.poly('g', [(35, 14), (40, 8), (49, 6), (56, 8), (50, 13), (42, 16)])  # leaf
    c.line('G', [(37, 13), (52, 8)], 1)
    g = shade(c.g)
    for (x, y) in [(13, 28), (13, 29), (14, 27), (14, 30), (13, 31), (14, 32), (13, 33), (15, 26), (16, 25), (17, 25)]:
        g[y][x] = 'h'
    for (x, y) in [(14, 28), (14, 29), (14, 31), (15, 27), (15, 28)]:
        g[y][x] = 'h'
    return g


def star():
    c = Canvas()
    pts = []
    for i in range(10):
        r = 28 if i % 2 == 0 else 12.5
        a = math.radians(-90 + i * 36)
        pts.append((32 + r * math.cos(a), 35 + r * math.sin(a)))
    c.poly('y', pts)
    g = shade(c.g)
    for x, y in [(26, 33), (26, 34), (26, 35), (27, 33), (27, 34), (27, 35), (37, 33), (37, 34), (37, 35), (38, 33), (38, 34), (38, 35)]:
        g[y][x] = 'k'
    for x in range(28, 37):
        g[40 if 29 < x < 35 else 39][x] = 'k'
    g[33][26] = g[33][37] = 'h'
    for x, y in [(22, 38), (23, 38), (41, 38), (42, 38)]:
        g[y][x] = 'p'
    return g


def book():
    c = Canvas()
    c.poly('a', [(4, 18), (32, 22), (60, 18), (60, 52), (32, 56), (4, 52)])     # cover
    c.poly('w', [(7, 13), (31, 17), (31, 51), (7, 47)])                        # left page
    c.poly('w', [(33, 17), (57, 13), (57, 47), (33, 51)])                      # right page
    c.line('F', [(32, 17), (32, 53)], 2)
    g = shade(c.g)
    for i, y in enumerate(range(22, 44, 4)):
        for x in range(11, 28 - (i % 2) * 4):
            g[y + (x - 11) // 7][x] = 'E'
        for x in range(36 + (i % 3) * 2, 53):
            g[y + (53 - x) // 7][x] = 'E'
    return g


def mic():
    c = Canvas()
    c.arc('F', 32, 26, 17, 10, 170, 3)
    c.rect('F', 30, 44, 34, 54)
    c.rrect('F', 20, 54, 44, 58, 2)
    c.rrect('E', 23, 4, 41, 38, 9)
    c.rect('F', 23, 22, 41, 24)
    g = shade(c.g)
    for y in range(8, 21, 3):
        for x in range(26, 39, 3):
            if g[y][x] not in ('k', '.'):
                g[y][x] = 'F'
    return g


def speaker():
    c = Canvas()
    c.rrect('E', 6, 23, 19, 41, 2)
    c.poly('e', [(19, 23), (33, 10), (33, 54), (19, 41)])
    c.arc('a', 33, 32, 9, -50, 50, 3)
    c.arc('a', 33, 32, 17, -55, 55, 3)
    c.arc('a', 33, 32, 25, -55, 55, 3)
    return shade(c.g)


def chart():
    c = Canvas()
    c.rrect('w', 6, 8, 58, 56, 3)
    c.rect('a', 14, 36, 21, 48)
    c.rect('y', 25, 26, 32, 48)
    c.rect('r', 36, 30, 43, 48)
    c.rect('a', 47, 16, 54, 48)
    g = shade(c.g)
    for x in range(11, 56):
        g[50][x] = 'F'
    for y in range(12, 51):
        g[y][10] = 'F'
    return g


def gear():
    c = Canvas()
    for i in range(8):
        a = i * 45
        c.rot_rect('E', 32 + 21 * math.cos(math.radians(a)), 32 + 21 * math.sin(math.radians(a)), 10, 12, a + 90)
    c.circle('E', 32, 32, 21)
    c.circle('F', 32, 32, 10)
    c.clear(32, 32, 7)
    return shade(c.g)


def flag():
    c = Canvas()
    c.rect('F', 12, 6, 15, 58)
    c.circle('y', 13, 6, 3)
    pts = [(16, 9)] + [(16 + x, 9 + 4 * math.sin(x / 7)) for x in range(0, 41, 4)] + [(56, 33 + 4 * math.sin(40 / 7))] + \
          [(16 + x, 33 + 4 * math.sin(x / 7)) for x in range(40, -1, -4)]
    c.poly('r', pts)
    c.rrect('E', 6, 56, 22, 60, 2)
    g = shade(c.g)
    return g


def trophy():
    c = Canvas()
    c.arc('y', 14, 20, 9, 90, 270, 4)
    c.arc('y', 50, 20, 9, -90, 90, 4)
    c.poly('y', [(14, 8), (50, 8), (48, 26), (40, 36), (24, 36), (16, 26)])
    c.rect('y', 29, 36, 35, 44)
    c.rrect('y', 20, 44, 44, 49, 2)
    c.rrect('b', 16, 49, 48, 58, 2)
    c.rect('N', 28, 52, 36, 54)
    g = shade(c.g, keep=('N',))
    for y in range(12, 28):
        g[y][21] = 'h' if y % 5 else g[y][21]
    return g


def palette():
    c = Canvas()
    c.ellipse('n', 31, 33, 27, 22)
    c.ellipse(EMPTY, 46, 46, 8, 6)
    c.clear(43, 40, 4)
    c.circle('r', 17, 26, 5)
    c.circle('y', 29, 18, 5)
    c.circle('a', 42, 22, 5)
    c.circle('c', 17, 40, 5)
    c.circle('w', 29, 44, 4)
    return shade(c.g)


def rocket():
    c = Canvas()
    c.poly('r', [(17, 40), (8, 52), (8, 58), (22, 50)])
    c.poly('r', [(47, 40), (56, 52), (56, 58), (42, 50)])
    c.ellipse('w', 32, 30, 12, 24)
    c.poly('r', [(32, 2), (24, 14), (40, 14)])
    c.ellipse('r', 32, 12, 9, 8)
    c.rect('w', 20, 15, 44, 50)
    c.ellipse('w', 32, 15, 12, 4)
    c.circle('c', 32, 28, 6)
    c.rect('E', 22, 48, 42, 52)
    c.poly('o', [(24, 53), (40, 53), (32, 63)])
    c.poly('y', [(27, 53), (37, 53), (32, 60)])
    g = shade(c.g)
    g[25][30] = g[25][31] = g[26][30] = 'h'
    return g


def robot():
    c = Canvas()
    c.line('F', [(32, 4), (32, 12)], 2)
    c.circle('r', 32, 4, 3)
    c.rrect('E', 12, 12, 52, 44, 6)
    c.rect('F', 6, 22, 11, 34)
    c.rect('F', 53, 22, 58, 34)
    c.rrect('F', 18, 18, 46, 32, 3)
    c.circle('a', 25, 25, 4)
    c.circle('a', 39, 25, 4)
    c.rrect('F', 22, 36, 42, 40, 1)
    c.rrect('E', 18, 46, 46, 62, 4)
    c.circle('r', 32, 54, 3)
    g = shade(c.g, keep=('F',))
    for x in range(24, 41, 3):
        g[38][x] = 'e'
    g[23][24] = g[23][38] = 'h'
    return g


def dino():
    c = Canvas()
    c.poly('g', [(6, 44), (18, 36), (26, 44), (16, 48)])                       # tail
    c.ellipse('g', 30, 40, 14, 12)                                              # body
    c.rot_rect('g', 40, 26, 10, 18, 25)                                         # neck
    c.rrect('g', 36, 8, 60, 24, 6)                                              # head
    c.rect('g', 22, 48, 27, 58)
    c.rect('g', 34, 48, 39, 58)
    c.rect('g', 20, 56, 28, 59)
    c.rect('g', 32, 56, 40, 59)
    c.line('g', [(42, 34), (48, 38)], 3)                                        # arm
    for x, y in [(22, 27), (28, 25), (34, 26)]:
        c.poly('y', [(x - 3, y + 3), (x, y - 3), (x + 3, y + 3)])
    c.ellipse('q', 30, 44, 8, 5)
    g = shade(c.g, keep=('q',))
    for x, y in [(50, 13), (51, 13), (50, 14), (51, 14)]:
        g[y][x] = 'k'
    g[13][50] = 'h'
    for x in range(48, 58):
        g[20][x] = 'G'
    for x in (49, 52, 55):
        g[21][x] = 'h'
    return g


def helmet():
    c = Canvas()
    c.ellipse('G', 32, 34, 26, 24)
    c.rect(EMPTY, 0, 46, 63, 63)
    c.rrect('G', 4, 42, 60, 50, 3)
    c.rrect('c', 14, 28, 50, 40, 5)
    c.rect('y', 29, 10, 35, 18)
    g = shade(c.g)
    for x in range(18, 30):
        g[30][x] = 'h'
    return g


def ball():
    c = Canvas()
    c.circle('w', 32, 32, 26)
    pent = [(32 + 8 * math.cos(math.radians(-90 + i * 72)), 32 + 8 * math.sin(math.radians(-90 + i * 72))) for i in range(5)]
    c.poly('F', pent)
    for i in range(5):
        a = math.radians(-90 + i * 72)
        x, y = 32 + 22 * math.cos(a), 32 + 22 * math.sin(a)
        c.poly('F', [(x + 6 * math.cos(a + math.radians(k * 72)), y + 6 * math.sin(a + math.radians(k * 72))) for k in range(5)])
        c.line('F', [(32 + 8 * math.cos(a), 32 + 8 * math.sin(a)), (x, y)], 1)
    c.rect(EMPTY, 0, 0, 63, 3)
    g = shade(c.g, keep=('F',))
    for y in range(N):
        for x in range(N):
            if (x - 32) ** 2 + (y - 32) ** 2 > 26.5 ** 2 and g[y][x] == 'F':
                g[y][x] = '.'
    return shade_outline_only(g)


def shade_outline_only(g):
    out = [row[:] for row in g]
    for y in range(N):
        for x in range(N):
            if g[y][x] == EMPTY and any(0 <= x + dx < N and 0 <= y + dy < N and g[y + dy][x + dx] not in (EMPTY, 'k')
                                        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                out[y][x] = 'k'
    return out


def mask():
    c = Canvas()
    c.line('r', [(2, 30), (10, 32)], 3)
    c.line('r', [(54, 32), (62, 30)], 3)
    c.ellipse('r', 21, 32, 14, 11)
    c.ellipse('r', 43, 32, 14, 11)
    c.rect('r', 21, 26, 43, 36)
    c.poly(EMPTY, [(27, 38), (32, 33), (37, 38), (37, 44), (27, 44)])
    c.ellipse('w', 20, 32, 6, 4)
    c.ellipse('w', 44, 32, 6, 4)
    return shade(c.g, keep=('w',))


def castle():
    c = Canvas()
    c.rect('E', 10, 26, 54, 58)
    for x0 in (4, 44):
        c.rect('E', x0, 16, x0 + 16, 58)
        for i in range(3):
            c.rect('E', x0 + i * 6, 11, x0 + i * 6 + 3, 16)
    for i in range(4):
        c.rect('E', 22 + i * 6, 22, 24 + i * 6, 26)
    c.rrect('b', 26, 40, 38, 58, 6)
    c.rect('b', 26, 48, 38, 58)
    c.rect('F', 10, 30, 13, 36)
    c.rect('F', 51, 30, 54, 36)
    c.line('F', [(32, 4), (32, 22)], 1)
    c.poly('r', [(33, 4), (42, 7), (33, 10)])
    g = shade(c.g, keep=('F',))
    for y in range(30, 56, 6):
        for x in range(12 + (y // 6 % 2) * 4, 52, 8):
            if g[y][x] == 'E':
                g[y][x] = 'F'
    return g


def bug():
    c = Canvas()
    for i, y in enumerate((30, 40, 50)):
        c.line('F', [(32, y), (8 + i * 2, y - 6), (4, y + 4)], 2)
        c.line('F', [(32, y), (56 - i * 2, y - 6), (60, y + 4)], 2)
    c.ellipse('g', 32, 42, 14, 16)
    c.ellipse('G', 32, 22, 11, 9)
    c.line('F', [(26, 15), (18, 5)], 2)
    c.line('F', [(38, 15), (46, 5)], 2)
    c.line('k', [(32, 28), (32, 57)], 1)
    g = shade(c.g)
    for x, y in [(27, 21), (28, 21), (27, 22), (28, 22), (36, 21), (37, 21), (36, 22), (37, 22)]:
        g[y][x] = 'r'
    g[21][27] = g[21][36] = 'h'
    return g


def sheet():
    c = Canvas()
    c.poly('w', [(10, 4), (42, 4), (54, 16), (54, 60), (10, 60)])
    c.poly('e', [(42, 4), (42, 16), (54, 16)])
    g = shade(c.g, keep=('e',))
    for i, y in enumerate(range(24, 56, 8)):
        for x in range(26, 48):
            g[y][x] = 'E'
        for k, (dx, dy) in enumerate([(0, 0), (1, 1), (2, 2), (3, 1), (4, 0), (5, -1), (6, -2)]):
            g[y + dy][16 + dx] = 'g' if i < 3 else 'm'
            g[y + dy + 1][16 + dx] = 'G' if i < 3 else 'm'
    return g


def pencil():
    c = Canvas()
    c.rot_rect('y', 32, 32, 12, 40, 45)
    c.rot_rect('e', 46.5, 17.5, 12, 6, 45)
    c.rot_rect('p', 51, 13, 12, 7, 45)
    c.poly('n', [(17.5, 38.5), (25.5, 46.5), (10, 54)])
    c.poly('F', [(13.5, 47), (17, 50.5), (10, 54)])
    g = shade(c.g)
    return g


def flame():
    c = Canvas()
    def drop(col, cx, top, w, bottom):
        pts = []
        for i in range(0, 181, 10):
            a = math.radians(i)
            pts.append((cx + w * math.cos(a), bottom - w + w * math.sin(a)))
        c.poly(col, [(cx + w, bottom - w)] + pts[::-1][:1] + pts + [(cx - w, bottom - w), (cx, top)])
        c.ellipse(col, cx, bottom - w, w, w)
        c.poly(col, [(cx - w, bottom - w), (cx, top), (cx + w, bottom - w)])
    drop('o', 32, 3, 22, 60)
    c.poly('o', [(44, 30), (52, 14), (54, 34)])
    drop('y', 32, 22, 13, 58)
    drop('h', 32, 38, 6, 57)
    return shade(c.g, keep=('h',))


def worm():
    c = Canvas()
    for i, (x, y, r) in enumerate([(30, 58, 9), (32, 48, 9), (33, 38, 10)]):
        c.circle('g', x, y, r)
    c.circle('g', 32, 22, 15)
    g = shade(c.g)
    for x, y in [(26, 19), (27, 19), (26, 20), (27, 20), (37, 19), (38, 19), (37, 20), (38, 20)]:
        g[y][x] = 'k'
    g[19][26] = g[19][37] = 'h'
    for x in range(28, 37):
        g[28 if 29 < x < 35 else 27][x] = 'k'
    g[25][22] = g[25][41] = 'p'
    for y in (44, 54):
        for x in range(25, 39):
            if g[y][x] == 'g':
                g[y][x] = 'G'
    return g


ICONS = {f.__name__: f for f in (apple, star, book, mic, speaker, chart, gear, flag, trophy, palette, rocket, robot,
                                 dino, helmet, ball, mask, castle, bug, sheet, pencil, flame, worm)}


def rle(row):
    out, i = '', 0
    while i < len(row):
        j = i
        while j < len(row) and row[j] == row[i]:
            j += 1
        out += row[i] + (str(j - i) if j - i > 1 else '')
        i = j
    return out


def main():
    grids = {name: f() for name, f in ICONS.items()}
    for name, g in grids.items():
        assert len(g) == N and all(len(r) == N for r in g), name
        bad = {c for r in g for c in r if c != EMPTY and c not in PREVIEW}
        assert not bad, (name, bad)
    js = ['// Generated by tools/pixelart.py: 64x64 pixel art, one string per row, run-length encoded',
          '// ("r12" = 12 pixels of color r, "." = empty). Edit the drawings there, not here.',
          'const ICONS_HD = {']
    for name, g in grids.items():
        js.append(f"  {name}: {[rle(''.join(r)) for r in g]!r},".replace("'", '"'))
    js.append('};')
    open(os.path.join(ROOT, 'app/js/icons-hd.js'), 'w').write('\n'.join(js) + '\n')

    # Preview sheet and the apple app icons (fixed colors).
    def img(g, scale):
        im = Image.new('RGBA', (N * scale, N * scale), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        for y in range(N):
            for x in range(N):
                c = g[y][x]
                if c != EMPTY:
                    d.rectangle([x * scale, y * scale, x * scale + scale - 1, y * scale + scale - 1], fill=PREVIEW[c])
        return im
    out = sys.argv[1] if len(sys.argv) > 1 else None
    if out:
        cols, s = 6, 3
        sheet_im = Image.new('RGBA', (cols * (N * s + 16) + 16, ((len(grids) + cols - 1) // cols) * (N * s + 16) + 16), '#1b1b2e')
        for i, g in enumerate(grids.values()):
            sheet_im.alpha_composite(img(g, s), (16 + (i % cols) * (N * s + 16), 16 + (i // cols) * (N * s + 16)))
        sheet_im.save(out)
    for size in (128, 192, 512):
        a = img(grids['apple'], 1).resize((size, size), Image.NEAREST)
        a.save(os.path.join(ROOT, f'app/icons/apple-{size}.png'))
    print('wrote', len(grids), 'icons')


if __name__ == '__main__':
    main()
