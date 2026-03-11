/* ELEMENTE & KONSTANTEN */
const DEBUG = false;

const IMG_START = "resources/start.jpg";
const IMG_HIT   = "resources/hit.jpg";
const IMG_MISS  = "resources/miss.jpg";

const SAFE_TOP = 75;
const SAFE_BOTTOM = 75;

const MAX_ICON_SIZE = 75;
const MIN_ICON_SIZE = 20;

const info = document.getElementById("info");
const countdown = document.getElementById("countdown");
const nextBtn = document.getElementById("nextRoundBtn");
const hintText = document.getElementById("hintText");
const highscoreBox = document.getElementById("highscoreBox");
const gameOverContainer = document.getElementById("gameOverContainer");
const restartBtn = document.getElementById("restartBtn");

let mistakes = 0;
let round = 1;
let gameActive = false;

let positions = [];
let icons = [];
let hitboxes = [];
let remaining = 0;
let tapEnabled = false;

let ICON_SIZE = MAX_ICON_SIZE;
let HIT_RADIUS = ICON_SIZE * 0.6;

let mistakesEnabled = false;

/* Timing / duplicate guards */
let lastTapTime = 0;
let ignoreClicksDuringStart = false;

/* STARTBUTTON */
nextBtn.addEventListener("click", (ev) => {
  ev.stopPropagation();
  ev.preventDefault();

  hintText.style.display = "none";
  nextBtn.style.display = "none";

  gameActive = true;
  mistakesEnabled = false;
  tapEnabled = false;

  ignoreClicksDuringStart = true;
  spawnIcons();
});

/* ICON PLATZIERUNG */
function tryPlaceIcons(count) {
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;

  const newPositions = [];

  for (let i = 0; i < count; i++) {
    let attempts = 0;
    let placed = false;

    while (!placed && attempts < 200) {
      attempts++;

      const cx = Math.random() * (screenW - ICON_SIZE) + ICON_SIZE / 2;
      const cy = Math.random() * (screenH - SAFE_TOP - SAFE_BOTTOM - ICON_SIZE)
                 + SAFE_TOP + ICON_SIZE / 2;

      let ok = true;

      for (const p of newPositions) {
        const dx = cx - p.x;
        const dy = cy - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < HIT_RADIUS * 2) {
          ok = false;
          break;
        }
      }

      if (ok) {
        newPositions.push({ x: cx, y: cy, hit: false });
        placed = true;
      }
    }

    if (!placed) return null;
  }

  return newPositions;
}

function spawnIcons() {
  let count = round;

  ICON_SIZE = MAX_ICON_SIZE;
  HIT_RADIUS = ICON_SIZE * 0.6;

  let placed = null;

  while (!placed) {
    placed = tryPlaceIcons(count);

    if (!placed) {
      ICON_SIZE *= 0.9;
      ICON_SIZE = Math.max(ICON_SIZE, MIN_ICON_SIZE);
      HIT_RADIUS = ICON_SIZE * 0.6;

      if (ICON_SIZE === MIN_ICON_SIZE) {
        placed = tryPlaceIcons(count);
        if (!placed) {
          alert("Zu viele Icons – Runde kann nicht dargestellt werden.");
          return;
        }
      }
    }
  }

  positions = placed;
  console.log("spawnIcons: positions.length =", positions.length);

  icons = [];
  hitboxes = [];
  tapEnabled = false;
  remaining = round;

  for (const pos of positions) {
    const icon = document.createElement("img");
    icon.src = IMG_START;
    icon.className = "icon";
    icon.style.left = (pos.x - ICON_SIZE / 2) + "px";
    icon.style.top = (pos.y - ICON_SIZE / 2) + "px";
    icon.style.width = ICON_SIZE + "px";
    icon.style.height = ICON_SIZE + "px";
    icon.style.display = "none";
    document.body.appendChild(icon);
    icons.push(icon);

    const hb = document.createElement("div");
    hb.className = "hitbox-debug";
    hb.style.width = (HIT_RADIUS * 2) + "px";
    hb.style.height = (HIT_RADIUS * 2) + "px";
    hb.style.left = (pos.x - HIT_RADIUS) + "px";
    hb.style.top = (pos.y - HIT_RADIUS) + "px";
    if (DEBUG) hb.style.display = "block";
    document.body.appendChild(hb);
    hitboxes.push(hb);
  }

  console.log("spawnIcons: icons.length =", icons.length, "hitboxes.length =", hitboxes.length);
  showIconsWithCountdown();
}

