// Guide de réglage J80 : synthèse des guides de voileries publiés (sources et dates ci-dessous).
// Attention aux jauges : North Sails et Ullman utilisent une Loos modèle B, Quantum une Loos PT2 (échelles différentes).

import { ORC_TARGETS as O } from './polar-orc.js';

const tws = [6, 8, 10, 12, 14, 16, 20];
const row = (label, arr, f = (v) => v) => `<tr><td>${label}</td>${arr.map((v) => `<td>${f(v)}</td>`).join('')}</tr>`;
const deg = (v) => `${v.toFixed(1)}°`, kn = (v) => v.toFixed(2);

const ORC_TABLE = `<div class="card"><h3>Cibles officielles ORC <small>J-80 OD 2023</small></h3><div class="tablewrap"><table class="t">
<tr><th>TWS</th>${tws.map((t) => `<th>${t}</th>`).join('')}</tr>
${row('Angle de près', O.beatAngle, deg)}${row('VMG près', O.beatVmg, kn)}
${row('Vit. près', O.beatVmg.map((v, i) => v / Math.cos((O.beatAngle[i] * Math.PI) / 180)), kn)}
${[52, 60, 75, 90, 110, 120, 135, 150].map((a) => row(`${a}°`, O[a], kn)).join('')}
${row('VMG portant', O.runVmg, kn)}${row('Angle d’empannage', O.runAngle, deg)}
${row('Vit. portant', O.runVmg.map((v, i) => v / Math.cos(((180 - O.runAngle[i]) * Math.PI) / 180)), kn)}
</table></div><div class="small muted">Source : certificat ORC One Design 2023 « J-80 OD » (VPP 2023 1.02, GPH 662,5 ; certificat type de la classe, équipage standard 263–350 kg). Vitesses au près/portant optimaux recalculées (VMG ÷ cos). Les certificats 2019 et 2020 diffèrent de moins de 0,15 nd. <a href="https://data.orc.org/public/od/2023/j80.od.html" target="_blank" rel="noopener">data.orc.org</a></div></div>`;

const SHROUDS = `<div class="card"><h3>Haubans selon le vent <small>tension Loos</small></h3>
<p class="small"><b>North Sails</b> (réglages Max Skelley, jauge Loos B — base 6–10 nd) :</p>
<div class="tablewrap"><table class="t"><tr><th>Vent (nd)</th><th>0–5</th><th>6–10</th><th>11–15</th><th>16–20</th><th>20+</th></tr>
<tr><td>Haubans (uppers)</td><td>27</td><td><b>28</b></td><td>30</td><td>32</td><td>34</td></tr>
<tr><td>Intermédiaires (D2)</td><td>5</td><td><b>12</b></td><td>15</td><td>22</td><td>24</td></tr>
<tr><td>Bas-haubans (D1)</td><td>mous</td><td><b>5</b></td><td>15</td><td>22</td><td>26</td></tr></table></div>
<p class="small"><b>Ullman Sails</b> (v2, 2012, Loos B — base 10–15 nd : 30 / 8 / 15) :</p>
<div class="tablewrap"><table class="t"><tr><th>Vent (nd)</th><th>0–5</th><th>6–10</th><th>11–15</th><th>16–20</th><th>20+</th></tr>
<tr><td>Haubans</td><td>27</td><td>28</td><td><b>30</b></td><td>32</td><td>34</td></tr>
<tr><td>Bas-haubans</td><td>5</td><td>12</td><td><b>15</b></td><td>22</td><td>26</td></tr>
<tr><td>Intermédiaires</td><td>5</td><td>5</td><td><b>8</b></td><td>17</td><td>24</td></tr></table></div>
<p class="small"><b>Quantum</b> (K. Klingler, 2011, jauge <b>Loos PT2</b> — autre échelle ; base 10–12 nd = haubans serrés à la main + 10 tours) :</p>
<div class="tablewrap"><table class="t"><tr><th>Vent</th><th>Haubans</th><th>Inter.</th><th>Bas</th><th>Tours H/I/B vs base</th><th>Précintre</th></tr>
<tr><td>5</td><td>12</td><td>6</td><td>5</td><td>−4 / −2 / −2</td><td>2,5"</td></tr>
<tr><td>6–8</td><td>17</td><td>9</td><td>12</td><td>−2 / −1 / −1</td><td>2,5"</td></tr>
<tr><td><b>10–12</b></td><td><b>24</b></td><td><b>10</b></td><td><b>16</b></td><td>0 / 0 / 0</td><td>2"</td></tr>
<tr><td>14–16</td><td>28</td><td>11</td><td>22</td><td>+2 / +1 / +1</td><td>2"</td></tr>
<tr><td>18–20</td><td>30</td><td>12</td><td>25</td><td>+4 / +2 / +2</td><td>2"</td></tr>
<tr><td>22–24</td><td>32</td><td>14</td><td>27</td><td>+6 / +3 / +3</td><td>2"</td></tr>
<tr><td>27+</td><td>34</td><td>16</td><td>30</td><td>+8 / +4 / +4</td><td>2"</td></tr></table></div>
<ul class="tips small">
<li>Partir du ponton avec la base, ajuster sur l’eau ; mesurer la longueur des ridoirs au pied à coulisse pour revenir à la base (North).</li>
<li>Sous 10 nd : ½–¾" (13–19 mm) de flèche latérale régulière sous le vent est plus rapide (North). Au-delà de 10 nd : bas et intermédiaires sous le vent juste tendus (« snug »), plus que tendus au-delà de 15 nd.</li>
<li>Quantum : jamais de haubans sous le vent mous au-delà de 10 nd ; sous 5 nd, bas et intermédiaires mous acceptables.</li>
<li>Régler les ridoirs du pataras en même temps que les haubans (North).</li>
<li>J/Boats (guide propriétaire 2000) en livres : haubans ≈ 800 lb, bas 600 lb, intermédiaires 300 lb.</li>
</ul></div>`;

