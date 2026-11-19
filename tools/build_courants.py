"""Courant de la rade de Brest : atlas 560 du Shom compacté pour l'app (data/brest.courants.{json,bin}) et fonds vrais (data/brest.fonds.bin).

Usage (environnement des outils, hors du dépôt, avec numpy, netCDF4, py7zr et Pillow) :
  <venv>/bin/python -I tools/build_courants.py <dossier-atlas> <bathy.tif> <sortie> [--fixtures tests/fixtures]

1. Télécharge (si elle manque) l'archive « Atlas de courants de marée 2D au format netcdf - Finistère » du Shom dans <dossier-atlas>
   (ATLASCOURANTS2D_NETCDF_FINISTERE.7z, 776 Mo) et en extrait le seul fichier de la rade de Brest (py7zr). Données non fiables :
   lues par netCDF4, contrôlées (dimensions, coefficients, échéances, port de référence), jamais exécutées.
2. Garde les 13 heures pleines de marée (échéances 0, 12, …, 144 sur 145 au pas de 5 min, PM−6 h à PM+6 h) pour les coefficients 45 et 95,
   les seuls points en mer, et code U (vers l'est) et V (vers le nord) sur un octet signé au pas de 0,02 m/s (borné à ±127).
   data/brest.courants.bin : masque des points en mer (1 bit par nœud, nœud n = j·ni + i, j vers le nord depuis lat0, i vers l'est depuis
   lon0, bit n & 7 de l'octet n >> 3), puis les valeurs [coefficient][heure][U puis V][point en mer, dans l'ordre du masque] (Int8).
3. Fonds EMODnet (bathy.tif de tools/prepare_venue.py, géoréférence lue dans tools/venues/brest.json) aux nœuds de l'atlas,
   interpolés (centres des pixels), ramenés au zéro des cartes : profondeurs EMODnet rapportées à la plus basse mer astronomique, qui est
   0,25 m au-dessus du zéro hydrographique à Brest (Références Altimétriques Maritimes du Shom) ; Int16 en décimètres, nœuds dans le même
   ordre que le masque (tous les nœuds, terre comprise : un fond positif découvre). data/brest.fonds.bin.
4. data/brest.courants.json : en-tête (grille, heures, coefficients, échelle, nombre de points en mer, ordre, source, licence, DOI,
   avertissement, fonds).
5. Imprime les valeurs aux points de contrôle de l'étude (atlas à 5 min non ré-échantillonné, et fichier compacté), l'écart de
   l'interpolation linéaire entre deux heures, les tailles et les empreintes des entrées.
   Avec --fixtures : brest-courant-atlas.json (valeurs brutes de l'atlas en quelques nœuds) pour tests/courant.test.mjs.
"""
import hashlib
import json
import math
import os
import sys
import urllib.request

import netCDF4
import numpy as np
import py7zr
from PIL import Image

args = sys.argv[1:]
FIX = None
if '--fixtures' in args:
    k = args.index('--fixtures')
    FIX = args[k + 1]
    del args[k:k + 2]
if len(args) != 3:
    raise SystemExit(__doc__)
ATLAS, BATHY, OUT = args

URL = ('https://services.data.shom.fr/INSPIRE/telechargement/prepackageGroup/ATLASCOURANTS2D_NETCDF_FINISTERE_PACK_DL/prepackage/'
       'ATLASCOURANTS2D_NETCDF_FINISTERE/file/ATLASCOURANTS2D_NETCDF_FINISTERE.7z')
ARCHIVE = 'ATLASCOURANTS2D_NETCDF_FINISTERE.7z'
NC = 'ATLASCOURANTS2D_NETCDF_FINISTERE/ATLASDYN-SURF_TELEMAC3D-SURF_R1111110_RADE-BREST-560-100M-5min.nc'
CFG = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'venues', 'brest.json'), encoding='utf-8'))
Q = 0.02                 # m/s par unité
LAT_ZH = 0.25            # plus basse mer astronomique de Brest au-dessus du zéro hydrographique (m, RAM du Shom)
KN = 3600 / 1852         # nœuds par m/s
HEURES = list(range(0, 145, 12))


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


