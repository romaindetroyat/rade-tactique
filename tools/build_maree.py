"""Marée de Brest : harmoniques ajustées sur le marégraphe du Shom (REFMAR), fichier du pack data/brest.maree.json (D-13).

Usage (environnement des outils, hors du dépôt, avec numpy, scipy et utide) :
  <venv>/bin/python -I tools/build_maree.py <dossier-observations> <sortie> [--fixtures tests/fixtures]

1. Télécharge (s'il manque) dans <dossier-observations> les hauteurs horaires validées du marégraphe de Brest (station 3, source 4),
   de janvier 2019 à septembre 2026, un mois par requête (31 jours au plus) : fichiers c_AAAA_MM.json. Données non fiables : lues comme
   JSON, valeurs bornées (0 à 9 m), rien n'est exécuté.
2. Ajuste les constituants harmoniques sur 2019-2024 avec corrections nodales (utide, moindres carrés).
3. Contrôle sur 2025-2026 (années non utilisées pour l'ajustement) et IMPRIME les écarts : hauteur, heures et hauteurs des pleines et
   basses mers (extrêmes observés : parabole sur trois heures ; extrêmes prédits : courbe au pas de 5 min).
4. Écrit <sortie>/brest.maree.json : { port, source, licence, zh, z0, c: [[nom, fréquence (cycles/h), amplitude (m), situation (°)]],
   years: { AAAA: { f: […], vu: […] } } } pour 2026 à 2031 ; l'app n'y fait que des cosinus (js/maree.js) :
   h(t) = z0 + Σ f·A·cos(2π·fréquence·(heures depuis le 1er janvier 0 h TU) + (V0+u) − g), f et u au 2 juillet, V0 au 1er janvier.
5. Avec --fixtures : écrit brest-maree-obs.json (observations de 2026, fenêtres fixées d'avance, et leurs pleines et basses mers) et
   brest-maree-outil.json (prédictions de l'outil aux mêmes heures) pour tests/maree.test.mjs.

Source : « Shom – REFMAR », Licence Ouverte 2.0. Prédiction non officielle : en complément des cartes et ouvrages nautiques officiels.
"""
import datetime as dt
import glob
import json
import os
import sys
import time
import urllib.request

import numpy as np
import utide
from utide.harmonics import FUV
from utide._time_conversion import _normalize_time

args = sys.argv[1:]
FIX = None
if '--fixtures' in args:
    k = args.index('--fixtures')
    FIX = args[k + 1]
    del args[k:k + 2]
if len(args) != 2:
    raise SystemExit(__doc__)
OBS, OUT = args

URL = 'https://services.data.shom.fr/maregraphie/observation/json/3?sources=4&dtStart={a}&dtEnd={b}&interval=60'
LAT = 48.3829                      # marégraphe de Brest (latitude, pour les corrections nodales)
DEBUT, FIN = (2019, 1), (2026, 9)  # mois téléchargés
ANNEES = range(2026, 2032)         # années du fichier du pack (hors de ces années : pas de marée, D-13)
UA = {'User-Agent': 'outil-maree/1.0'}

# ───────── 1. Observations
def mois():
    y, m = DEBUT
    while (y, m) <= FIN:
        yield y, m
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)

os.makedirs(OBS, exist_ok=True)
for y, m in mois():
    f = os.path.join(OBS, f'c_{y}_{m:02d}.json')
    if os.path.exists(f) and os.path.getsize(f) > 1000:
        continue
    fin = (dt.date(y + (m == 12), m % 12 + 1, 1) - dt.timedelta(days=1)).day
    url = URL.format(a=f'{y}-{m:02d}-01T00:00:00Z', b=f'{y}-{m:02d}-{fin:02d}T23:00:00Z')
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        body = r.read(5_000_000)
    with open(f, 'wb') as o:
        o.write(body)
    print('téléchargé', os.path.basename(f), len(body), 'octets')
    time.sleep(0.5)

obs = {}
for f in sorted(glob.glob(os.path.join(OBS, 'c_*.json'))):
    try:
        data = json.load(open(f, encoding='utf-8')).get('data', [])
    except (ValueError, AttributeError):
        print('illisible, ignoré :', os.path.basename(f))
        continue
    for r in data:
        if not isinstance(r, dict) or r.get('idstation') != 3 or r.get('idsource') != 4:
            continue
        v = r.get('value')
        if not isinstance(v, (int, float)) or not (0 <= v <= 9):
            continue
        try:
            t = dt.datetime.strptime(r['timestamp'], '%Y/%m/%d %H:%M:%S')
        except (KeyError, TypeError, ValueError):
            continue
        if t.minute == 0 and t.second == 0:
            obs[t] = float(v)
