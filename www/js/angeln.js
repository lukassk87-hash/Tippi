const DEBUG_MODE = false;
document.body.classList.toggle('debug-mode', DEBUG_MODE);

const FISCH_DATEN = [
  {
    name: 'Dsungarische Zwergqualle',
    bild: 'resources/fishes/Dsungarische Zwergqualle.jpg'
  },
  {
    name: 'Seehamstern',
    bild: 'resources/fishes/Seehamstern.jpg'
  },
  {
    name: 'Haalmster',
    bild: 'resources/fishes/Haalmster.jpg'
  },
  {
    name: 'Krakster',
    bild: 'resources/fishes/Krakster.jpg'
  },
  {
    name: 'Meerjunghamster',
    bild: 'resources/fishes/Meerjunghamster.jpg'
  },
  {
    name: 'Schildhamster',
    bild: 'resources/fishes/Schildhamster.jpg'
  },
  {
    name: 'Bramster',
    bild: 'resources/fishes/Bramster.jpg'
  },
  {
    name: 'Clownsterfisch',
    bild: 'resources/fishes/Clownsterfisch.jpg'
  },
  {
    name: 'Hamsterhai',
    bild: 'resources/fishes/Hamsterhai.jpg'
  },
  {
    name: 'Hamsterdelphin',
    bild: 'resources/fishes/Harelle.jpg'
  },
  {
    name: 'Kaulhamster',
    bild: 'resources/fishes/Goldhamsterfisch.jpg'
  },
  {
    name: 'Hamspferdchen',
    bild: 'resources/fishes/Hunder.jpg'
  },
  {
    name: 'Hamsteranglerfisch',
    bild: 'resources/fishes/Anglerhamsterfisch.jpg'
  }
];

const KEIN_FANG_BILD = 'resources/fishes/broken.jpg';
const HIGHSCORE_GAME = 'Tico geht angeln';

const startButton = document.getElementById('startButton');
const marker = document.getElementById('marker');
const phaseName = document.getElementById('phaseName');
const phase1 = document.getElementById('phase1');
const phase2 = document.getElementById('phase2');
const phase3 = document.getElementById('phase3');
const finishScreen = document.getElementById('finishScreen');
const koederKreis = document.getElementById('koederKreis');
const koederFlaeche = document.getElementById('koederFlaeche');
const fangButtons = [...document.querySelectorAll('.fang-button')];
const finishFischBild = document.getElementById('finishFischBild');
const finishFischName = document.getElementById('finishFischName');

const statusElement = document.getElementById('status');
const spielerInfoElement = document.getElementById('spielerInfo');

if (statusElement) {
  statusElement.remove();
}

if (spielerInfoElement) {
  spielerInfoElement.remove();
}

const positionText = document.getElementById('position');
const abweichungText = document.getElementById('abweichung');
const scoreText = document.getElementById('score');
const koederGroesseText = document.getElementById('koederGroesse');
const koederAbweichungText = document.getElementById('koederAbweichung');
const koederScoreText = document.getElementById('koederScore');
const fangZeitText = document.getElementById('fangZeit');
const fangScoreText = document.getElementById('fangScore');
const gesamtScoreText = document.getElementById('gesamtScore');
const debugFischName = document.getElementById('debugFischName');
const fischLaengeText = document.getElementById('fischLaenge');
const fischGewichtText = document.getElementById('fischGewicht');
const finishLaenge = document.getElementById('finishLaenge');
const finishGewicht = document.getElementById('finishGewicht');

const OPTIMAL_WURF = 75;
const OPTIMAL_KOEDER = 10;
const MAX_ABWEICHUNG_KOEDER = 5;
const WURF_GESCHWINDIGKEIT = 1.4;
const KOEDER_SCHRUMPFEN = 0.45;
const BLINK_DAUER = 500;
const BLINK_PAUSE = 140;
const SEQUENZ_LAENGE = 6;
const OPTIMAL_FANG_MS = 300;
const FEHLSCHLAG_FANG_MS = 500;