# ───────── 1. Archive et fichier de la rade
os.makedirs(ATLAS, exist_ok=True)
arc = os.path.join(ATLAS, ARCHIVE)
if not os.path.exists(arc):
    print('téléchargement de l’archive du Shom…')
    req = urllib.request.Request(URL, headers={'User-Agent': 'outil-courant/1.0'})
    with urllib.request.urlopen(req, timeout=120) as r, open(arc + '.part', 'wb') as o:
        while True:
            b = r.read(1 << 20)
            if not b:
                break
            o.write(b)
    os.replace(arc + '.part', arc)
print(f'archive : {os.path.getsize(arc)} octets, SHA-256 {sha256(arc)}')
nc = os.path.join(ATLAS, NC)
if not os.path.exists(nc):
    with py7zr.SevenZipFile(arc, mode='r') as z:
        names = z.getnames()
        if NC not in names:
            raise SystemExit('fichier de la rade absent de l’archive')
        z.extract(path=ATLAS, targets=[NC])
print(f'fichier de la rade : {os.path.getsize(nc)} octets, SHA-256 {sha256(nc)}')

# ───────── 2. Lecture et contrôles
d = netCDF4.Dataset(nc)
dims = {k: len(v) for k, v in d.dimensions.items()}
assert dims['coeff'] == 2 and dims['time'] == 145 and dims['Z'] == 1, dims
assert d.getncattr('Portref') == 'BREST' and int(d.getncattr('isBM')) == 0, 'port de référence inattendu'
coefs = [int(x) for x in d['coeff'][:]]
assert sorted(coefs) == [45, 95], coefs
tm = np.asarray(d['time'][:], dtype=float)
assert np.allclose(np.diff(tm), 5) and tm[72] - tm[0] == 360, 'échéances inattendues'
lat = np.asarray(d['latitude'][:], dtype=float)
lon = np.asarray(d['longitude'][:], dtype=float)
nj, ni = len(lat), len(lon)
dlat, dlon = (lat[-1] - lat[0]) / (nj - 1), (lon[-1] - lon[0]) / (ni - 1)
assert np.allclose(np.diff(lat), dlat, atol=1e-9) and np.allclose(np.diff(lon), dlon, atol=1e-9), 'grille irrégulière'
U = d['U'][:, :, 0, :, :].filled(np.nan).astype(np.float64)
V = d['V'][:, :, 0, :, :].filled(np.nan).astype(np.float64)
ordre = [coefs.index(45), coefs.index(95)]          # coefficients rangés 45 puis 95
U, V = U[ordre], V[ordre]
sea = ~np.isnan(U[1, 72])
for c in range(2):
    for k in range(145):
        assert ((~np.isnan(U[c, k])) == sea).all() and ((~np.isnan(V[c, k])) == sea).all(), 'masque variable'
nsea = int(sea.sum())
print(f'grille {ni} × {nj} nœuds, {nsea} en mer ; lat0 {lat[0]:.6f} dlat {dlat:.10f} ; lon0 {lon[0]:.6f} dlon {dlon:.10f}')
print(f'plus forte composante : {np.nanmax(np.abs(U)):.3f} / {np.nanmax(np.abs(V)):.3f} m/s (portée du codage ±{127 * Q:.2f} m/s)')

# ───────── 3. Codage
flat = sea.reshape(-1)                                # n = j·ni + i
bits = np.packbits(flat.astype(np.uint8), bitorder='little').tobytes()
vals = np.empty((2, len(HEURES), 2, nsea), dtype=np.int8)
for c in range(2):
    for h, k in enumerate(HEURES):
        for comp, A in enumerate((U, V)):
            vals[c, h, comp] = np.clip(np.round(A[c, k].reshape(-1)[flat] / Q), -127, 127).astype(np.int8)
os.makedirs(OUT, exist_ok=True)
fbin = os.path.join(OUT, 'brest.courants.bin')
with open(fbin, 'wb') as o:
    o.write(bits)
    o.write(vals.tobytes())