ts = sorted(obs)
print(f'observations horaires validées : {len(ts)} ({ts[0]} → {ts[-1]} TU)')

tn = np.array([np.datetime64(t) for t in ts])
h = np.array([obs[t] for t in ts])
yr = np.array([t.year for t in ts])
fit, test = yr <= 2024, yr >= 2025
print(f'ajustement 2019-2024 : {int(fit.sum())} h ; contrôle 2025-2026 : {int(test.sum())} h')

# ───────── 2. Ajustement
coef = utide.solve(tn[fit], h[fit], lat=LAT, method='ols', conf_int='none', nodal=True, trend=False, verbose=False)
order = np.argsort(-coef.A)
print(f'{len(coef.name)} constituants ; niveau moyen {coef.mean:.3f} m')
print('principaux (amplitude m / situation ° TU) : ' + ', '.join(f'{coef.name[i]} {coef.A[i]:.3f}/{coef.g[i]:.1f}' for i in order[:12]))

# ───────── 3. Contrôle
def rec(t):
    return utide.reconstruct(t, coef, verbose=False).h

pt = rec(tn[test])
e = h[test] - pt
print(f'contrôle 2025-2026, hauteur : écart-type {e.std() * 100:.1f} cm ; quadratique {np.sqrt(np.mean(e ** 2)) * 100:.1f} cm ; '
      f'95 % < {np.percentile(np.abs(e), 95) * 100:.0f} cm ; biais {e.mean() * 100:+.1f} cm')

def extr_horaires(tt, hh):
    """Extrêmes d'une série horaire contiguë : parabole sur trois heures. tt en jours."""
    out = []
    for k in range(1, len(hh) - 1):
        if tt[k + 1] - tt[k - 1] > 2.01 / 24:
            continue
        a, b, c = hh[k - 1], hh[k], hh[k + 1]
        haut = b >= a and b > c
        if not (haut or (b <= a and b < c)):
            continue
        den = a - 2 * b + c
        if den == 0:
            continue
        x = 0.5 * (a - c) / den
        out.append((tt[k] + x / 24, b - 0.25 * (a - c) * x, 'PM' if haut else 'BM'))
    return out

