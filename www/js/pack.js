document.addEventListener("DOMContentLoaded", () => {

 const PARTS = {
    "Linkes Auge": [33,34,43,44],
    "Rechtes Auge": [37,38,46,47,48],
    "Nase": [45,46,55,56],
    "Zunge": [64,65,66,74,75,76],
    "Linkes Ohr": [12,13,14,22,23],
    "Rechtes Ohr": [17,18,19,28,29,39]
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
  const BETWEEN_TERMS_MS = 200;  // Pause zwischen einzelnen Begriffen

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

  /* Term Overlay: zeigt den neuen Begriff oder die komplette Sequenz nacheinander */
  async function showNewTerm(partOrSequence) {
    // termOverlay wird für jeden Begriff einzeln verwendet; keine neuen HTML-Elemente dauerhaft hinzufügen
    try {
      // Wenn ein Array übergeben wird: Begriffe nacheinander einzeln anzeigen
      if (Array.isArray(partOrSequence)) {
        for (let i = 0; i < partOrSequence.length; i++) {
          termOverlay.innerHTML = "";
          const box = document.createElement("div");
          box.className = "termBox";
          box.textContent = partOrSequence[i];
          termOverlay.appendChild(box);

          termOverlay.classList.add("show");
          await wait(TERM_DISPLAY_MS);
          termOverlay.classList.remove("show");

          // kurz warten bevor der nächste Begriff erscheint
          await wait(BETWEEN_TERMS_MS);
        }
        // kleine Pause nach der kompletten Sequenz
        await wait(120);
      } else {
        // Einzelnen Begriff anzeigen (Abwärtskompatibel)
        termOverlay.innerHTML = "";
        const box = document.createElement("div");
        box.className = "termBox";
        box.textContent = partOrSequence;
        termOverlay.appendChild(box);

        termOverlay.classList.add("show");
        await wait(TERM_DISPLAY_MS);
        termOverlay.classList.remove("show");
        await wait(120);
      }
    } catch (e) {
      console.error("[pack.js] showNewTerm error:", e);
      // Fallback: kurz Text im packMessage anzeigen, falls Overlay fehlschlägt
      if (Array.isArray(partOrSequence)) {
        setMessage(`Sequenz: ${partOrSequence.join(" → ")}`);
        await wait(TERM_DISPLAY_MS);
      } else {
        setMessage(partOrSequence);
        await wait(TERM_DISPLAY_MS);
      }
    } finally {
      // Overlay leeren, damit keine Reste bleiben
      termOverlay.innerHTML = "";
      termOverlay.classList.remove("show");
    }
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

    // Hinweis anzeigen und die komplette Sequenz nacheinander im vorhandenen Overlay darstellen
    setMessage(`Teil ${sequence.length}: Merke dir die Begriffe`);
    // zeigt jetzt jeden Begriff einzeln nacheinander (z.B. Runde 2: "Zunge" [ausblenden] "Auge")
    await showNewTerm(sequence);

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
      // Prompt must be triggered from user gesture context; ensure we call prompt synchronously
      if (typeof checkForHighscore === "function" && checkForHighscore(score, "Ich tippe meinen Tico")) {
        const name = prompt(`Neuer Highscore für "Ich tippe meinen Tico"! Runde ${score}. Dein Name:`);
        if (name && typeof addHighscore === "function") {
          addHighscore(name, score, "Ich tippe meinen Tico");
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
        // Call gameOver synchronously so prompt is allowed by browser (avoid setTimeout here)
        acceptingInput = false;
        gameOver();
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