const MAX_PHASE_SCORE = 1000;
const MAX_GESAMTSCORE = MAX_PHASE_SCORE * 3;

const WURF_SCORE_PRO_PROZENT = 30;
const KOEDER_SCORE_PRO_PROZENT = 30;
const FANG_SCORE_PRO_10MS = 25;

const MAX_FISCH_LAENGE = 150;
const MAX_FISCH_GEWICHT = 6000;
const FANG_TASTEN = ['top', 'left', 'center', 'right', 'bottom'];

let spielPhase = 1;
let wurfLaeuft = false;
let koederLaeuft = false;
let fangLaeuft = false;
let position = 0;
let richtung = 1;
let wurfAnimationId = null;
let koederAnimationId = null;
let koederGroesse = 100;
let scorePhase1 = 0;
let scorePhase2 = 0;
let scorePhase3 = 0;
let fangSequenz = [];
let spielerSequenz = [];
let fangStartZeit = 0;
let sequenzWirdGezeigt = false;
let aktuellerFisch = null;
let highscoreSchonGeprueft = false;
let letzterFang = null;

function updatePhaseBodyClass() {
  document.body.classList.toggle('phase-koeder', spielPhase === 2);
}

function markerSetzen() {
  marker.style.left = `${position}%`;
}

function koederSetzen() {
  koederKreis.style.width = `${koederGroesse}%`;
  koederKreis.style.height = `${koederGroesse}%`;
}

function setzeFischBildGroesse(faktor) {
  if (!finishFischBild) {
    return;
  }

  const bildFaktor = Math.min(1, Math.max(0.35, 0.35 + faktor * 0.65));
  finishFischBild.style.transform = `scale(${bildFaktor})`;
  finishFischBild.style.transformOrigin = 'center center';
}

function waehleZufallsFisch() {
  const index = Math.floor(Math.random() * FISCH_DATEN.length);
  aktuellerFisch = FISCH_DATEN[index];
  return aktuellerFisch;
}

function pruefeHighscoreAngeln(fangDaten) {
  if (highscoreSchonGeprueft) {
    return;
  }

  if (!fangDaten || fangDaten.score <= 0) {
    return;
  }

  highscoreSchonGeprueft = true;

  if (typeof checkForHighscore !== 'function' || typeof addHighscore !== 'function') {
    return;
  }

  if (!checkForHighscore(fangDaten.score, HIGHSCORE_GAME)) {
    return;
  }

  const spielerName = window.prompt('Neuer Highscore! Wie heißt du?');

  if (!spielerName || !spielerName.trim()) {
    return;
  }

  addHighscore(
    spielerName.trim(),
    fangDaten.score,
    HIGHSCORE_GAME,
    {
      fishName: fangDaten.fischName,
      fishLength: fangDaten.fischLaenge,
      fishWeight: fangDaten.fischGewicht
    }
  );
}

function setPhase(phase) {
  spielPhase = phase;
  phase1.classList.toggle('versteckt', phase !== 1);
  phase2.classList.toggle('versteckt', phase !== 2);
  phase3.classList.toggle('versteckt', phase !== 3);
  finishScreen.classList.toggle('versteckt', phase !== 4);
  updatePhaseBodyClass();

  if (phase === 1) phaseName.textContent = 'Angel auswerfen';
  if (phase === 2) phaseName.textContent = 'Köder gut beobachten';
  if (phase === 3) phaseName.textContent = 'Schnapp dir den Fisch';
  if (phase === 4) phaseName.textContent = 'Dein Fang';
}

function resetPhase2Anzeige() {
  koederGroesseText.textContent = '-';
  koederAbweichungText.textContent = '-';
  koederScoreText.textContent = '-';
}

function resetPhase3Anzeige() {
  fangZeitText.textContent = '-';
  fangScoreText.textContent = '-';
  gesamtScoreText.textContent = '-';
  debugFischName.textContent = '-';
  fischLaengeText.textContent = '-';
  fischGewichtText.textContent = '-';
  finishFischName.textContent = '-';
  finishLaenge.textContent = '-';
  finishGewicht.textContent = '-';
}

