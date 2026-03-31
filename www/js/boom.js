let lives = 3;
let round = 1;
let score = 0;

const ENEMY_SIZE = 75;
const ENEMY_RADIUS = ENEMY_SIZE / 2;
const GAME_NAME = "Tico wird sauer";

const enemies = new Set();
let animationFrameId = null;

// ------------------------------------------------------------
// Game-State Guards
// ------------------------------------------------------------
let gameOverTriggered = false;
let highscoreDialogOpen = false;
let highscoreSaved = false;

// ------------------------------------------------------------
// VIDEO GLOBAL EINMAL LADEN
// ------------------------------------------------------------
const videoTemplate = document.createElement("video");
videoTemplate.src = "resources/evil.mp4";
videoTemplate.autoplay = true;
videoTemplate.loop = true;
videoTemplate.muted = true;
videoTemplate.playsInline = true;
videoTemplate.preload = "auto";

// ------------------------------------------------------------
// DOM
// ------------------------------------------------------------
const container = document.getElementById("game-container");
const livesBox = document.getElementById("lives");
const roundBox = document.getElementById("round");
const scoreBox = document.getElementById("score");

// ------------------------------------------------------------
// Hilfsfunktionen
// ------------------------------------------------------------
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function rand(min, max) {
    return Math.random() * (max - min) + min;
}

function getCssNumber(name) {
    const styles = getComputedStyle(document.documentElement);
    return parseFloat(styles.getPropertyValue(name)) || 0;
}

function getPlayBounds() {
    const top = getCssNumber("--play-top");
    const right = getCssNumber("--play-right");
    const bottom = getCssNumber("--play-bottom");
    const left = getCssNumber("--play-left");

    return {
        minX: left,
        minY: top,
        maxX: Math.max(left, window.innerWidth - right - ENEMY_SIZE),
        maxY: Math.max(top, window.innerHeight - bottom - ENEMY_SIZE)
    };
}

function setEnemyState(enemy, x, y, vx, vy) {
    enemy.dataset.x = String(x);
    enemy.dataset.y = String(y);
    enemy.dataset.vx = String(vx);
    enemy.dataset.vy = String(vy);
    enemy.style.left = x + "px";
    enemy.style.top = y + "px";
}

function getEnemyState(enemy) {
    return {
        x: parseFloat(enemy.dataset.x) || 0,
        y: parseFloat(enemy.dataset.y) || 0,
        vx: parseFloat(enemy.dataset.vx) || 0,
        vy: parseFloat(enemy.dataset.vy) || 0
    };
}

function removeEnemyFromActiveSet(enemy) {
    enemies.delete(enemy);
    enemy.dataset.dead = "1";
}

function keepEnemiesInsideBounds() {
    const bounds = getPlayBounds();

    enemies.forEach(enemy => {
        const s = getEnemyState(enemy);
        const x = clamp(s.x, bounds.minX, bounds.maxX);
        const y = clamp(s.y, bounds.minY, bounds.maxY);
        setEnemyState(enemy, x, y, s.vx, s.vy);
    });
}