const MAST = `<div class="card"><h3>Mât : pied, quête, précintre</h3><div class="tablewrap"><table class="t">
<tr><th></th><th>North (récent)</th><th>Ullman</th><th>Quantum</th></tr>
<tr><td>Pied de mât (arrière du pied → cloison)</td><td>197 mm (7,75")</td><td>210 mm (8,25")</td><td>241 mm (9,5") US/FR · 260 mm coque chinoise</td></tr>
<tr><td>Quête (ruban sur drisse de GV)</td><td>11,35 m (37'2¾")</td><td>11,39 m (37'4½")</td><td>11,39 m (37'4,5")</td></tr>
<tr><td>Précintre</td><td>89–95 mm (95 eau plate, 89 mer formée)</td><td>89–95 mm</td><td>≈ 50 mm (64 mm de 5 à 8 nd)</td></tr>
<tr><td>Centrage du mât</td><td>repères à 2,92 m de l’étrave</td><td>2,92 m</td><td>2,90 m + poids sur drisse de foc</td></tr></table></div>
<ul class="tips small">
<li><b>Mesure de quête North</b> : pataras complètement choqué, haubans à la base ; ruban sur la drisse de GV réglé pour lire exactement 9,144 m (30') au haut de la bande noire de bôme, puis amené au centre de la découpe de barre, à l’arrière.</li>
<li><b>Ullman / Quantum</b> : ruban depuis le bas de la bande noire en tête de mât, enroulé autour du tableau arrière sous la barre ; lecture au premier contact.</li>
<li><b>Contrôle propre aux J80 français</b> (Quantum) : drisse de foc marquée au haut de la bande noire de bôme, amenée sur l’étai — 1,78 m (5'10") de ce repère au haut de l’étrave (tour de l’enrouleur compris).</li>
<li>Étai : 10 020 mm de la tête à la fixation sous l’enrouleur (North 2004) ; 32'9½" pin à pin (J/Boats).</li>
<li>Pataras : poulies ≈ 30 cm (12") sous le haut de la patte d’oie, pataras largué (North, J/Boats).</li>
<li>Brise &gt; 20 nd dans la mer : avancer le pied de mât de ≈ 13 mm (North).</li>
<li>Précintre mesuré drisse de GV tendue au vit-de-mulet, flèche maxi quelques pieds au-dessus des barres basses.</li>
</ul></div>`;