# ───────── 4. Fonds aux nœuds de l'atlas
bt = CFG['bathy']
bimg = np.array(Image.open(BATHY)).astype(np.float64)
assert bimg.shape == (bt['height'], bt['width']), bimg.shape
def emod(la, lo):
    fx, fy = (lo - bt['left']) / bt['step'] - 0.5, (bt['top'] - la) / bt['step'] - 0.5
    x0, y0 = int(math.floor(fx)), int(math.floor(fy))
    x0, y0 = min(max(x0, 0), bt['width'] - 2), min(max(y0, 0), bt['height'] - 2)
    tx, ty = min(max(fx - x0, 0), 1), min(max(fy - y0, 0), 1)
    return (bimg[y0, x0] * (1 - tx) * (1 - ty) + bimg[y0, x0 + 1] * tx * (1 - ty)
            + bimg[y0 + 1, x0] * (1 - tx) * ty + bimg[y0 + 1, x0 + 1] * tx * ty)
fonds = np.empty((nj, ni), dtype=np.int16)
for j in range(nj):
    for i in range(ni):
        fonds[j, i] = int(np.clip(round((emod(lat[j], lon[i]) + LAT_ZH) * 10), -32767, 32767))
ffd = os.path.join(OUT, 'brest.fonds.bin')
with open(ffd, 'wb') as o:
    o.write(fonds.astype('<i2').tobytes())

head = {
    'grid': {'lat0': round(float(lat[0]), 8), 'lon0': round(float(lon[0]), 8), 'dlat': round(float(dlat), 12), 'dlon': round(float(dlon), 12), 'ni': ni, 'nj': nj},
    'hours': len(HEURES), 'h0': -6, 'coefs': [45, 95], 'scale': Q, 'sea': nsea,
    'ordre': 'masque des nœuds en mer (1 bit par nœud, n = j·ni + i, j vers le nord depuis lat0, i vers l’est depuis lon0, bit n & 7 de l’octet n >> 3), '
             'puis Int8 [coefficient 45 puis 95][heure de PM−6 h à PM+6 h][U vers l’est puis V vers le nord][points en mer dans l’ordre du masque], m/s = valeur × scale',
    'source': 'Shom – Atlas de courants de marée 2D (édition de juin 2026), rade de Brest, 100 m',
    'licence': 'Licence Ouverte 2.0',
    'doi': '10.17183/ATLASCOURANTS2D_NETCDF',
    'avertissement': 'À n’utiliser qu’en complément des cartes et ouvrages nautiques officiels',
    'fonds': {'file': 'data/brest.fonds.bin', 'type': 'Int16LE', 'scale': 0.1, 'ordre': 'tous les nœuds de la grille, n = j·ni + i',
              'source': 'EMODnet Bathymetry DTM (couche emodnet:mean), plus basse mer astronomique ramenée au zéro des cartes (+0,25 m à Brest, RAM du Shom)',
              'note': 'm au-dessus du zéro des cartes, négatif sous le zéro ; modèle à environ 115 m, lissé près des côtes : marge d’au moins 1 m'},
}
fhd = os.path.join(OUT, 'brest.courants.json')
with open(fhd, 'w', encoding='utf-8') as o:
    json.dump(head, o, ensure_ascii=False, indent=1)
for f in (fbin, ffd, fhd):
    print(f'{f} : {os.path.getsize(f)} octets')

# ───────── 5. Contrôles
def node(la, lo):
    return int(round((la - lat[0]) / dlat)), int(round((lo - lon[0]) / dlon))
def ecrit(A, B, c, k, j, i):
    u, v = A[c, k, j, i], B[c, k, j, i]
    return f'{math.hypot(u, v) * KN:.3f} nd vers {(math.degrees(math.atan2(u, v)) + 360) % 360:05.1f}°'
def code(c, k, j, i):
    n = int(np.sum(flat[:j * ni + i]))
    h = HEURES.index(k)
    return vals[c, h, 0, n] * Q, vals[c, h, 1, n] * Q
