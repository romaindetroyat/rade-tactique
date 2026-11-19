"""Fond de carte haute résolution drapé sur le relief (≈ 6 m par pixel).

Entrées : DATA (osm_extract.json, tiles/13_x_y.png) et OUT/terrain.bin + meta.json (build_terrain.py).
Sorties (OUT) :
  basemap.jpg  couleurs terre (altitude, ombrage, zones urbaines) et fonds marins (profondeur, ombrage)
  seamask.png  masque mer (blanc) / terre (noir) au trait de côte OSM, pour découper la surface de l'eau
Usage : python3 tools/build_basemap.py <dossier-données> data [--config tools/venues/<plan d'eau>.json]
Sans --config : Toulon à l'identique (graines écrites à la main, noms sans préfixe).
Avec --config : entrées et sorties préfixées (brest.meta.json, brest.terrain.bin lus ; brest.basemap.jpg, brest.seamask.png écrits),
graines de la mer tirées du terrain construit (cellules de brest.cover.bin en mer dont le fond de brest.terrain.bin est sous le seuil).
"""
import json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

args = sys.argv[1:]
CFG = None
if '--config' in args:
    k = args.index('--config')
    CFG = json.load(open(args[k + 1], encoding='utf-8'))
    del args[k:k + 2]
DATA, OUT = args[0], args[1]
PREFIX = CFG['prefix'] if CFG else ''
OSM = os.path.join('osm', 'osm_extract.json') if CFG else 'osm_extract.json'
QUALITY = CFG.get('basemapQuality', 84) if CFG else 84
meta = json.load(open(os.path.join(OUT, PREFIX + 'meta.json'), encoding='utf-8'))
W0, E0, S0, N0 = meta['west'], meta['east'], meta['south'], meta['north']
KX = math.cos(math.radians((S0 + N0) / 2)) * 111320
WIDTH = 4096
HEIGHT = round(WIDTH * (N0 - S0) * 110574 / ((E0 - W0) * KX))
o = json.load(open(os.path.join(DATA, OSM)))

