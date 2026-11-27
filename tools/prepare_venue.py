"""Télécharge les entrées d’un plan d’eau (hors du dépôt) pour tools/build_terrain.py et tools/build_basemap.py.

Usage : python3 -I tools/prepare_venue.py tools/venues/<plan d’eau>.json <dossier-entrées>
        python3 -I tools/prepare_venue.py --types-urbains tools/venues/<plan d’eau>.json
          (affiche en JSON les types landuse rangés en « urbain » pour ce plan d’eau, sans réseau, puis sort)

Types urbains : clé facultative « urban » de la configuration (liste de valeurs landuse, par exemple sans « military »
pour que l’île du Levant reste de la terre naturelle) ; absente, la liste par défaut URBAN (Toulon, Brest).

Chaque source a son dossier sous <dossier-entrées> :
  tiles/     tuiles d’altitude Terrarium (zoom de la configuration), noms 13_x_y.png
  emodnet/   bathymétrie EMODnet (WCS, GeoTIFF en flottants)
  osm/       OpenStreetMap : Overpass d’abord, sinon l’API principale par petites boîtes (osm/boxes/)
             puis osm/osm_extract.json (coast, breakwater, urban : forme lue par les outils)
  manifeste.json   adresse, taille, SHA-256 et date de chaque entrée téléchargée
Les entrées sont des données non fiables : elles sont lues (images, TIFF, XML, JSON), jamais exécutées.
Rien n’est retéléchargé si le fichier existe déjà avec la bonne taille (ou, pour OSM, complet).
Bibliothèque standard seulement (urllib, délais de 60 s) ; en-tête User-Agent générique, sans nom ni adresse.
"""
import hashlib, json, math, os, sys, time
import urllib.error, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

UA = 'rade-outils/1.0 (outil de donnees hors ligne)'
TIMEOUT = 60
URBAN = {'residential': 'residential', 'industrial': 'industrial', 'commercial': 'commercial',
         'military': 'military', 'harbour': 'port'}
PIERS = ('breakwater', 'pier', 'groyne')


class Refus(Exception):
    """Réponse HTTP d’erreur, avec son code."""
    def __init__(self, code, msg=''):
        super().__init__(f'HTTP {code} {msg}'.strip())
        self.code = code


def now():
    return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def fetch(url, dest, data=None):
    """Télécharge url dans dest (écriture dans un fichier temporaire puis renommage)."""
    req = urllib.request.Request(url, data=data, headers={'User-Agent': UA})
    tmp = dest + '.part'
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r, open(tmp, 'wb') as f:
            while True:
                b = r.read(1 << 16)
                if not b:
                    break
                f.write(b)
    except urllib.error.HTTPError as e:
        if os.path.exists(tmp):
            os.remove(tmp)
        body = e.read(300).decode('utf-8', 'replace') if e.fp else ''
        raise Refus(e.code, body)
    os.replace(tmp, dest)


