"""Construit le modèle numérique terre + mer d'un plan d'eau (par défaut la rade de Toulon, valeurs de la v42).

Usage : python3 -I tools/build_terrain.py DATA OUT [--config tools/venues/<plan d'eau>.json]
Entrées (téléchargées au préalable dans DATA, par tools/prepare_venue.py pour un autre plan d'eau) :
  osm_extract.json  : côte, digues, zones urbaines, lieux (OpenStreetMap, ODbL) — osm/osm_extract.json avec --config
  bathy.tif         : bathymétrie EMODnet (mean), grille 1/960° — fichier et géoréférence lus dans la configuration
  tiles/13_x_y.png  : tuiles d'altitude Terrarium (AWS Terrain Tiles)
Sorties (dans OUT, préfixées par la configuration : brest.terrain.bin…) :
  terrain.bin   Int16 LE, altitude en décimètres, ligne 0 = nord
  cover.bin     Uint8  : 0 mer, 1 terre, 2 urbain, 3 digue
  coast.json    traits de côte simplifiés [[lon,lat],...]
  meta.json     emprise et dimensions
Sans --config : constantes de Toulon à l'identique (graines écrites à la main, géoréférence du TIFF de Toulon).
Avec --config : graines de la mer tirées de la bathymétrie (fond sous le seuil, loin des traits de côte), jamais écrites à la main.
"""
import json, math, sys, os
import numpy as np
from PIL import Image, ImageDraw

args = sys.argv[1:]
CFG = None
if '--config' in args:
    k = args.index('--config')
    CFG = json.load(open(args[k + 1], encoding='utf-8'))
    del args[k:k + 2]
DATA, OUT = args[0], args[1]
W0, E0, S0, N0 = 5.80, 6.10, 43.00, 43.18
NX, NY = 814, 667            # grille finale (~30 m)
FX, FY = 2442, 2001          # grille fine pour le masque terre/mer (~10 m)
PREFIX = ''
OSM = 'osm_extract.json'
if CFG:
    sys.setrecursionlimit(20000)                 # Douglas-Peucker sur des chemins OSM longs
    b = CFG['bounds']
    W0, E0, S0, N0 = b['west'], b['east'], b['south'], b['north']
    NX, NY = CFG['grid']['nx'], CFG['grid']['ny']
    FX, FY = CFG['fine']['nx'], CFG['fine']['ny']
    PREFIX = CFG['prefix']
    OSM = os.path.join('osm', 'osm_extract.json')

o = json.load(open(os.path.join(DATA, OSM)))

def to_px(lon, lat, nx, ny):
    return ((lon - W0) / (E0 - W0) * nx, (N0 - lat) / (N0 - S0) * ny)

# --- bathymétrie EMODnet : fichier et géoréférence (coin nord-ouest, pas en degrés) de Toulon, ou de la configuration
BATHY = 'bathy.tif'
BL0, BT0, BD = 5.7604166666666785, 43.21041666666666, 0.0010416666666666667
if CFG:
    BATHY = CFG['bathy']['file']
    BL0, BT0, BD = CFG['bathy']['left'], CFG['bathy']['top'], CFG['bathy']['step']
bimg = Image.open(os.path.join(DATA, BATHY))
bt = np.array(bimg).astype(np.float64)
if CFG:
    # contrôle de la géoréférence (piège 3) : taille attendue et point d'attache du GeoTIFF s'il est présent
    if bt.shape != (CFG['bathy']['height'], CFG['bathy']['width']):
        raise SystemExit(f'bathymétrie : taille {bt.shape} au lieu de {(CFG["bathy"]["height"], CFG["bathy"]["width"])}')
    tie = bimg.tag_v2.get(33922) if hasattr(bimg, 'tag_v2') else None     # ModelTiepointTag
    scale = bimg.tag_v2.get(33550) if hasattr(bimg, 'tag_v2') else None   # ModelPixelScaleTag
    if tie and scale and (abs(tie[3] - BL0) > BD / 2 or abs(tie[4] - BT0) > BD / 2 or abs(scale[0] - BD) > 1e-9):
        raise SystemExit(f'bathymétrie : géoréférence du fichier {tie[3:5]} {scale[:2]} différente de la configuration')