function setFangButtonsAktiv(aktiv) {
  fangButtons.forEach((button) => {
    button.disabled = !aktiv;
    if (!aktiv) {
      button.classList.remove('aktiv');
      button.classList.remove('falsch');
    }
  });
}

function setKoederInteraktiv(aktiv) {
  koederFlaeche.classList.toggle('koeder-inaktiv', !aktiv);
}

function resetAlles() {
  cancelAnimationFrame(wurfAnimationId);
  cancelAnimationFrame(koederAnimationId);
  wurfLaeuft = false;
  koederLaeuft = false;
  fangLaeuft = false;
  sequenzWirdGezeigt = false;
  highscoreSchonGeprueft = false;
  position = 0;
  richtung = 1;
  koederGroesse = 100;
  scorePhase1 = 0;
  scorePhase2 = 0;
  scorePhase3 = 0;
  fangSequenz = [];
  spielerSequenz = [];
  fangStartZeit = 0;
  aktuellerFisch = null;
  letzterFang = null;
  markerSetzen();
  koederSetzen();
  setKoederInteraktiv(false);
  setFangButtonsAktiv(false);
  setPhase(1);
  startButton.disabled = false;
  startButton.textContent = 'Wurf starten';
  positionText.textContent = '-';
  abweichungText.textContent = '-';
  scoreText.textContent = '-';

  if (finishFischBild) {
    finishFischBild.src = FISCH_DATEN[0].bild;
    finishFischBild.alt = 'Gefangener Fisch';
    finishFischBild.style.transform = 'scale(1)';
    finishFischBild.style.transformOrigin = 'center center';
  }

  resetPhase2Anzeige();
  resetPhase3Anzeige();
}

function berechneScore(wert, optimal, scoreProEinheit = WURF_SCORE_PRO_PROZENT) {
  const abweichung = Math.abs(wert - optimal);
  const score = Math.max(0, MAX_PHASE_SCORE - abweichung * scoreProEinheit);

  return {
    wert: Number(wert.toFixed(1)),
    abweichung: Number(abweichung.toFixed(1)),
    score: Math.round(score)
  };
}

function berechneTeilGesamtScore(richtigeSignale) {
  const bisherigerScore = scorePhase1 + scorePhase2;

  if (richtigeSignale === 3) {
    return Math.round(bisherigerScore * 0.1);
  }

  if (richtigeSignale === 4) {
    return Math.round(bisherigerScore * 0.3);
  }

  if (richtigeSignale === 5) {
    return Math.round(bisherigerScore * 0.5);
  }

  return 0;
}