class Manifeste:
    def __init__(self, root):
        self.path = os.path.join(root, 'manifeste.json')
        self.root = root
        self.items = {}
        if os.path.exists(self.path):
            for it in json.load(open(self.path, encoding='utf-8')).get('entrees', []):
                self.items[it['fichier']] = it

    def note(self, rel, url, date=None):
        p = os.path.join(self.root, rel)
        old = self.items.get(rel)
        size = os.path.getsize(p)
        if old and old.get('octets') == size and date is None:
            return
        self.items[rel] = {'fichier': rel, 'adresse': url, 'octets': size, 'sha256': sha256(p), 'date': date or now()}

    def save(self, extra):
        out = {'entrees': [self.items[k] for k in sorted(self.items)], **extra}
        json.dump(out, open(self.path, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)


# ───────────────────────── tuiles Terrarium
def lon2tx(lon, z):
    return (lon + 180) / 360 * 2 ** z


def lat2ty(lat, z):
    r = math.radians(lat)
    return (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2 ** z


def tiles(cfg, root, man):
    t = cfg['tiles']; z = t['zoom']; b = cfg['bounds']
    d = os.path.join(root, 'tiles'); os.makedirs(d, exist_ok=True)
    m = 2 / 256                                    # marge de deux pixels (interpolation au bord)
    x0, x1 = math.floor(lon2tx(b['west'], z) - m), math.floor(lon2tx(b['east'], z) + m)
    y0, y1 = math.floor(lat2ty(b['north'], z) - m), math.floor(lat2ty(b['south'], z) + m)
    n = 0
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            rel = f'tiles/{z}_{x}_{y}.png'
            p = os.path.join(root, rel)
            url = t['url'].format(z=z, x=x, y=y)
            if not (os.path.exists(p) and os.path.getsize(p) > 0):
                fetch(url, p); n += 1
            man.note(rel, url)
    print(f'tuiles : x {x0}-{x1}, y {y0}-{y1} ({(x1 - x0 + 1) * (y1 - y0 + 1)} tuiles, {n} téléchargées)')
    return {'x': [x0, x1], 'y': [y0, y1]}


# ───────────────────────── bathymétrie EMODnet
def bathy(cfg, root, man):
    bt = cfg['bathy']
    rel = bt['file']
    p = os.path.join(root, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
    if not (os.path.exists(p) and os.path.getsize(p) > 0):
        fetch(bt['url'], p)
        print('EMODnet : téléchargé', os.path.getsize(p), 'octets')
    with open(p, 'rb') as f:
        head = f.read(4)
    if head not in (b'II*\x00', b'MM\x00*'):
        raise SystemExit('EMODnet : la réponse n’est pas un TIFF (voir ' + p + ')')
    man.note(rel, bt['url'])


# ───────────────────────── OpenStreetMap
def urban_types(cfg):
    """Types landuse urbains du plan d’eau (clé « urban » de la configuration), dans l’ordre de URBAN ; absente : URBAN."""
    if 'urban' not in cfg:
        return dict(URBAN)
    lst = cfg['urban']
    if not isinstance(lst, list) or not lst or any(not isinstance(t, str) or t not in URBAN for t in lst):
        raise SystemExit('configuration : « urban » doit être une liste non vide de types parmi ' + ', '.join(URBAN))
    return {k: v for k, v in URBAN.items() if k in lst}


def overpass_query(cfg):
    b = cfg['osm']['bbox']
    bb = f"({b['south']},{b['west']},{b['north']},{b['east']})"
    lu = '|'.join(urban_types(cfg))
    return (f'[out:json][timeout:180];('
            f'way["natural"="coastline"]{bb};'
            f'way["man_made"~"^({"|".join(PIERS)})$"]{bb};'
            f'way["landuse"~"^({lu})$"]{bb};'
            f'relation["landuse"~"^({lu})$"]{bb};'
            f');out geom;')


def classify(tags, urban=URBAN):
    if tags.get('natural') == 'coastline':
        return ('coast', None)
    if tags.get('man_made') in PIERS:
        return ('pier', tags['man_made'])
    if tags.get('landuse') in urban:
        return ('urban', urban[tags['landuse']])
    return None


def join_rings(ways):
    """Assemble des chemins (listes de [lon, lat]) en anneaux par leurs extrémités."""
    key = lambda p: (round(p[0], 7), round(p[1], 7))
    todo = [list(w) for w in ways if len(w) > 1]
    rings = []
    while todo:
        cur = todo.pop()
        changed = True
        while key(cur[0]) != key(cur[-1]) and changed:
            changed = False
            for k, w in enumerate(todo):
                if key(w[0]) == key(cur[-1]):
                    cur += w[1:]
                elif key(w[-1]) == key(cur[-1]):
                    cur += w[::-1][1:]
                elif key(w[-1]) == key(cur[0]):
                    cur = w + cur[1:]
                elif key(w[0]) == key(cur[0]):
                    cur = w[::-1] + cur[1:]
                else:
                    continue
                todo.pop(k); changed = True
                break
        if len(cur) > 2:
            rings.append(cur)
    return rings


class Extrait:
    """Accumule les chemins utiles, dédoublonnés par identifiant OSM."""
    def __init__(self, urban=URBAN):
        self.urban = urban    # types landuse urbains retenus (urban_types)
        self.ways = {}        # id → (classe, type, coords, area)
        self.rels = {}        # id → (type, [ids des chemins extérieurs])
        self.members = {}     # id → coords (chemins membres d’une relation utile)
        self.relgeom = {}     # id → (type, [coords]) (Overpass : géométrie fournie)

    def add_osm_xml(self, path):
        nodes, ways, rels = {}, {}, []
        for _, el in ET.iterparse(path, events=('end',)):
            if el.tag == 'node':
                nodes[el.get('id')] = (float(el.get('lon')), float(el.get('lat')))
                el.clear()
            elif el.tag == 'way':
                tags = {t.get('k'): t.get('v') for t in el.findall('tag')}
                ways[el.get('id')] = ([n.get('ref') for n in el.findall('nd')], tags)
                el.clear()
            elif el.tag == 'relation':
                tags = {t.get('k'): t.get('v') for t in el.findall('tag')}
                c = classify(tags, self.urban)
                if c and c[0] == 'urban' and tags.get('type') == 'multipolygon':
                    outer = [m.get('ref') for m in el.findall('member') if m.get('type') == 'way' and m.get('role') in ('outer', '')]
                    rels.append((el.get('id'), c[1], outer))
                el.clear()
        coords = lambda refs: [list(nodes[r]) for r in refs if r in nodes]
        for wid, (refs, tags) in ways.items():
            c = classify(tags, self.urban)
            if c and wid not in self.ways:
                self.ways[wid] = (c[0], c[1], coords(refs), tags.get('area', 'no'))
        for rid, t, outer in rels:
            old = self.rels.get(rid, (t, []))
            self.rels[rid] = (t, sorted(set(old[1]) | set(outer)))
            for wid in outer:
                if wid in ways and wid not in self.members:
                    self.members[wid] = coords(ways[wid][0])

    def add_overpass(self, data):
        for el in data.get('elements', []):
            tags = el.get('tags', {})
            c = classify(tags, self.urban)
            if not c:
                continue
            if el['type'] == 'way':
                g = [[p['lon'], p['lat']] for p in el.get('geometry', [])]
                self.ways[str(el['id'])] = (c[0], c[1], g, tags.get('area', 'no'))
            elif el['type'] == 'relation' and c[0] == 'urban' and tags.get('type') == 'multipolygon':
                parts = [[[p['lon'], p['lat']] for p in m.get('geometry', [])]
                         for m in el.get('members', []) if m.get('type') == 'way' and m.get('role') in ('outer', '')]
                self.relgeom[str(el['id'])] = (c[1], parts)

    def result(self):
        out = {'coast': [], 'breakwater': [], 'urban': []}
        for wid in sorted(self.ways, key=int):
            k, t, c, area = self.ways[wid]
            if len(c) < 2:
                continue
            if k == 'coast':
                out['coast'].append(c)
            elif k == 'pier':
                out['breakwater'].append({'c': c, 't': t, 'area': area})
            else:
                out['urban'].append({'c': c, 't': t})
        rel_parts = {rid: (t, [self.members[w] for w in ws if w in self.members]) for rid, (t, ws) in self.rels.items()}
        rel_parts.update(self.relgeom)
        for rid in sorted(rel_parts, key=int):
            t, parts = rel_parts[rid]
            for ring in join_rings(parts):
                out['urban'].append({'c': ring, 't': t})
        return out


def osm_overpass(cfg, root, man):
    q = overpass_query(cfg)
    rel = 'osm/overpass.json'
    p = os.path.join(root, rel)
    for url in cfg['osm']['overpass']:
        try:
            fetch(url, p, data=urllib.parse.urlencode({'data': q}).encode())
            data = json.load(open(p))
            man.note(rel, url + ' (POST data=' + q + ')')
            return data
        except Exception as e:                       # injoignable, refus, réponse illisible : miroir suivant
            print('Overpass injoignable :', url, '—', type(e).__name__, str(e)[:120])
    return None


def osm_boxes(cfg, root, man, ext):
    bx = cfg['osm']['boxes']
    d = os.path.join(root, 'osm', 'boxes'); os.makedirs(d, exist_ok=True)
    base = cfg['osm']['api']
    todo = []
    nlon = round((bx['east'] - bx['west']) / bx['dlon'])
    nlat = round((bx['north'] - bx['south']) / bx['dlat'])
    for j in range(nlat):
        for i in range(nlon):
            w = round(bx['west'] + i * bx['dlon'], 6); s = round(bx['south'] + j * bx['dlat'], 6)
            todo.append((w, s, round(w + bx['dlon'], 6), round(s + bx['dlat'], 6)))
    done, split, fetched = 0, 0, 0
    while todo:
        w, s, e, n = todo.pop(0)
        rel = f'osm/boxes/{w:.4f}_{s:.4f}_{e:.4f}_{n:.4f}.osm'
        p = os.path.join(root, rel)
        url = f'{base}?bbox={w},{s},{e},{n}'
        complete = False
        if os.path.exists(p):
            with open(p, 'rb') as f:
                f.seek(max(0, os.path.getsize(p) - 64)); complete = b'</osm>' in f.read()
        if not complete:
            time.sleep(1)
            try:
                fetch(url, p); fetched += 1
            except Refus as r:
                if r.code == 400:                     # trop de nœuds : coupée en deux dans sa plus grande dimension
                    split += 1
                    if (e - w) >= (n - s) * 1.5:
                        m = round((w + e) / 2, 6); todo[:0] = [(w, s, m, n), (m, s, e, n)]
                    else:
                        m = round((s + n) / 2, 6); todo[:0] = [(w, s, e, m), (w, m, e, n)]
                    continue
                if r.code in (429, 509):
                    raise SystemExit(f'API OpenStreetMap : limite atteinte ({r}) ; relancer plus tard (les boîtes déjà là sont gardées)')
                raise
        man.note(rel, url)
        ext.add_osm_xml(p)
        done += 1
        if done % 20 == 0:
            print(f'  {done} boîtes lues, {len(todo)} restantes')
    print(f'OSM par l’API principale : {done} boîtes ({split} coupures, {fetched} téléchargées)')
    return {'methode': 'api-boites', 'boites': done, 'coupures': split}


def osm(cfg, root, man):
    os.makedirs(os.path.join(root, 'osm'), exist_ok=True)
    ext = Extrait(urban_types(cfg))
    data = osm_overpass(cfg, root, man)
    if data is not None:
        ext.add_overpass(data); info = {'methode': 'overpass'}
        print('OSM par Overpass :', len(data.get('elements', [])), 'éléments')
    else:
        info = osm_boxes(cfg, root, man, ext)
    out = ext.result()
    json.dump(out, open(os.path.join(root, 'osm', 'osm_extract.json'), 'w'), separators=(',', ':'))
    info.update({k: len(v) for k, v in out.items()})
    print('extrait OSM :', info)
    return info


def main():
    if len(sys.argv) == 3 and sys.argv[1] == '--types-urbains':
        cfg = json.load(open(sys.argv[2], encoding='utf-8'))
        print(json.dumps(list(urban_types(cfg))))
        return
    if len(sys.argv) != 3:
        raise SystemExit('usage : python3 -I tools/prepare_venue.py <config.json> <dossier-entrées>')
    cfg = json.load(open(sys.argv[1], encoding='utf-8'))
    root = sys.argv[2]
    os.makedirs(root, exist_ok=True)
    man = Manifeste(root)
    t0 = time.time()
    info = {'plan_deau': cfg['id'], 'tuiles': tiles(cfg, root, man)}
    bathy(cfg, root, man)
    info['osm'] = osm(cfg, root, man)
    info['prepare'] = now()
    man.save(info)
    print(f'manifeste écrit ({len(man.items)} entrées) en {time.time() - t0:.0f} s')


if __name__ == '__main__':
    main()