function stopGameLoop() {
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

function cleanupRemainingEnemies() {
    enemies.forEach(enemy => {
        enemy.dataset.dead = "1";
        enemy.remove();
    });

    enemies.clear();
    stopGameLoop();
}

function shouldAskForHighscore(sc) {
    if (typeof isHighscore === "function") {
        try {
            return Boolean(isHighscore(sc, GAME_NAME));
        } catch (err) {
            console.warn("isHighscore() fehlgeschlagen, fallback aktiv:", err);
        }
    }

    if (typeof getHighscores === "function") {
        try {
            const entries = getHighscores(GAME_NAME) || [];
            if (entries.length < 10) return true;
            const lowest = Math.min(...entries.map(entry => Number(entry.score) || 0));
            return sc > lowest;
        } catch (err) {
            console.warn("getHighscores() fehlgeschlagen, fallback aktiv:", err);
        }
    }

    return sc > 0;
}

// ------------------------------------------------------------
// Highscore-Eingabedialog
// ------------------------------------------------------------
function createHighscoreInput() {
    const box = document.createElement("div");
    box.id = "hs-input";
    box.className = "overlay";
    box.style.display = "none";

    box.innerHTML = `
        <div>🎉 Neuer Highscore!</div>
        <div>Dein Score: <b id="hs-score"></b></div>
        <input id="hs-name" placeholder="Dein Name" maxlength="20">
        <button id="hs-save">Speichern</button>
    `;

    document.body.appendChild(box);

    const nameInput = document.getElementById("hs-name");
    const saveButton = document.getElementById("hs-save");

    saveButton.addEventListener("click", () => {
        if (highscoreSaved) return;

        highscoreSaved = true;
        saveButton.disabled = true;

        const name = nameInput.value.trim() || "Spieler";
        const sc = Number(document.getElementById("hs-score").textContent) || 0;

        if (typeof addHighscore === "function") {
            try {
                addHighscore(name, sc, GAME_NAME);
            } catch (err) {
                console.error("Highscore konnte nicht gespeichert werden:", err);
            }
        }

        box.style.display = "none";
        highscoreDialogOpen = false;
        showGameOverMenu(sc);
    });
}

createHighscoreInput();

function showHighscoreInput(sc) {
    if (highscoreDialogOpen || highscoreSaved) return;

    highscoreDialogOpen = true;

    const box = document.getElementById("hs-input");
    const scoreNode = document.getElementById("hs-score");
    const nameInput = document.getElementById("hs-name");
    const saveButton = document.getElementById("hs-save");

    scoreNode.textContent = String(sc);
    nameInput.value = "";
    saveButton.disabled = false;

    box.style.display = "flex";
    nameInput.focus();
}

// ------------------------------------------------------------
// Game Over Menü
// ------------------------------------------------------------
function createGameOverMenu() {
    const overlay = document.createElement("div");
    overlay.id = "gameover-menu";
    overlay.className = "overlay";
    overlay.style.display = "none";

    overlay.innerHTML = `
        <div>GAME OVER</div>
        <div id="final-score"></div>
        <button id="restart-btn">🔄 Neustart</button>
        <button id="menu-btn">🏠 Hauptmenü</button>
    `;

    document.body.appendChild(overlay);

    document.getElementById("restart-btn").addEventListener("click", () => {
        location.reload();
    });

    document.getElementById("menu-btn").addEventListener("click", () => {
        window.location.href = "index.html";
    });
}

createGameOverMenu();

function showGameOverMenu(sc) {
    const overlay = document.getElementById("gameover-menu");
    const finalScore = document.getElementById("final-score");

    finalScore.textContent = "Dein Score: " + sc;
    overlay.style.display = "flex";
}

// ------------------------------------------------------------
// UI
// ------------------------------------------------------------
function updateUI() {
    livesBox.textContent = "❤️ Leben: " + lives;
    roundBox.textContent = "🔄 Runde: " + round;
    scoreBox.textContent = "⭐ Punkte: " + score;
}

// ------------------------------------------------------------
// Rundenlogik
// ------------------------------------------------------------
function startRound() {
    if (gameOverTriggered) return;

    const maxGeneration = round + 1;

    spawnEnemy({
        generation: 1,
        maxGeneration: maxGeneration
    });
}

function checkRoundEnd() {
    if (gameOverTriggered) return;

    const remaining = document.querySelectorAll(".enemy").length;

    if (remaining === 0 && lives > 0) {
        showRoundOverlay();
    }
}

// ------------------------------------------------------------
// Gegner erzeugen
// ------------------------------------------------------------
function spawnEnemy(options = {}) {
    if (gameOverTriggered) return;

    const generation = options.generation || 1;
    const maxGeneration = options.maxGeneration || 2;
    const bounds = getPlayBounds();

    const enemy = document.createElement("div");
    enemy.classList.add("enemy", "spawn");
    enemy.dataset.generation = String(generation);
    enemy.dataset.maxGeneration = String(maxGeneration);
    enemy.dataset.dead = "0";

    const vid = videoTemplate.cloneNode(true);
    enemy.appendChild(vid);

    let x = rand(bounds.minX, bounds.maxX);
    let y = rand(bounds.minY, bounds.maxY);

    let tries = 0;
    while (tries < 20 && isOverlappingExisting(x, y)) {
        x = rand(bounds.minX, bounds.maxX);
        y = rand(bounds.minY, bounds.maxY);
        tries++;
    }

    let vx = (Math.random() * 4 - 2) * 0.4;
    let vy = (Math.random() * 4 - 2) * 0.4;

    if (Math.abs(vx) < 0.15) vx = vx >= 0 ? 0.15 : -0.15;
    if (Math.abs(vy) < 0.15) vy = vy >= 0 ? 0.15 : -0.15;

    setEnemyState(enemy, x, y, vx, vy);

    container.appendChild(enemy);
    enemies.add(enemy);
    startGameLoop();

    let clicked = false;

    enemy.addEventListener("click", () => {
        if (gameOverTriggered) return;
        if (clicked || enemy.dataset.dead === "1") return;

        clicked = true;
        removeEnemyFromActiveSet(enemy);

        score += 100;
        updateUI();

        if (enemy.contains(vid)) enemy.removeChild(vid);

        const img = document.createElement("img");
        img.src = "resources/hit.png";
        enemy.appendChild(img);

        const gen = Number(enemy.dataset.generation);
        const maxGen = Number(enemy.dataset.maxGeneration);

        setTimeout(() => {
            enemy.remove();

            if (gameOverTriggered) return;

            if (gen < maxGen) {
                let splitChance = 1.0;

                if (gen >= 3) {
                    if (gen === 3) splitChance = 0.5;
                    else if (gen === 4) splitChance = 0.4;
                    else if (gen === 5) splitChance = 0.3;
                    else if (gen >= 6) splitChance = 0.15;
                }

                if (Math.random() < splitChance) {
                    const childGen = gen + 1;
                    spawnEnemy({ generation: childGen, maxGeneration: maxGen });
                    spawnEnemy({ generation: childGen, maxGeneration: maxGen });
                }
            }

            checkRoundEnd();
        }, 500);
    });

    const timeLimit = 3000 + Math.random() * 3000;

    setTimeout(() => {
        if (gameOverTriggered) return;
        if (clicked || enemy.dataset.dead === "1") return;

        removeEnemyFromActiveSet(enemy);

        if (enemy.contains(vid)) enemy.removeChild(vid);

        const img = document.createElement("img");
        img.src = "resources/boom.png";
        enemy.appendChild(img);

        flashRed();

        if (lives > 0) {
            lives--;
            updateUI();
        }

        setTimeout(() => {
            enemy.remove();
            checkRoundEnd();
        }, 600);

        if (lives <= 0) {
            endGame();
        }
    }, timeLimit);
}

function isOverlappingExisting(x, y) {
    for (const enemy of enemies) {
        const s = getEnemyState(enemy);
        const dx = (x + ENEMY_RADIUS) - (s.x + ENEMY_RADIUS);
        const dy = (y + ENEMY_RADIUS) - (s.y + ENEMY_RADIUS);
        const dist = Math.hypot(dx, dy);

        if (dist < ENEMY_SIZE) {
            return true;
        }
    }

    return false;
}

// ------------------------------------------------------------
// Bewegung + Wandabprallen
// ------------------------------------------------------------
function updateEnemyPositions() {
    const bounds = getPlayBounds();

    enemies.forEach(enemy => {
        const s = getEnemyState(enemy);

        let x = s.x + s.vx;
        let y = s.y + s.vy;
        let vx = s.vx;
        let vy = s.vy;

        if (x <= bounds.minX) {
            x = bounds.minX;
            vx = Math.abs(vx);
        } else if (x >= bounds.maxX) {
            x = bounds.maxX;
            vx = -Math.abs(vx);
        }

        if (y <= bounds.minY) {
            y = bounds.minY;
            vy = Math.abs(vy);
        } else if (y >= bounds.maxY) {
            y = bounds.maxY;
            vy = -Math.abs(vy);
        }

        setEnemyState(enemy, x, y, vx, vy);
    });
}

// ------------------------------------------------------------
// Gegner prallen aneinander ab
// ------------------------------------------------------------
function handleEnemyCollisions() {
    const active = [...enemies];
    const bounds = getPlayBounds();

    for (let i = 0; i < active.length; i++) {
        for (let j = i + 1; j < active.length; j++) {
            const a = active[i];
            const b = active[j];

            const sa = getEnemyState(a);
            const sb = getEnemyState(b);

            const acx = sa.x + ENEMY_RADIUS;
            const acy = sa.y + ENEMY_RADIUS;
            const bcx = sb.x + ENEMY_RADIUS;
            const bcy = sb.y + ENEMY_RADIUS;

            let dx = bcx - acx;
            let dy = bcy - acy;
            let dist = Math.hypot(dx, dy);

            if (dist === 0) {
                dx = (Math.random() - 0.5) * 0.01;
                dy = (Math.random() - 0.5) * 0.01;
                dist = Math.hypot(dx, dy);
            }

            const minDist = ENEMY_SIZE;

            if (dist < minDist) {
                const nx = dx / dist;
                const ny = dy / dist;
                const overlap = minDist - dist;

                let ax = sa.x - nx * (overlap / 2);
                let ay = sa.y - ny * (overlap / 2);
                let bx = sb.x + nx * (overlap / 2);
                let by = sb.y + ny * (overlap / 2);

                ax = clamp(ax, bounds.minX, bounds.maxX);
                ay = clamp(ay, bounds.minY, bounds.maxY);
                bx = clamp(bx, bounds.minX, bounds.maxX);
                by = clamp(by, bounds.minY, bounds.maxY);

                let avx = sa.vx;
                let avy = sa.vy;
                let bvx = sb.vx;
                let bvy = sb.vy;

                const relativeVelocity = (avx - bvx) * nx + (avy - bvy) * ny;

                if (relativeVelocity > 0) {
                    avx -= relativeVelocity * nx;
                    avy -= relativeVelocity * ny;
                    bvx += relativeVelocity * nx;
                    bvy += relativeVelocity * ny;
                } else {
                    avx -= nx * 0.05;
                    avy -= ny * 0.05;
                    bvx += nx * 0.05;
                    bvy += ny * 0.05;
                }

                setEnemyState(a, ax, ay, avx, avy);
                setEnemyState(b, bx, by, bvx, bvy);
            }
        }
    }
}

// ------------------------------------------------------------
// Zentraler Game Loop
// ------------------------------------------------------------
function gameLoop() {
    if (gameOverTriggered || enemies.size === 0) {
        animationFrameId = null;
        return;
    }

    updateEnemyPositions();
    handleEnemyCollisions();

    animationFrameId = requestAnimationFrame(gameLoop);
}

function startGameLoop() {
    if (gameOverTriggered) return;
    if (animationFrameId !== null) return;
    animationFrameId = requestAnimationFrame(gameLoop);
}

// ------------------------------------------------------------
// Effekte
// ------------------------------------------------------------
function flashRed() {
    container.classList.remove("flash-red");
    void container.offsetWidth;
    container.classList.add("flash-red");

    setTimeout(() => {
        container.classList.remove("flash-red");
    }, 220);
}

// ------------------------------------------------------------
// Start Overlay
// ------------------------------------------------------------
function createStartOverlay() {
    const overlay = document.createElement("div");
    overlay.id = "start-overlay";
    overlay.className = "overlay";

    overlay.innerHTML = `
        <div>🐹 Tico wird sauer 😡! – Start</div>
        <button id="start-btn">Spiel starten</button>
    `;

    document.body.appendChild(overlay);

    document.getElementById("start-btn").addEventListener("click", () => {
        overlay.style.display = "none";
        startRound();
    });
}

createStartOverlay();

// ------------------------------------------------------------
// Runden Overlay
// ------------------------------------------------------------
function createRoundOverlay() {
    const overlay = document.createElement("div");
    overlay.id = "round-overlay";
    overlay.className = "overlay";
    overlay.style.display = "none";

    overlay.innerHTML = `
        <div id="round-text"></div>
        <button id="next-round-btn">Nächste Runde</button>
    `;

    document.body.appendChild(overlay);

    document.getElementById("next-round-btn").addEventListener("click", () => {
        if (gameOverTriggered) return;
        overlay.style.display = "none";
        startRound();
    });
}

createRoundOverlay();

function showRoundOverlay() {
    if (gameOverTriggered) return;

    const overlay = document.getElementById("round-overlay");
    const text = document.getElementById("round-text");

    text.textContent = `Runde ${round} geschafft!`;
    overlay.style.display = "flex";

    round++;
    updateUI();
}

// ------------------------------------------------------------
// Spielende
// ------------------------------------------------------------
function endGame() {
    if (gameOverTriggered) return;

    gameOverTriggered = true;
    stopGameLoop();
    cleanupRemainingEnemies();

    const sc = score;

    if (shouldAskForHighscore(sc)) {
        showHighscoreInput(sc);
    } else {
        showGameOverMenu(sc);
    }
}

// ------------------------------------------------------------
// Resize
// ------------------------------------------------------------
window.addEventListener("resize", keepEnemiesInsideBounds);

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------
updateUI();