def sea_seeds():
    """Graines de la mer tirées du terrain construit : centres des cellules en mer (cover 0) dont le fond est sous le seuil,
    entourées de mer sur leurs huit voisines ; une cellule sur `stride`."""
    nx, ny = meta['nx'], meta['ny']
    cov = np.fromfile(os.path.join(OUT, PREFIX + 'cover.bin'), np.uint8).reshape(ny, nx)
    hh = np.fromfile(os.path.join(OUT, PREFIX + 'terrain.bin'), '<i2').reshape(ny, nx).astype(np.float32) / 10
    ok = (cov == 0) & (hh < CFG['seeds']['depthBelow'])
    core = ok.copy()
    core[1:-1, 1:-1] = ok[1:-1, 1:-1] & ok[:-2, 1:-1] & ok[2:, 1:-1] & ok[1:-1, :-2] & ok[1:-1, 2:] & ok[:-2, :-2] & ok[2:, 2:] & ok[:-2, 2:] & ok[2:, :-2]
    core[0, :] = core[-1, :] = False; core[:, 0] = core[:, -1] = False
    st = max(1, int(CFG['seeds']['stride']) // 3)
    out = []
    for j in range(st // 2, ny, st):
        for i in range(st // 2, nx, st):
            if core[j, i]:
                out.append((W0 + (i + 0.5) / nx * (E0 - W0), N0 - (j + 0.5) / ny * (N0 - S0)))
    print('graines de la mer', len(out))
    return out

def px(lon, lat):
    return ((lon - W0) / (E0 - W0) * WIDTH, (N0 - lat) / (N0 - S0) * HEIGHT)

# ── masque terre / mer au trait de côte
img = Image.new('L', (WIDTH, HEIGHT), 0)
d = ImageDraw.Draw(img)
for way in o['coast']:
    pts = [px(x, y) for x, y in way]
    if len(pts) > 1:
        d.line(pts, fill=255, width=2)
for lon, lat in (sea_seeds() if CFG else [(5.95, 43.005), (6.09, 43.005), (5.85, 43.005), (5.95, 43.05)]):
    p = tuple(int(v) for v in px(lon, lat))
    if img.getpixel(p) == 0:
        ImageDraw.floodfill(img, p, 128)
a = np.array(img)
sea = a == 128
line = a == 255
land = ~sea & ~line
print('terre', land.mean())

# digues et jetées (Grande Jetée…)
dimg = Image.new('L', (WIDTH, HEIGHT), 0)
dd = ImageDraw.Draw(dimg)
for b in o['breakwater']:
    pts = [px(x, y) for x, y in b['c']]
    if len(pts) > 2 and b.get('area') == 'yes':
        dd.polygon(pts, fill=255)
    elif len(pts) > 1:
        dd.line(pts, fill=255, width=4 if b['t'] == 'breakwater' else 3)
dike = np.array(dimg) == 255

# masque mer lissé (anticrénelage) : 1 = mer
seaf = sea.astype(np.float32) + line * 0.5
seaf[dike] = 0
mask = Image.fromarray((seaf * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
mask.save(os.path.join(OUT, PREFIX + 'seamask.png'), optimize=True)

# ── altitude terrestre (Terrarium z13), interpolation bilinéaire vectorisée
z = 13
def lon2tx(lon): return (lon + 180) / 360 * 2 ** z * 256
def lat2ty(lat):
    r = np.radians(lat)
    return (1 - np.log(np.tan(r) + 1 / np.cos(r)) / np.pi) / 2 * 2 ** z * 256
xs = np.linspace(W0, E0, WIDTH, endpoint=False) + (E0 - W0) / WIDTH / 2
ys = np.linspace(N0, S0, HEIGHT, endpoint=False) - (N0 - S0) / HEIGHT / 2
TX = lon2tx(xs) - 0.5
TY = lat2ty(ys) - 0.5
tx0, ty0 = int(TX.min()) // 256, int(TY.min()) // 256
tx1, ty1 = int(TX.max()) // 256 + 1, int(TY.max()) // 256 + 1
mosaic = np.zeros(((ty1 - ty0 + 1) * 256, (tx1 - tx0 + 1) * 256), np.float32)
for tx in range(tx0, tx1 + 1):
    for ty in range(ty0, ty1 + 1):
        p = os.path.join(DATA, 'tiles', f'13_{tx}_{ty}.png')
        if not os.path.exists(p):
            continue
        t = np.array(Image.open(p).convert('RGB')).astype(np.float32)
        mosaic[(ty - ty0) * 256:(ty - ty0 + 1) * 256, (tx - tx0) * 256:(tx - tx0 + 1) * 256] = t[..., 0] * 256 + t[..., 1] + t[..., 2] / 256 - 32768
fx = TX - tx0 * 256
fy = TY - ty0 * 256
ix = np.floor(fx).astype(int); iy = np.floor(fy).astype(int)
wx = (fx - ix)[None, :]; wy = (fy - iy)[:, None]
A = mosaic[iy[:, None], ix[None, :]]; B = mosaic[iy[:, None], ix[None, :] + 1]
C = mosaic[iy[:, None] + 1, ix[None, :]]; D = mosaic[iy[:, None] + 1, ix[None, :] + 1]
elev = A * (1 - wx) * (1 - wy) + B * wx * (1 - wy) + C * (1 - wx) * wy + D * wx * wy

# ── profondeurs : grille terrain.bin (déjà façonnée près des côtes), suréchantillonnée
H = np.fromfile(os.path.join(OUT, PREFIX + 'terrain.bin'), '<i2').reshape(meta['ny'], meta['nx']).astype(np.float32) / 10
depth = np.array(Image.fromarray(np.minimum(H, 0)).resize((WIDTH, HEIGHT), Image.BICUBIC))
depth = np.minimum(depth, -0.5)

# ── ombrage (soleil au NO)
cell = (E0 - W0) * KX / WIDTH
def hillshade(z, exag):
    gy, gx = np.gradient(z * exag, cell)
    slope = np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    az, alt = math.radians(315), math.radians(42)
    return np.clip(np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect), 0, 1)
hs_land = hillshade(np.where(land, np.maximum(elev, 0), 0), 1.6)
hs_sea = hillshade(depth, 3.0)

# ── couleurs
def ramp(v, stops):
    v = np.asarray(v, np.float32)
    out = np.zeros(v.shape + (3,), np.float32)
    for (a0, c0), (a1, c1) in zip(stops[:-1], stops[1:]):
        m = (v >= a0) & (v <= a1)
        t = ((v - a0) / (a1 - a0))[m][:, None]
        out[m] = np.array(c0) * (1 - t) + np.array(c1) * t
    out[v > stops[-1][0]] = stops[-1][1]
    out[v < stops[0][0]] = stops[0][1]
    return out

land_rgb = ramp(np.maximum(elev, 0), [
    (0, (196, 186, 150)), (15, (165, 168, 118)), (60, (120, 140, 86)), (200, (98, 120, 72)),
    (380, (150, 140, 112)), (560, (198, 190, 172)), (720, (226, 220, 206))])
uimg = Image.new('L', (WIDTH, HEIGHT), 0)
ud = ImageDraw.Draw(uimg)
for u in o['urban']:
    pts = [px(x, y) for x, y in u['c']]
    if len(pts) > 2:
        ud.polygon(pts, fill=200 if u['t'] in ('industrial', 'port', 'military') else 170)
urban = np.array(uimg.filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32) / 255
urban_rgb = np.array((214, 206, 192), np.float32)
land_rgb = land_rgb * (1 - urban[..., None] * 0.75) + urban_rgb * (urban[..., None] * 0.75)
land_rgb *= (0.55 + 0.6 * hs_land)[..., None]

sea_rgb = ramp(-depth, [(0, (150, 210, 200)), (6, (96, 180, 186)), (20, (52, 132, 168)), (60, (28, 86, 136)), (150, (16, 52, 96)), (600, (8, 28, 60))])
sea_rgb *= (0.75 + 0.35 * hs_sea)[..., None]

lm = np.array(mask).astype(np.float32)[..., None] / 255  # 1 = mer
rgb = land_rgb * (1 - lm) + sea_rgb * lm
# liseré clair sur le trait de côte (roches / plages) et digues
edge = Image.fromarray(line.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
e = np.array(edge).astype(np.float32)[..., None] / 255
rgb = rgb * (1 - e * 0.55) + np.array((236, 226, 200), np.float32) * (e * 0.55)
rgb[dike] = (232, 228, 218)
Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).save(os.path.join(OUT, PREFIX + 'basemap.jpg'), quality=QUALITY, optimize=True, progressive=True)
meta['basemap'] = {'width': WIDTH, 'height': HEIGHT}
if CFG:
    json.dump(meta, open(os.path.join(OUT, PREFIX + 'meta.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
else:
    json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'), indent=1)
print('ok', WIDTH, HEIGHT, os.path.getsize(os.path.join(OUT, PREFIX + 'basemap.jpg')), os.path.getsize(os.path.join(OUT, PREFIX + 'seamask.png')))
