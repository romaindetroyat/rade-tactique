# J80 — polaires et réglages (sources)

## Polaire
Certificat ORC One Design 2023 « J-80 OD » (VPP 2023 1.02, GPH 662,5) — https://data.orc.org/public/od/2023/j80.od.html
(certificats 2019 : https://data.orc.org/public/od/2019/j80.od.pdf, 2020 : https://data.orc.org/public/od/2020/j80.od.pdf — écarts < 0,15 nd).

| TWS | 6 | 8 | 10 | 12 | 14 | 16 | 20 |
|---|---|---|---|---|---|---|---|
| Angle de près | 42.6° | 40.5° | 38.2° | 37.8° | 37.8° | 37.8° | 39.0° |
| VMG près | 3.31 | 4.00 | 4.41 | 4.54 | 4.60 | 4.62 | 4.57 |
| 52° | 5.01 | 5.83 | 6.22 | 6.36 | 6.43 | 6.48 | 6.49 |
| 60° | 5.25 | 6.01 | 6.37 | 6.55 | 6.64 | 6.70 | 6.75 |
| 75° | 5.39 | 6.12 | 6.51 | 6.78 | 6.96 | 7.08 | 7.21 |
| 90° | 5.48 | 6.23 | 6.52 | 6.88 | 7.18 | 7.43 | 7.76 |
| 110° | 5.61 | 6.44 | 6.90 | 7.21 | 7.50 | 7.78 | 8.33 |
| 120° | 5.49 | 6.40 | 6.96 | 7.44 | 7.88 | 8.28 | 9.17 |
| 135° | 4.97 | 6.04 | 6.71 | 7.31 | 7.96 | 8.77 | 11.05 |
| 150° | 4.24 | 5.32 | 6.11 | 6.66 | 7.11 | 7.67 | 10.17 |
| VMG portant | 3.67 | 4.60 | 5.29 | 5.77 | 6.16 | 6.64 | 8.81 |
| Angle d'empannage | 144.8° | 148.7° | 149.6° | 149.6° | 147.3° | 144.4° | 142.2° |

`data/j80.pol` : ces valeurs, angles intermédiaires interpolés, 4 et 25 nd extrapolés (`tools/build_polar.mjs`).
Aucun fichier polaire brut (North, Quantum, J/Boats, Expedition) n'a été trouvé publié.

## Guides de réglage
- North Sails J/80 Tuning Guide (Max Skelley, en ligne) — https://www.northsails.com/sailing/en/resources/j80-tuning-guide
- North Sails Tuning Guide J/80, 2e version (A. Lewander, 2004) — https://yachting.web.cern.ch/documentation/keelboats/files/j80/North_Sails_Tuning_Guide.pdf
- Ullman Sails J/80 Tuning Guide v2 (2012) — https://www.j80na.com/wp-content/uploads/2025/02/Ullman-Sails-Tuning-Guide.pdf
- Quantum J-80 Tuning Guide & Worksheet (2011) — https://www.j80na.com/wp-content/uploads/2025/02/Quantum-Tuning-Guide.pdf
- J/Boats J/80 Owner Guide (2000) — https://yachting.web.cern.ch/documentation/keelboats/files/j80/J80_User_Guide.pdf

Tableaux détaillés (pied de mât, quête, précintre, haubans par force de vent, réglages de voiles) : onglet J80 de l'application (`js/tuning.js`).
Non trouvés en ligne : guides Incidences, All Purpose, Doyle, Classe J80 France ; placement chiffré de l'équipage.