print('points de contrôle de l’étude (§ 6.4), vive-eau, nœud le plus proche ; atlas à 5 min / fichier compacté :')
for nom, la, lo, k, ref in (('goulet, milieu Espagnols-Portzic', 48.3490, -4.5400, 36, '3,6 nd vers 077° à PM−3 h'),
                            ('goulet, milieu Espagnols-Portzic', 48.3490, -4.5400, 120, '3,5 nd vers 272° à PM+4 h'),
                            ('zone A, centre', 48.29817, -4.3605, 24, '0,5 nd vers 107° à PM−4 h'),
                            ('zone A, centre', 48.29817, -4.3605, 120, '0,6 nd vers 274° à PM+4 h'),
                            ('zone F, baie de Roscanvel', 48.31825, -4.5275, 72, '0,7 nd vers 304° à PM')):
    j, i = node(la, lo)
    u, v = code(1, k, j, i)
    print(f'  {nom} ({lat[j]:.5f}, {lon[i]:.5f}) PM{(k * 5 - 360) / 60:+.0f} h : atlas {ecrit(U, V, 1, k, j, i)} ; '
          f'compacté {math.hypot(u, v) * KN:.3f} nd vers {(math.degrees(math.atan2(u, v)) + 360) % 360:05.1f}° ; étude {ref}')
    print(f'      morte-eau (atlas) : {ecrit(U, V, 0, k, j, i)}')
err = []
for k in range(145):
    a = min(k // 12, 11)
    f = (k - a * 12) / 12
    ui = U[1, a * 12] * (1 - f) + U[1, a * 12 + 12] * f
    vi = V[1, a * 12] * (1 - f) + V[1, a * 12 + 12] * f
    err.append(np.hypot(ui - U[1, k], vi - V[1, k])[sea] * KN)
e = np.concatenate(err)
print(f'interpolation linéaire entre deux heures contre l’atlas à 5 min, vive-eau : quadratique {np.sqrt(np.mean(e ** 2)):.3f} nd, '
      f'99 % < {np.percentile(e, 99):.2f} nd, maximum {e.max():.2f} nd')
qe = np.abs(vals[1].astype(float) * Q - np.stack([np.stack([U[1, k].reshape(-1)[flat], V[1, k].reshape(-1)[flat]]) for k in HEURES]))
print(f'codage au pas de {Q} m/s : écart maximal {qe.max():.4f} m/s')
for nom, la, lo in (('zone A, centre', 48.29817, -4.3605), ('goulet, milieu', 48.3490, -4.5400), ('zone B', 48.2840, -4.4108)):
    j, i = node(la, lo)
    print(f'fond {nom} : {fonds[j, i] / 10:.1f} m (zéro des cartes)')

if FIX:
    idx = np.flatnonzero(flat)
    pts = []
    for n in idx[::347][:52]:
        j, i = divmod(int(n), ni)
        if j >= nj - 1 or i >= ni - 1:
            continue
        r = lambda x: round(float(x), 4)
        pts.append({'lat': float(lat[j]), 'lon': float(lon[i]),
                    'heures': [[(k * 5 - 360) // 60, [r(U[0, k, j, i]), r(V[0, k, j, i])], [r(U[1, k, j, i]), r(V[1, k, j, i])]] for k in (0, 36, 72, 108, 144)],
                    'demi': [[(k * 5 - 360) / 60, [r(U[1, k, j, i]), r(V[1, k, j, i])]] for k in (42, 102)]})
    with open(os.path.join(FIX, 'brest-courant-atlas.json'), 'w', encoding='utf-8') as o:
        json.dump({'source': 'Shom – Atlas de courants de marée 2D (édition de juin 2026), rade de Brest, 100 m, Licence Ouverte 2.0, doi 10.17183/ATLASCOURANTS2D_NETCDF',
                   'note': 'U, V en m/s (vers l’est, vers le nord) aux nœuds de l’atlas ; heures : [heure de marée, coef. 45, coef. 95] ; demi : [heure de marée, coef. 95] à 5 min',
                   'points': pts}, o, ensure_ascii=False, separators=(',', ':'))
    print(f'fixture : {len(pts)} nœuds')
