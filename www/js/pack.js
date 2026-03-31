document.addEventListener("DOMContentLoaded", () => {

  const PARTS = {
    "Linkes Auge": [33,34,43,44],
    "Rechtes Auge": [37,38,46,47,48],
    "Nase": [45,46,55,56],
    "Zunge": [64,65,66,74,75],
    "Linkes Ohr": [1,2,3,11,12,13,21,22],
    "Rechtes Ohr": [8,9,10,18,19,20,29,30]
  };

  const PART_NAMES = Object.keys(PARTS);
  const ROWS = 10;
  const COLS = 10;

  /* Konfiguration */
  const FLASH_DURATION_MS = 200;
  const TERM_DISPLAY_MS = 1000;
  const BETWEEN_TERMS_MS = 200;
  const MAX_MISTAKES = 3;
  const FLASH_EXTRA_MS = 40;

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
  let gridRectTs = 0;
  let showToken = { cancelled: false };
  const flashState = { timerId: null };

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

  function now() { return Date.now(); }

  function ensureGridRect(force = false) {
    if (!gridRect || force || (now() - gridRectTs) > 200) {
      gridRect = imageWrap.getBoundingClientRect();
      gridRectTs = now();
    }
    return gridRect;
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function coordsToIndex(clientX, clientY) {
    const rect = ensureGridRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const w = rect.width || 1;
    const h = rect.height || 1;
    const cx = clamp(x, 0, w - 0.0001);
    const cy = clamp(y, 0, h - 0.0001);
    const col = Math.floor((cx / w) * COLS);
    const row = Math.floor((cy / h) * ROWS);
    const idx0 = row * COLS + col;
    return idx0 + 1;
  }

  function flashImage(color = "green", duration = FLASH_DURATION_MS) {
    try {
      const cls = color === "green" ? "flash-green" : "flash-red";
      if (flashState.timerId) {
        clearTimeout(flashState.timerId);
        flashState.timerId = null;
      }
      imageWrap.classList.remove("flash-green", "flash-red");
      imageWrap.offsetWidth;
      imageWrap.classList.add(cls);

      flashState.timerId = setTimeout(() => {
        imageWrap.classList.remove(cls);
        flashState.timerId = null;
      }, duration + FLASH_EXTRA_MS);
    } catch (e) {
      console.error("[pack.js] flashImage error:", e);
    }
  }

  async function showNewTerm(partOrSequence) {
    const myToken = { cancelled: false };
    showToken = myToken;
    try {
      if (Array.isArray(partOrSequence)) {
        for (let i = 0; i < partOrSequence.length; i++) {
          if (showToken.cancelled) break;
          termOverlay.innerHTML = "";
          const box = document.createElement("div");
          box.className = "termBox";
          box.textContent = partOrSequence[i];
          termOverlay.appendChild(box);
          termOverlay.classList.add("show");
          await wait(TERM_DISPLAY_MS);
          termOverlay.classList.remove("show");
          await wait(BETWEEN_TERMS_MS);
        }
        await wait(120);
      } else {
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
      if (Array.isArray(partOrSequence)) {
        setMessage(`Sequenz: ${partOrSequence.join(" → ")}`);
        await wait(TERM_DISPLAY_MS);
      } else {
        setMessage(partOrSequence);
        await wait(TERM_DISPLAY_MS);
      }
    } finally {
      if (showToken === myToken) {
        termOverlay.innerHTML = "";
        termOverlay.classList.remove("show");
      }
    }
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function startNewGame() {
    if (showToken) showToken.cancelled = true;
    sequence = [];
    round = 0;
    mistakes = 0;
    acceptingInput = false;
    updateUI();
    gameOverBoxHide();
    setMessage("Drücke Spiel starten, um zu beginnen.");
    startBtn.disabled = false;
  }

  async function startRound() {
    startBtn.disabled = true;
    const part = randPart();
    sequence.push(part);
    round = sequence.length;
    updateUI();

    setMessage(`Teil ${sequence.length}: Merke dir die Begriffe`);
    await showNewTerm(sequence);

    setMessage("Jetzt tippen in der richtigen Reihenfolge.");
    acceptingInput = true;
    inputIndex = 0;
    ensureGridRect(true);
    startBtn.disabled = false;
  }

  function gameOver() {
    acceptingInput = false;
    setMessage("Spiel vorbei.");
    finalScore.textContent = `Du hast Runde ${round} erreicht.`;

    try {
      const score = round;
      if (typeof checkForHighscore === "function" && checkForHighscore(score, "Ich tippe meinen Päcki")) {
        const name = prompt(`Neuer Highscore für "Ich tippe meinen Päcki"! Runde ${score}. Dein Name:`);
        if (name && typeof addHighscore === "function") {
          addHighscore(name, score, "Ich tippe meinen Tico");
        }
      }
      if (typeof showHighscores === "function") showHighscores();
    } catch (e) {
      console.error("[pack.js] Highscore error:", e);
    }
  }

  function gameOverBoxShow() { gameOverBox.style.display = "block"; }
  function gameOverBoxHide() { gameOverBox.style.display = "none"; }

  function handleTapIndex(tappedIndex) {
    if (!acceptingInput) return;

    const expectedPart = sequence[inputIndex];
    const allowed = PARTS[expectedPart];

    if (!Array.isArray(allowed)) {
      console.warn(`[pack.js] Unknown part "${expectedPart}" at sequence index ${inputIndex}`);
      mistakes++;
      updateUI();
      flashImage("red", FLASH_DURATION_MS);
      setMessage(`Interner Fehler: Unbekannter Begriff "${expectedPart}"`);
      if (mistakes >= MAX_MISTAKES) {
        acceptingInput = false;
        gameOver();
      }
      return;
    }

    if (allowed.includes(tappedIndex)) {
      flashImage("green", FLASH_DURATION_MS);
      inputIndex++;
      if (inputIndex >= sequence.length) {
        acceptingInput = false;
        setMessage("Richtig! Nächste Runde...");
        setTimeout(() => startRound(), 700);
      } else {
        setMessage(`Richtig! Nächster: ${inputIndex+1} von ${sequence.length}`);
      }
    } else {
      mistakes++;
      updateUI();
      flashImage("red", FLASH_DURATION_MS);
      setMessage(`Falsch! Erwartet war: ${expectedPart}`);
      if (mistakes >= MAX_MISTAKES) {
        acceptingInput = false;
        gameOver();
      } else {
        acceptingInput = false;
        setTimeout(() => { acceptingInput = true; }, 400);
      }
    }
  }

  /* Event Listeners */
  packOverlay.addEventListener("pointerdown", (ev) => {
    if (!acceptingInput) return;
    if (ev.pointerType === "touch") ev.preventDefault();
    ensureGridRect(true);
    const idx = coordsToIndex(ev.clientX, ev.clientY);
    handleTapIndex(idx);
  }, { passive: false });

  startBtn.addEventListener("click", async () => {
    if (startBtn.disabled) return;
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

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      ensureGridRect(true);
    }, 150);
  });

  function init() {
    startNewGame();
    window.addEventListener("keydown", (ev) => {
      if (!acceptingInput) return;
      const n = parseInt(ev.key, 10);
      if (!isNaN(n)) {
        handleTapIndex(n);
      }
    });
  }

  init();

  // --- Blinker für packImage2: jetzt umgekehrt — normal zeigt miss.png, kurz wechselt zu miss2.png ---
  (function() {
    const imgEl = document.getElementById("packImage2");
    const baseImg = document.getElementById("packImage");

    if (!imgEl) {
      console.warn("[packImage2Blink] #packImage2 nicht gefunden");
      return;
    }

    try {
      imgEl.style.position = "absolute";
      imgEl.style.inset = "0";
      imgEl.style.width = "100%";
      imgEl.style.height = "100%";
      imgEl.style.objectFit = "cover";
      imgEl.style.zIndex = "5";
      imgEl.style.pointerEvents = "none";

      if (baseImg) {
        baseImg.style.position = "absolute";
        baseImg.style.inset = "0";
        baseImg.style.width = "100%";
        baseImg.style.height = "100%";
        baseImg.style.objectFit = "cover";
        baseImg.style.zIndex = "1";
        baseImg.style.pointerEvents = "none";
      }
      imageWrap.style.position = imageWrap.style.position || "relative";
    } catch (e) {}

    // Umgekehrte Steuerung: Standard = miss.png, kurzer Wechsel = miss2.png
    const SRC_NORMAL = "resources/miss.png";
    const SRC_FLASH  = "resources/miss2.png";

    const currentAttr = imgEl.getAttribute('src') || "";
    let normal = SRC_NORMAL;
    let flash = SRC_FLASH;
    if (currentAttr) {
      if (currentAttr.includes("miss2")) {
        // Wenn HTML aktuell miss2 hat, wir wollen normal miss.png -> setze normal auf miss.png fallback
        normal = currentAttr.replace("miss2", "miss");
        flash = currentAttr;
      } else if (currentAttr.includes("miss.png") || currentAttr.includes("miss")) {
        normal = currentAttr;
        flash = currentAttr.replace("miss.png", "miss2.png");
      }
    }

    const preload = (src) => { try { const i = new Image(); i.src = src; } catch(e){} };
    preload(normal);
    preload(flash);

    try { imgEl.setAttribute("src", normal); } catch(e){ imgEl.src = normal; }

    const FLASH_MS = 300;
    const MIN_INTERVAL_MS = 3000;
    const MAX_INTERVAL_MS = 7000;

    let timerId = null;
    let flashTimeout = null;
    let stopped = false;

    function randInterval() {
      return Math.floor(Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS + 1)) + MIN_INTERVAL_MS;
    }

    function scheduleNext() {
      if (stopped) return;
      timerId = setTimeout(() => {
        if (stopped) return;
        if (flashTimeout) {
          scheduleNext();
          return;
        }
        try {
          imgEl.setAttribute('src', flash);
        } catch (e) {
          try { imgEl.src = flash; } catch(e2){}
        }
        flashTimeout = setTimeout(() => {
          try {
            imgEl.setAttribute('src', normal);
          } catch (e) {
            try { imgEl.src = normal; } catch(e2){}
          }
          flashTimeout = null;
          scheduleNext();
        }, FLASH_MS);
      }, randInterval());
    }

    setTimeout(scheduleNext, 600);

    window.addEventListener("beforeunload", () => {
      stopped = true;
      if (timerId) clearTimeout(timerId);
      if (flashTimeout) clearTimeout(flashTimeout);
    });

    window.__packImage2Blink = {
      stop() {
        stopped = true;
        if (timerId) clearTimeout(timerId);
        if (flashTimeout) clearTimeout(flashTimeout);
        timerId = flashTimeout = null;
        try { imgEl.setAttribute('src', normal); } catch(e){}
      },
      start() {
        if (!stopped) return;
        stopped = false;
        scheduleNext();
      },
      info() {
        return { normal, flash, running: !stopped };
      }
    };
  })();

});