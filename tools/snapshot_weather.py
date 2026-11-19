"""Télécharge un instantané des prévisions (mêmes requêtes que js/weather.js) dans data/wx-snapshot.json.
Sert de secours quand l'app n'a pas accès au réseau (première ouverture hors ligne, page hébergée sans accès externe).
Usage : python3 -I tools/snapshot_weather.py [--venue brest]
  sans option : Toulon, requêtes de la v42 à l'identique (data/wx-snapshot.json)
  --venue brest : zone A du GPEN (centre et grille de js/venue-brest.js), cell_selection=sea, aucune requête marine
                  (« marine »: null), sortie data/brest.wx-snapshot.json. En cas de refus d'Open-Meteo : aucun fichier écrit."""
import json, subprocess, time, sys, os
CENTER = (43.085, 5.958)
GRID = [(lat, lon) for lat in (43.045, 43.065, 43.085, 43.100) for lon in (5.885, 5.920, 5.955, 5.990, 6.030, 6.075)]
MODELS = 'meteofrance_arome_france_hd,meteofrance_arome_france,meteofrance_arpege_europe,ecmwf_ifs025,icon_eu,gfs_seamless'
VARS = 'wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,cloud_cover,precipitation,pressure_msl,weather_code'
C = 'wind_speed_unit=kn&timezone=Europe%2FParis&forecast_days=3'
OM = 'https://api.open-meteo.com/v1/forecast'
MARINE = 'https://marine-api.open-meteo.com/v1/marine?latitude=43.06&longitude=5.96&hourly=wave_height,wave_direction,wave_period,wind_wave_height,swell_wave_height,swell_wave_direction,ocean_current_velocity,ocean_current_direction,sea_surface_temperature&timezone=Europe%2FParis&forecast_days=3'
OUT = 'wx-snapshot.json'
if '--venue' in sys.argv:
    v = sys.argv[sys.argv.index('--venue') + 1]
    if v != 'brest':
        raise SystemExit('plan d’eau inconnu : ' + v)
    # js/venue-brest.js (weather) : centre de la zone A, 4 latitudes × 5 longitudes, points pris sur la mer
    CENTER = (48.298, -4.3605)
    GRID = [(lat, lon) for lat in (48.275, 48.295, 48.315, 48.335) for lon in (-4.46, -4.42, -4.38, -4.34, -4.30)]
    C += '&cell_selection=sea'
    MARINE = None
    OUT = 'brest.wx-snapshot.json'
def get(u):
    for k in range(4):
        r = subprocess.run(['curl', '-sS', '-m', '60', u], capture_output=True)
        if r.returncode == 0 and r.stdout[:1] in (b'{', b'['):
            d = json.loads(r.stdout)
            if not (isinstance(d, dict) and d.get('error')): return d
        time.sleep(2 ** k)
    raise SystemExit('échec ' + u + ' : ' + r.stdout[:200].decode('utf-8', 'replace'))
multi = get(f'{OM}?latitude={CENTER[0]}&longitude={CENTER[1]}&hourly={VARS}&models={MODELS}&{C}')
grid = get(f"{OM}?latitude={','.join(str(a) for a, _ in GRID)}&longitude={','.join(str(b) for _, b in GRID)}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&models=meteofrance_arome_france_hd&{C}")
marine = get(MARINE) if MARINE else None
out = os.path.join(os.path.dirname(__file__), '..', 'data', OUT)
json.dump({'fetched': int(time.time() * 1000), 'snapshot': True, 'multi': multi, 'grid': grid, 'marine': marine}, open(out, 'w'), separators=(',', ':'))
print('ok', os.path.getsize(out))