const SAILS = `<div class="card"><h3>Réglage des voiles au près <small>North Sails 2004 (A. Lewander)</small></h3><div class="tablewrap"><table class="t">
<tr><th>Vent (nd)</th><th>0–6</th><th>8–14</th><th>16–20</th><th>22+</th></tr>
<tr><td>Bordure GV</td><td>4 cm de la bande</td><td>2–0 cm</td><td>0</td><td>0</td></tr>
<tr><td>Bôme / écoute</td><td>40–20 cm sous le vent</td><td>0–40 cm sous le vent</td><td>40–60 cm</td><td>60–70 cm</td></tr>
<tr><td>Chariot</td><td>50 cm au vent</td><td>20 cm au vent</td><td>0–15 cm sous le vent</td><td>15–30 cm sous le vent</td></tr>
<tr><td>Cunningham</td><td>libre</td><td>petits plis</td><td>sans plis</td><td>dur</td></tr>
<tr><td>Hale-bas</td><td>libre</td><td>juste tendu</td><td>tendu</td><td>tendu</td></tr>
<tr><td>Drisse de foc</td><td>petits plis</td><td>sans plis</td><td>très dure</td><td>très dure</td></tr>
<tr><td>Penons de foc</td><td colspan="2">écoute maxi sans décrocher les penons, barber : faseye régulièrement</td><td colspan="2">faseye d’abord en haut</td></tr></table></div>
<ul class="tips small">
<li><b>Point de tir du foc</b> : départ un trou en arrière des cadènes ; un trou (≈ deux par vent fort) plus en arrière dans la brise.</li>
<li><b>Écoute de foc</b> : échelle collée sous la barre de flèche ; repère = penon de chute au-dessus de la latte haute filant droit vers l’arrière (vu par la fenêtre de GV). Aucun guide ne chiffre la distance à la barre de flèche.</li>
<li>0–2 nd : chariot 30 cm au vent, bôme 20 cm sous le vent, bordure 4–5 cm, tout le reste libre.</li>
<li>8 nd : chariot ≈ 20 cm au vent, bôme dans l’axe, bordure 2 cm ; penon de tête décroché ≤ 20 % du temps.</li>
<li>10–12 nd : bordure à la bande noire, cunningham sans la plupart des plis. 12–14 nd : pleine puissance selon le poids, plus de pataras, chariot dans l’axe.</li>
<li>16 nd : cunningham à fond. &gt; 20 nd : bordure, cunningham et hale-bas à fond, chariot 15 cm sous le vent.</li>
</ul></div>
<div class="card"><h3>Portant et spi <small>North Sails 2004</small></h3><ul class="tips small">
<li>Après la bouée au vent : pataras et cunningham largués, bordure choquée de 5–8 cm, hale-bas réglé pour que la latte haute soit parallèle à la bôme.</li>
<li>Grand largue dans la brise : choquer le hale-bas.</li>
<li>En règle générale ≈ 135° du vent réel en médium, empannages de 90°. Dans la brise : presque vent arrière, amure du spi choquée de 30–45 cm, gîte au vent ; papillon possible au-delà de 13–15 nd.</li>
<li>Angles optimaux ORC : 145–150° de 6 à 14 nd, 142–144° à 16–20 nd (on « monte » pour planer).</li>
</ul></div>`;

const SOURCES = `<div class="card"><h3>Sources et écarts entre guides</h3><ul class="tips small">
<li><a href="https://www.northsails.com/sailing/en/resources/j80-tuning-guide" target="_blank" rel="noopener">North Sails — J/80 Tuning Guide</a> (réglages Max Skelley, en ligne, non daté).</li>
<li><a href="https://yachting.web.cern.ch/documentation/keelboats/files/j80/North_Sails_Tuning_Guide.pdf" target="_blank" rel="noopener">North Sails — Tuning Guide J/80, 2e version (A. Lewander, 2004)</a>.</li>
<li><a href="https://www.j80na.com/wp-content/uploads/2025/02/Ullman-Sails-Tuning-Guide.pdf" target="_blank" rel="noopener">Ullman Sails — J/80 Tuning Guide v2 (2012)</a>.</li>
<li><a href="https://www.j80na.com/wp-content/uploads/2025/02/Quantum-Tuning-Guide.pdf" target="_blank" rel="noopener">Quantum — J-80 Tuning Guide & Worksheet (2011)</a> et <a href="https://www.quantumsails.com/en/sails/one-design/documents/j80/quantum-j80-mast-rake-test" target="_blank" rel="noopener">fiche quête</a>.</li>
<li><a href="https://yachting.web.cern.ch/documentation/keelboats/files/j80/J80_User_Guide.pdf" target="_blank" rel="noopener">J/Boats — J/80 Owner Guide (2000)</a>.</li>
<li><b>Écarts</b> : quête 11,35 m (North) contre 11,39 m (Ullman, Quantum) avec des points de mesure différents ; pied de mât de 197 à 241 mm ; précintre 90–95 mm (North, Ullman) contre 50 mm (Quantum) ; les jauges Loos B et PT2 ne sont pas interchangeables. Suivre <b>un seul guide</b>, celui de la voilerie de vos voiles.</li>
<li>Non trouvé en ligne : guides Incidences, All Purpose, Doyle, Classe J80 France ; position chiffrée de l’équipage. À compléter avec votre voilerie.</li>
</ul></div>`;

export const TUNING = { html: ORC_TABLE + MAST + SHROUDS + SAILS + SOURCES };

// Rappel chiffré (North Sails, Loos B) pour le briefing
export function shroudsFor(tws) {
  const r = [[5, '27 / 5 / mous'], [10, '28 / 12 / 5 (base)'], [15, '30 / 15 / 15'], [20, '32 / 22 / 22'], [99, '34 / 24 / 26']];
  return r.find((x) => tws <= x[0])[1];
}