def extr_courbe(t0, t1):
    """Extrêmes prédits entre deux datetimes : courbe au pas de 5 min, parabole sur trois points."""
    n = int((t1 - t0).total_seconds() // 300) + 1
    tt = np.array([np.datetime64(t0) + np.timedelta64(5 * k, 'm') for k in range(n)])
    pp = rec(tt)
    base = (t0 - dt.datetime(1970, 1, 1)).total_seconds() / 86400
    out = []
    for k in range(1, n - 1):
        a, b, c = pp[k - 1], pp[k], pp[k + 1]
        haut = b >= a and b > c
        if not (haut or (b <= a and b < c)):
            continue
        den = a - 2 * b + c
        x = 0.5 * (a - c) / den if den else 0
        out.append((base + (k + x) * 5 / 1440, b - 0.25 * (a - c) * x, 'PM' if haut else 'BM'))
    return out

tday = np.array([(t - dt.datetime(1970, 1, 1)).total_seconds() / 86400 for t in ts])
eo = extr_horaires(tday[test], h[test])
ep = extr_courbe(ts[int(np.argmax(test))] - dt.timedelta(hours=2), ts[-1] + dt.timedelta(hours=2))
ept = np.array([x[0] for x in ep])
dts, dhs = [], []
for to, ho, ko in eo:
    j = int(np.argmin(np.abs(ept - to)))
    if abs(ept[j] - to) < 1.5 / 24 and ep[j][2] == ko:
        dts.append((ept[j] - to) * 1440)
        dhs.append(ep[j][1] - ho)
dts, dhs = np.array(dts), np.array(dhs)
print(f'contrôle 2025-2026, {len(dts)} pleines et basses mers : heure, écart moyen {dts.mean():+.1f} min, écart-type {dts.std():.1f} min, '
      f'95 % < {np.percentile(np.abs(dts), 95):.0f} min ; hauteur, biais {dhs.mean() * 100:+.1f} cm, écart-type {dhs.std() * 100:.1f} cm, '
      f'95 % < {np.percentile(np.abs(dhs), 95) * 100:.0f} cm')

# ───────── 4. Fichier du pack
ngflgs = [coef.aux.opt.nodsatlint, coef.aux.opt.nodsatnone, coef.aux.opt.gwchlint, coef.aux.opt.gwchnone]
lind, frq = coef.aux.lind[order], coef.aux.frq[order]
P = {
    'port': 'Brest',
    'source': 'Shom – REFMAR (marégraphe de Brest), Licence Ouverte 2.0',
    'zh': 'hauteurs en m au-dessus du zéro hydrographique ; temps universel ; prédiction non officielle',
    'ajustement': '2019-2024, contrôle 2025-2026',
    'z0': round(float(coef.mean), 4),
    'c': [[str(coef.name[i]), round(float(frq[k]), 10), round(float(coef.A[i]), 4), round(float(coef.g[i]), 2)] for k, i in enumerate(order)],
    'years': {},
}
for Y in ANNEES:
    t0 = _normalize_time(np.array([np.datetime64(f'{Y}-01-01T00:00:00')]), None)
    tm = _normalize_time(np.array([np.datetime64(f'{Y}-07-02T12:00:00')]), None)
    F, U, _ = FUV(tm, coef.aux.reftime, lind, coef.aux.lat, ngflgs)
    _, _, V0 = FUV(t0, coef.aux.reftime, lind, coef.aux.lat, ngflgs)
    P['years'][str(Y)] = {'f': [round(float(x), 4) for x in F[0]],
                          'vu': [round(float(((V0[0][k] + U[0][k]) % 1) * 360), 2) for k in range(len(order))]}
os.makedirs(OUT, exist_ok=True)
dest = os.path.join(OUT, 'brest.maree.json')
with open(dest, 'w', encoding='utf-8') as o:
    json.dump(P, o, ensure_ascii=False, separators=(',', ':'))
print(f'{dest} : {os.path.getsize(dest)} octets, {len(P["c"])} constituants, années {ANNEES[0]}-{ANNEES[-1]}')

# ───────── 5. Fixtures des tests (fenêtres fixées d'avance : le 8 et le 22 de chaque mois de 2026, 32 heures)
if FIX:
    ms = lambda t: int((t - dt.datetime(1970, 1, 1)).total_seconds() * 1000)
    win, ext = [], []
    for m in range(1, 10):
        for d in (8, 22):
            a = dt.datetime(2026, m, d)
            hrs = [a + dt.timedelta(hours=k) for k in range(32)]
            if not all(x in obs for x in hrs):
                print('fenêtre incomplète, ignorée :', a.date())
                continue
            win.append(hrs)
            tt = np.array([(x - dt.datetime(1970, 1, 1)).total_seconds() / 86400 for x in hrs])
            for t, v, kind in extr_horaires(tt, np.array([obs[x] for x in hrs])):
                ext.append([round(t * 86400000), round(float(v), 3), kind])
    allh = [x for w in win for x in w]
    pred = rec(np.array([np.datetime64(x) for x in allh]))
    lic = 'Shom – REFMAR (marégraphe de Brest, station 3, hauteurs horaires validées), Licence Ouverte 2.0'
    with open(os.path.join(FIX, 'brest-maree-obs.json'), 'w', encoding='utf-8') as o:
        json.dump({'source': lic, 'note': 'fenêtres de 32 h commençant le 8 et le 22 de chaque mois, janvier à septembre 2026 (TU) ; '
                   'extrêmes : parabole sur trois heures', 'h': [[ms(x), obs[x]] for x in allh], 'extremes': ext},
                  o, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(FIX, 'brest-maree-outil.json'), 'w', encoding='utf-8') as o:
        json.dump({'source': 'tools/build_maree.py (utide, ajustement 2019-2024, tous les constituants)', 'h': [[ms(x), round(float(p), 4)] for x, p in zip(allh, pred)]},
                  o, ensure_ascii=False, separators=(',', ':'))
    print(f'fixtures : {len(allh)} heures, {len(ext)} extrêmes observés')

# ───────── GPEN 2027 (contrôle de cohérence avec l'étude, heures légales = TU + 2 h)
print('GPEN 2027, extrêmes prédits (heure légale) :')
for t, v, kind in extr_courbe(dt.datetime(2027, 5, 4, 22), dt.datetime(2027, 5, 9, 22)):
    loc = dt.datetime(1970, 1, 1) + dt.timedelta(days=t, hours=2)
    print(f'  {loc:%d/%m %H:%M} {kind} {v:.2f} m')