def sea_seeds(img):
    """Graines de la mer : cellules de la grille fine dont le fond EMODnet est sous le seuil sur tout leur voisinage,
    à l'écart des traits de côte tracés ; une graine tous les `stride` pixels (chaque bassin en reçoit au moins une)."""
    sd = CFG['seeds']
    a = np.array(img)
    # distance (en pixels, max coastClear) aux traits de côte par dilatation simple
    near = a == 255
    r = int(sd['coastClear'])
    grow = near.copy()
    for _ in range(r):
        g = grow.copy()
        g[1:, :] |= grow[:-1, :]; g[:-1, :] |= grow[1:, :]; g[:, 1:] |= grow[:, :-1]; g[:, :-1] |= grow[:, 1:]
        grow = g
    out = []
    st = int(sd['stride'])
    lim = sd['depthBelow']
    for j in range(st // 2, FY, st):
        lat = N0 - (j + 0.5) / FY * (N0 - S0)
        by = int(math.floor((BT0 - lat) / BD))
        if by < 1 or by >= bt.shape[0] - 1:
            continue
        for i in range(st // 2, FX, st):
            if grow[j, i]:
                continue
            lon = W0 + (i + 0.5) / FX * (E0 - W0)
            bx = int(math.floor((lon - BL0) / BD))
            if bx < 1 or bx >= bt.shape[1] - 1:
                continue
            if bt[by - 1:by + 2, bx - 1:bx + 2].max() < lim:
                out.append((lon, lat))
    print('graines de la mer', len(out))
    return out

# --- masque terre/mer : on trace la côte puis on remplit la mer depuis le large
img = Image.new('L', (FX, FY), 0)
dr = ImageDraw.Draw(img)
for way in o['coast']:
    pts = [to_px(x, y, FX, FY) for x, y in way]
    if len(pts) > 1:
        dr.line(pts, fill=255, width=2)
seeds = [(5.95, 43.005), (6.09, 43.005), (5.85, 43.005), (5.95, 43.05)]
if CFG:
    seeds = sea_seeds(img)
for lon, lat in seeds:
    px = tuple(int(v) for v in to_px(lon, lat, FX, FY))
    if img.getpixel(px) == 0:
        ImageDraw.floodfill(img, px, 128)
sea = np.array(img) == 128
# les traits de côte eux-mêmes : on les attribue à la mer à moitié (lissage)
line = np.array(img) == 255
land = ~sea & ~line
print('part de terre', land.mean()); Image.fromarray((land*255).astype(np.uint8)).save(os.path.join(DATA, PREFIX + 'mask_debug.png'))

# digues (Grande Jetée, etc.)
dimg = Image.new('L', (FX, FY), 0)
dd = ImageDraw.Draw(dimg)
for b in o['breakwater']:
    pts = [to_px(x, y, FX, FY) for x, y in b['c']]
    if len(pts) > 1:
        dd.line(pts, fill=255, width=3 if b['t'] == 'breakwater' else 2)
dike = (np.array(dimg) == 255) & sea

# zones urbaines
uimg = Image.new('L', (FX, FY), 0)
ud = ImageDraw.Draw(uimg)
for u in o['urban']:
    pts = [to_px(x, y, FX, FY) for x, y in u['c']]
    if len(pts) > 2:
        ud.polygon(pts, fill=255)
urban = (np.array(uimg) == 255) & land

def down(a):
    a = a.astype(np.float32)
    im = Image.fromarray(a)
    return np.array(im.resize((NX, NY), Image.BOX))

landf = down(land.astype(np.float32) + line * 0.5)
urbf = down(urban)
dikef = down(dike)

# --- altitude terrestre (Terrarium z13)
z = 13
def lon2tx(lon): return (lon + 180) / 360 * 2 ** z
def lat2ty(lat):
    r = math.radians(lat)
    return (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2 ** z
tiles = {}
def tile(x, y):
    k = (x, y)
    if k not in tiles:
        p = os.path.join(DATA, 'tiles', f'13_{x}_{y}.png')
        a = np.array(Image.open(p).convert('RGB')).astype(np.float64)
        tiles[k] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
    return tiles[k]
def terr(lon, lat):
    fx, fy = lon2tx(lon) * 256 - 0.5, lat2ty(lat) * 256 - 0.5
    x0, y0 = math.floor(fx), math.floor(fy)
    tx, ty = fx - x0, fy - y0
    def g(px, py):
        return tile(px // 256, py // 256)[py % 256, px % 256]
    return (g(x0, y0) * (1 - tx) * (1 - ty) + g(x0 + 1, y0) * tx * (1 - ty)
            + g(x0, y0 + 1) * (1 - tx) * ty + g(x0 + 1, y0 + 1) * tx * ty)

# --- bathymétrie EMODnet (lue plus haut)
def bathy(lon, lat):
    fx, fy = (lon - BL0) / BD - 0.5, (BT0 - lat) / BD - 0.5
    x0, y0 = int(math.floor(fx)), int(math.floor(fy))
    tx, ty = fx - x0, fy - y0
    x0 = min(max(x0, 0), bt.shape[1] - 2); y0 = min(max(y0, 0), bt.shape[0] - 2)
    return (bt[y0, x0] * (1 - tx) * (1 - ty) + bt[y0, x0 + 1] * tx * (1 - ty)
            + bt[y0 + 1, x0] * (1 - tx) * ty + bt[y0 + 1, x0 + 1] * tx * ty)

H = np.zeros((NY, NX), np.float32)
for j in range(NY):
    lat = N0 - (j + 0.5) / NY * (N0 - S0)
    for i in range(NX):
        lon = W0 + (i + 0.5) / NX * (E0 - W0)
        lf = landf[j, i]
        if lf >= 0.5:
            h = max(terr(lon, lat), 1.0)
            H[j, i] = h
        else:
            d = bathy(lon, lat)
            d = min(d, -0.8)
            H[j, i] = d

# les fonds très près des côtes : EMODnet est grossier, on impose une pente douce
sea_m = landf < 0.5
from collections import deque
dist = np.full((NY, NX), 1e9)
q = deque()
for j in range(NY):
    for i in range(NX):
        if not sea_m[j, i]:
            dist[j, i] = 0; q.append((j, i))
while q:
    j, i = q.popleft()
    for dj, di in ((1,0),(-1,0),(0,1),(0,-1)):
        jj, ii = j + dj, i + di
        if 0 <= jj < NY and 0 <= ii < NX and dist[jj, ii] > dist[j, i] + 1:
            dist[jj, ii] = dist[j, i] + 1; q.append((jj, ii))
cell = 30.0 if not CFG else CFG['cell']
for j in range(NY):
    for i in range(NX):
        if sea_m[j, i]:
            dmax = -(1.5 + dist[j, i] * cell * 0.09)   # pente ~9 % près du bord
            H[j, i] = max(H[j, i], dmax) if dist[j, i] < 12 else H[j, i]

cover = np.where(landf >= 0.5, np.where(urbf > 0.35, 2, 1), np.where(dikef > 0.12, 3, 0)).astype(np.uint8)
# digues : petite élévation pour les voir
H = np.where(cover == 3, 3.0, H)

(np.round(H * 10).clip(-32000, 32000).astype('<i2')).tofile(os.path.join(OUT, PREFIX + 'terrain.bin'))
cover.tofile(os.path.join(OUT, PREFIX + 'cover.bin'))

# --- côte simplifiée (Douglas-Peucker ~6 m)
def dp(pts, eps):
    if len(pts) < 3: return pts
    a, b = np.array(pts[0]), np.array(pts[-1])
    ab = b - a; L = np.hypot(*ab) or 1e-12
    dmax, idx = 0, 0
    for k in range(1, len(pts) - 1):
        p = np.array(pts[k]); d = abs(ab[0] * (a[1] - p[1]) - ab[1] * (a[0] - p[0])) / L
        if d > dmax: dmax, idx = d, k
    if dmax > eps:
        return dp(pts[:idx + 1], eps)[:-1] + dp(pts[idx:], eps)
    return [pts[0], pts[-1]]
CLON, CLAT = 5.95, 43.1      # centre de la projection de simplification
if CFG:
    CLON, CLAT = CFG['coastCenter']['lon'], CFG['coastCenter']['lat']
kx = math.cos(math.radians(CLAT)) * 111320; ky = 110574
coast = []
for way in o['coast'] + [b['c'] for b in o['breakwater'] if b['t'] == 'breakwater']:
    pm = [[(x - CLON) * kx, (y - CLAT) * ky] for x, y in way]
    s = dp(pm, 6.0)
    ll = [[round(p[0] / kx + CLON, 6), round(p[1] / ky + CLAT, 6)] for p in s]
    if len(ll) > 1 and any(W0 - .02 < x < E0 + .02 and S0 - .02 < y < N0 + .02 for x, y in ll):
        coast.append(ll)
json.dump(coast, open(os.path.join(OUT, PREFIX + 'coast.json'), 'w'), separators=(',', ':'))
SOURCES = ['OpenStreetMap (ODbL)', 'EMODnet Bathymetry DTM', 'AWS Terrain Tiles (SRTM/GMTED)']
if CFG:
    SOURCES = CFG['sources']
json.dump({'west': W0, 'east': E0, 'south': S0, 'north': N0, 'nx': NX, 'ny': NY,
           'units': 'dm', 'sources': SOURCES},
          open(os.path.join(OUT, PREFIX + 'meta.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print('H min/max', H.min(), H.max(), 'cover counts', np.bincount(cover.ravel()))
