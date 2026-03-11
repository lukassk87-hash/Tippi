/* pack.js (Flash 200ms, Term 1000ms, Highscore-Integration)
   - TERM_DISPLAY_MS = 1000 (Begriff 1s)
   - FLASH_DURATION_MS = 200 (kurzer, dicker Flash)
   - Bei Game Over: Highscore prüfen, Name abfragen, speichern (game = "Ich tippe meinen Päcki")
*/

document.addEventListener("DOMContentLoaded", () => {

  const PARTS = {
    "Linkes Auge": [34,44],
    "Rechtes Auge": [36,37,46,47],
    "Nase": [45,46,54,55,56],
    "Zunge": [65,66,75,76,85,86],
    "Linkes Ohr": [43,53,63],
    "Rechtes Ohr": [48,58]
  };

  const PART_NAMES = Object.keys(PARTS);
  const ROWS = 10;
  const COLS = 10;

  /* UI Elemente */
  const startBtn = document.getElementById("startPackBtn");
  const backBtn = document.getElementById("backToMenuBtn");
  const roundNumEl = document.getElementById("roundNum");
  const mistakesEl = document.getElementById("mistakes");
  const packOverlay = document.getElementById("packOverlay");
  const imageWrap = document.getElementById("imageWrapPack");
  const packMessage = document.getElementById("packMessage");
  const gameOverBox = document.getElementById("packGameOver");
  const finalScore = document.getElementById("finalScore");
  const packRestart = document.getElementById("packRestart");
  const termOverlay = document.getElementById("termOverlay");

  /* Spielzustand */
  let sequence = [];
  let inputIndex = 0;
  let round = 0;
  let mistakes = 0;
  let acceptingInput = false;
  let gridRect = null;

  /* Flash- / Term-Konfiguration */
  const FLASH_DURATION_MS = 200; // kurzer Flash
  const TERM_DISPLAY_MS = 1000;  // Begriff-Anzeige 1000 ms

  function setMessage(txt) {
    packMessage.textContent = txt;
  }

  function updateUI() {
    roundNumEl.textContent = round;
    mistakesEl.textContent = mistakes;
  }

  function randPart() {
    const i = Math.floor(Math.random() * PART_NAMES.length);
    return PART_NAMES[i];
  }

  function coordsToIndex(clientX, clientY) {
    if (!gridRect) gridRect = imageWrap.getBoundingClientRect();

    const x = clientX - gridRect.left;
    const y = clientY - gridRect.top;

    const w = gridRect.width;
    const h = gridRect.height;
    const cx = Math.max(0, Math.min(w, x));
    const cy = Math.max(0, Math.min(h, y));

    const col = Math.floor((cx / w) * COLS);
    const row = Math.floor((cy / h) * ROWS);

    const idx0 = row * COLS + col;
    return idx0 + 1;
  }

  /* Robuster Flash */
  const flashState = { timerId: null };

  function flashImage(color = "green", duration = FLASH_DURATION_MS) {
    try {
      const cls = color === "green" ? "flash-green" : "flash-red";
      if (flashState.timerId) {
        clearTimeout(flashState.timerId);
        flashState.timerId = null;
      }
      imageWrap.classList.remove("flash-green", "flash-red");
      // force reflow
      imageWrap.offsetWidth;
      imageWrap.classList.add(cls);

      flashState.timerId = setTimeout(() => {
        imageWrap.classList.remove(cls);
        flashState.timerId = null;
      }, duration + 40);
    } catch (e) {
      console.error("[pack.js] flashImage error:", e);
    }
  }

  /* Term Overlay: zeigt nur den neuen Begriff TERM_DISPLAY_MS */
  async function showNewTerm(partName) {
    termOverlay.innerHTML = "";
    const box = document.createElement("div");
    box.className = "termBox";
    box.textContent = partName;
    termOverlay.appendChild(box);

    termOverlay.classList.add("show");
    await wait(TERM_DISPLAY_MS);
    termOverlay.classList.remove("show");
    await wait(120);
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function startNewGame() {
    sequence = [];
    round = 0;
    mistakes = 0;
    acceptingInput = false;
    updateUI();
    gameOverBoxHide();
    setMessage("Drücke Spiel starten, um zu beginnen.");
  }

  async function startRound() {
    const part = randPart();
    sequence.push(part);
    round = sequence.length;
    updateUI();

    const newPart = sequence[sequence.length - 1];
    setMessage(`Teil ${sequence.length}: Merke dir den Begriff`);
    await showNewTerm(newPart);

    setMessage("Jetzt tippen in der richtigen Reihenfolge.");
    acceptingInput = true;
    inputIndex = 0;
    gridRect = imageWrap.getBoundingClientRect();
  }

  function gameOver() {
    acceptingInput = false;
    setMessage("Spiel vorbei.");
    finalScore.textContent = `Du hast Runde ${round} erreicht.`;
    gameOverBoxShow();

    // Highscore prüfen und ggf. speichern
    try {
      const score = round;
      if (typeof checkForHighscore === "function" && checkForHighscore(score, "Ich tippe meinen Päcki")) {
        const name = prompt(`Neuer Highscore für "Ich tippe meinen Päcki"! Runde ${score}. Dein Name:`);
        if (name && typeof addHighscore === "function") {
          addHighscore(name, score, "Ich tippe meinen Päcki");
        }
      }
      if (typeof showHighscores === "function") showHighscores();
    } catch (e) {
      console.error("[pack.js] Highscore error:", e);
    }
  }

  function gameOverBoxShow() {
    gameOverBox.style.display = "block";
  }

  function gameOverBoxHide() {
    gameOverBox.style.display = "none";
  }

  function handleTapIndex(tappedIndex) {
    if (!acceptingInput) return;

    const expectedPart = sequence[inputIndex];
    const allowed = PARTS[expectedPart];

    if (allowed.includes(tappedIndex)) {
      flashImage("green", FLASH_DURATION_MS);
      inputIndex++;
      if (inputIndex >= sequence.length) {
        acceptingInput = false;
        setMessage("Richtig! Nächste Runde...");
        setTimeout(() => {
          startRound();
        }, 700);
      } else {
        setMessage(`Richtig! Nächster: ${inputIndex+1} von ${sequence.length}`);
      }
    } else {
      mistakes++;
      updateUI();
      flashImage("red", FLASH_DURATION_MS);
      setMessage(`Falsch! Erwartet war: ${expectedPart}`);
      if (mistakes >= 3) {
        acceptingInput = false;
        setTimeout(() => gameOver(), 400);
      } else {
        acceptingInput = true;
      }
    }
  }

  /* Event Listeners */
  packOverlay.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    if (!acceptingInput) return;
    gridRect = imageWrap.getBoundingClientRect();
    const idx = coordsToIndex(ev.clientX, ev.clientY);
    handleTapIndex(idx);
  });

  startBtn.addEventListener("click", async () => {
    sequence = [];
    mistakes = 0;
    round = 0;
    updateUI();
    setMessage("Starte Spiel...");
    await wait(220);
    startRound();
  });

  backBtn.addEventListener("click", () => {
    location.href = "index.html";
  });

  packRestart.addEventListener("click", () => {
    gameOverBoxHide();
    startNewGame();
  });

  /* Init */
  function init() {
    startNewGame();
    window.addEventListener("resize", () => { gridRect = imageWrap.getBoundingClientRect(); });
  }

  init();

});