/* COUNTDOWN */
async function showIconsWithCountdown() {
  countdown.style.display = "block";

  let timeLeft = 3;
  countdown.textContent = timeLeft;

  const interval = setInterval(() => {
    timeLeft--;
    countdown.textContent = timeLeft;
    if (timeLeft <= 0) clearInterval(interval);
  }, 1000);

  icons.forEach(icon => icon.style.display = "block");

  await wait(3000);

  icons.forEach(icon => icon.style.display = "none");

  countdown.style.display = "none";

  tapEnabled = true;
  mistakesEnabled = true;
  ignoreClicksDuringStart = false;

  console.log("showIconsWithCountdown: taps enabled, icons in DOM =", document.querySelectorAll(".icon").length);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* TAP LOGIK */
function handleTap(event) {
  if (!gameActive || !tapEnabled) return;

  if (!positions || positions.length === 0) {
    console.log("handleTap: ignored because no positions yet");
    return;
  }

  const now = Date.now();
  if (now - lastTapTime < 350) {
    console.log("handleTap: duplicate event ignored", now - lastTapTime);
    return;
  }
  lastTapTime = now;

  const clickedButton = event.target.closest("button, a");
  if (clickedButton) {
    if (clickedButton.id === "restartBtn") return;
    return;
  }

  const tapX = event.clientX;
  const tapY = event.clientY;

  let hitSomething = false;

  for (let i = 0; i < positions.length; i++) {
    if (positions[i].hit) continue;

    const dx = tapX - positions[i].x;
    const dy = tapY - positions[i].y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < HIT_RADIUS) {
      positions[i].hit = true;
      hitSomething = true;
      remaining--;

      const icon = icons[i];
      icon.src = IMG_HIT;
      icon.style.display = "block";

      setTimeout(() => {
        icon.style.display = "none";
        icon.src = IMG_START;
      }, 300);

      if (remaining === 0) {
        tapEnabled = false;
        mistakesEnabled = false;

        setTimeout(() => {
          round++;
          info.textContent = `Fehler: ${mistakes} / 3 – Runde ${round}`;

          clearIcons();
          nextBtn.textContent = "Nächste Runde";
          nextBtn.style.display = "block";
          hintText.style.display = "block";
        }, 500);
      }

      break;
    }
  }

  if (!hitSomething) {
    if (!mistakesEnabled) return;

    mistakes++;
    console.log("mistake incremented:", mistakes, "remaining positions:", positions.length, "tapEnabled:", tapEnabled);
    info.textContent = `Fehler: ${mistakes} / 3 – Runde ${round}`;
    flashRed();

    if (mistakes >= 3) {
      gameActive = false;
      mistakesEnabled = false;
      tapEnabled = false;

      const score = round - 1;

      if (typeof checkForHighscore === "function" && checkForHighscore(score)) {
        const name = prompt(`Neuer Highscore! Runde ${score}. Dein Name:`);
        if (name && typeof addHighscore === "function") addHighscore(name, score);
      }

      if (typeof showHighscores === "function") showHighscores();

      gameOverContainer.style.display = "flex";
    }
  }
}

/* FLASH RED */
function flashRed() {
  document.body.style.backgroundColor = "#550000";

  for (let i = 0; i < positions.length; i++) {
    if (!positions[i].hit) {
      icons[i].src = IMG_MISS;
      icons[i].style.display = "block";
    }
  }
setTimeout(() => {
    document.body.style.backgroundColor = "var(--bg-gray)";
    for (let i = 0; i < positions.length; i++) {
      if (!positions[i].hit) {
        icons[i].style.display = "none";
        icons[i].src = IMG_START;
      }
    }
  }, 500);
}

/* GAME OVER / NEUSTART */
function clearIcons() {
  icons.forEach(el => { try { el.remove(); } catch (e) {} });
  hitboxes.forEach(el => { try { el.remove(); } catch (e) {} });
  icons = [];
  hitboxes = [];
  positions = [];
}

function restartGame() {
  mistakes = 0;
  round = 1;
  gameActive = false;
  mistakesEnabled = false;
  tapEnabled = false;

  info.textContent = "Fehler: 0 / 3 – Runde 1";
  clearIcons();
  highscoreBox.innerHTML = "";
  gameOverContainer.style.display = "none";

  location.href = "index.html";
}

restartBtn.addEventListener("click", (ev) => {
  ev.stopPropagation();
  ev.preventDefault();
  restartGame();
});

/* GLOBAL INPUT HANDLER */
document.addEventListener("pointerdown", (e) => {
  if (ignoreClicksDuringStart) return;
  handleTap(e);
});