function warte(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function zufallsTaste() {
  const index = Math.floor(Math.random() * FANG_TASTEN.length);
  return FANG_TASTEN[index];
}

function holeFangButton(key) {
  return document.querySelector(`.fang-button[data-key="${key}"]`);
}

function zeigeKeinFang() {
  scorePhase3 = 0;
  fangLaeuft = false;
  letzterFang = null;
  setFangButtonsAktiv(false);

  if (finishFischBild) {
    finishFischBild.src = KEIN_FANG_BILD;
    finishFischBild.alt = 'Kein Fang';
    finishFischBild.style.transform = 'scale(1)';
    finishFischBild.style.transformOrigin = 'center center';
  }

  finishFischName.textContent = 'Kein Fang';
  finishLaenge.textContent = '-';
  finishGewicht.textContent = '-';
  fangZeitText.textContent = '-';
  fangScoreText.textContent = '0';
  gesamtScoreText.textContent = `0 / ${MAX_GESAMTSCORE}`;
  debugFischName.textContent = 'Kein Fang';
  fischLaengeText.textContent = '-';
  fischGewichtText.textContent = '-';

  setPhase(4);
  startButton.disabled = false;
  startButton.textContent = 'Nochmal spielen';
}

function animationWurf() {
  position += WURF_GESCHWINDIGKEIT * richtung;

  if (position >= 100) {
    position = 100;
    richtung = -1;
  }

  if (position <= 0) {
    position = 0;
    richtung = 1;
  }

  markerSetzen();
  wurfAnimationId = requestAnimationFrame(animationWurf);
}

function starteWurf() {
  setPhase(1);
  wurfLaeuft = true;
  positionText.textContent = '-';
  abweichungText.textContent = '-';
  scoreText.textContent = '-';
  resetPhase2Anzeige();
  resetPhase3Anzeige();
  startButton.textContent = 'Wurf stoppen';
  cancelAnimationFrame(wurfAnimationId);
  wurfAnimationId = requestAnimationFrame(animationWurf);
}

function stoppeWurf() {
  wurfLaeuft = false;
  cancelAnimationFrame(wurfAnimationId);

  const ergebnis = berechneScore(position, OPTIMAL_WURF, WURF_SCORE_PRO_PROZENT);
  scorePhase1 = ergebnis.score;
  positionText.textContent = `${ergebnis.wert}%`;
  abweichungText.textContent = `${ergebnis.abweichung}%`;
  scoreText.textContent = `${ergebnis.score}`;
  starteKoederphase();
}

function animationKoeder() {
  koederGroesse -= KOEDER_SCHRUMPFEN;

  if (koederGroesse < 1) {
    koederGroesse = 1;
  }

  koederSetzen();

  if (koederGroesse > 1) {
    koederAnimationId = requestAnimationFrame(animationKoeder);
  } else {
    stoppeKoeder(true);
  }
}

function starteKoederphase() {
  setPhase(2);
  koederGroesse = 100;
  koederSetzen();
  koederLaeuft = true;
  setKoederInteraktiv(true);
  cancelAnimationFrame(koederAnimationId);
  koederAnimationId = requestAnimationFrame(animationKoeder);
}

function stoppeKoeder(automatisch = false) {
  if (!koederLaeuft) {
    return;
  }

  koederLaeuft = false;
  setKoederInteraktiv(false);
  cancelAnimationFrame(koederAnimationId);

  const ergebnis = berechneScore(koederGroesse, OPTIMAL_KOEDER, KOEDER_SCORE_PRO_PROZENT);
  scorePhase2 = ergebnis.score;
  koederGroesseText.textContent = `${ergebnis.wert}%`;
  koederAbweichungText.textContent = `${ergebnis.abweichung}%`;
  koederScoreText.textContent = `${ergebnis.score}`;

  if (ergebnis.abweichung > MAX_ABWEICHUNG_KOEDER) {
    scorePhase2 = 0;
    zeigeKeinFang();
  } else {
    starteFangphase();
  }
}

async function starteFangphase() {
  setPhase(3);
  fangLaeuft = false;
  sequenzWirdGezeigt = true;
  spielerSequenz = [];
  fangSequenz = Array.from({ length: SEQUENZ_LAENGE }, () => zufallsTaste());
  setFangButtonsAktiv(false);
  startButton.disabled = true;
  startButton.textContent = 'Sequenz läuft';

  for (const key of fangSequenz) {
    const button = holeFangButton(key);
    button.classList.add('aktiv');
    await warte(BLINK_DAUER);
    button.classList.remove('aktiv');
    await warte(BLINK_PAUSE);
  }

  sequenzWirdGezeigt = false;
  fangLaeuft = true;
  fangStartZeit = performance.now();
  setFangButtonsAktiv(true);
  startButton.textContent = 'Reihenfolge klicken';
}

function berechneFangScore(durchschnittMs) {
  if (durchschnittMs >= FEHLSCHLAG_FANG_MS) {
    return 0;
  }

  if (durchschnittMs <= OPTIMAL_FANG_MS) {
    return MAX_PHASE_SCORE;
  }

  const abweichung = durchschnittMs - OPTIMAL_FANG_MS;
  const abzug = (abweichung / 10) * FANG_SCORE_PRO_10MS;
  return Math.max(0, Math.round(MAX_PHASE_SCORE - abzug));
}

function zeigeFischErgebnis(overrideGesamtScore = null) {
  const gesamtScore = Math.round(overrideGesamtScore ?? (scorePhase1 + scorePhase2 + scorePhase3));
  const faktor = gesamtScore / MAX_GESAMTSCORE;
  const fischLaengeWert = Number((MAX_FISCH_LAENGE * faktor).toFixed(1));
  const fischGewichtWert = Math.round(MAX_FISCH_GEWICHT * faktor);
  const fischLaenge = `${fischLaengeWert.toFixed(1)} cm`;
  const fischGewicht = `${fischGewichtWert} g`;
  const fisch = waehleZufallsFisch();

  letzterFang = {
    score: gesamtScore,
    fischName: fisch.name,
    fischLaenge,
    fischGewicht,
    fischLaengeWert,
    fischGewichtWert
  };

  gesamtScoreText.textContent = `${gesamtScore} / ${MAX_GESAMTSCORE}`;
  debugFischName.textContent = fisch.name;
  fischLaengeText.textContent = fischLaenge;
  fischGewichtText.textContent = fischGewicht;

  if (finishFischBild) {
    finishFischBild.src = fisch.bild;
    finishFischBild.alt = fisch.name;
  }

  setzeFischBildGroesse(faktor);

  finishFischName.textContent = fisch.name;
  finishLaenge.textContent = fischLaenge;
  finishGewicht.textContent = fischGewicht;

  pruefeHighscoreAngeln(letzterFang);
}

function fangFehlgeschlagen(button = null, richtigeSignale = spielerSequenz.length) {
  if (button) {
    button.classList.add('falsch');
    setTimeout(() => button.classList.remove('falsch'), 400);
  }

  fangLaeuft = false;
  setFangButtonsAktiv(false);
  fangZeitText.textContent = '-';

  const teilGesamtScore = berechneTeilGesamtScore(richtigeSignale);

  if (teilGesamtScore > 0) {
    scorePhase3 = 0;
    fangScoreText.textContent = 'Teilfang';
    zeigeFischErgebnis(teilGesamtScore);
    setPhase(4);
    startButton.disabled = false;
    startButton.textContent = 'Nochmal spielen';
    return;
  }

  zeigeKeinFang();
}

function pruefeFangEingabe(key, button) {
  if (!fangLaeuft || sequenzWirdGezeigt) {
    return;
  }

  const erwarteteTaste = fangSequenz[spielerSequenz.length];

  if (key !== erwarteteTaste) {
    const richtigeSignale = spielerSequenz.length;
    fangFehlgeschlagen(button, richtigeSignale);
    return;
  }

  button.classList.add('aktiv');
  setTimeout(() => button.classList.remove('aktiv'), 160);
  spielerSequenz.push(key);

  if (spielerSequenz.length === fangSequenz.length) {
    const gesamtZeit = performance.now() - fangStartZeit;
    const durchschnittMs = Math.round(gesamtZeit / fangSequenz.length);
    const score = berechneFangScore(durchschnittMs);

    fangZeitText.textContent = `${durchschnittMs} ms`;

    if (durchschnittMs >= FEHLSCHLAG_FANG_MS) {
      fangFehlgeschlagen(null, 0);
      return;
    }

    scorePhase3 = score;
    fangScoreText.textContent = `${score}`;
    fangLaeuft = false;
    setFangButtonsAktiv(false);
    zeigeFischErgebnis();
    setPhase(4);
    startButton.disabled = false;
    startButton.textContent = 'Nochmal spielen';
  }
}

startButton.addEventListener('click', () => {
  if (startButton.textContent === 'Neu starten' || startButton.textContent === 'Nochmal spielen') {
    resetAlles();
    return;
  }

  if (spielPhase === 1 && !wurfLaeuft && !koederLaeuft) {
    starteWurf();
    return;
  }

  if (spielPhase === 1 && wurfLaeuft) {
    stoppeWurf();
  }
});

koederFlaeche.addEventListener('click', () => {
  if (spielPhase === 2 && koederLaeuft) {
    stoppeKoeder(false);
  }
});

fangButtons.forEach((button) => {
  button.addEventListener('click', () => {
    pruefeFangEingabe(button.dataset.key, button);
  });
});

resetAlles(); 
