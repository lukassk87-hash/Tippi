let lives = 3;
let round = 1;
let score = 0;

const enemyImg = "resources/evil.png";
const boomImg = "resources/boom.png";
const hitImg = "resources/hit.png";

const container = document.getElementById("game-container");
const livesBox = document.getElementById("lives");
const roundBox = document.getElementById("round");
const scoreBox = document.getElementById("score");

// Overlays erzeugen
createStartOverlay();
createRoundOverlay();
createGameOverOverlay();

updateUI();

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
    // Runde n → maxGeneration = n + 1
    const maxGeneration = round + 1;

    // Erster Gegner der Runde: Generation 1
    spawnEnemy({
        generation: 1,
        maxGeneration: maxGeneration
    });
}

function checkRoundEnd() {
    const remaining = document.querySelectorAll(".enemy").length;

    if (remaining === 0 && lives > 0) {
        showRoundOverlay();
    }
}

// ------------------------------------------------------------
// Gegner erzeugen
// ------------------------------------------------------------
function spawnEnemy(options = {}) {
    const generation = options.generation || 1;
    const maxGeneration = options.maxGeneration || 2;

    const enemy = document.createElement("img");
    enemy.src = enemyImg;
    enemy.classList.add("enemy");

    enemy.dataset.generation = String(generation);
    enemy.dataset.maxGeneration = String(maxGeneration);

    const maxX = window.innerWidth - 60;
    const maxY = window.innerHeight - 60;

    enemy.style.left = Math.random() * maxX + "px";
    enemy.style.top = Math.random() * maxY + "px";

    container.appendChild(enemy);

    let clicked = false;

    // --------------------------------------------------------
    // Verlangsamte Geschwindigkeit (40 % + ±20 % Variation)
    // --------------------------------------------------------
    let baseSpeedX = (Math.random() * 4 - 2) * 0.4;
    let baseSpeedY = (Math.random() * 4 - 2) * 0.4;

    let variation = 0.8 + Math.random() * 0.4; // 0.8–1.2

    let speedX = baseSpeedX * variation;
    let speedY = baseSpeedY * variation;

    if (Math.abs(speedX) < 0.15) speedX = 0.15 * Math.sign(speedX || 1);
    if (Math.abs(speedY) < 0.15) speedY = 0.15 * Math.sign(speedY || 1);

    moveEnemy(enemy, speedX, speedY);

    // --------------------------------------------------------
    // Klick-Logik
    // --------------------------------------------------------
    enemy.addEventListener("click", () => {
        if (clicked) return;
        clicked = true;

        enemy.src = hitImg;
        score += 100;
        updateUI();

        const gen = Number(enemy.dataset.generation);
        const maxGen = Number(enemy.dataset.maxGeneration);

        setTimeout(() => {
            enemy.remove();

            // --------------------------------------------------------
            // SPLIT-LOGIK nach deiner Regel
            // --------------------------------------------------------
            // Darf dieser Gegner überhaupt noch splitten?
            if (gen < maxGen) {
                let doSplit = true;

                // Ab Generation 3 → nur 50 % Chance
                if (gen >= 3) {
                    doSplit = Math.random() < 0.5;
                }

                if (doSplit) {
                    const childGen = gen + 1;

                    spawnEnemy({
                        generation: childGen,
                        maxGeneration: maxGen
                    });
                    spawnEnemy({
                        generation: childGen,
                        maxGeneration: maxGen
                    });
                }
            }

            checkRoundEnd();
        }, 500);
    });

    // --------------------------------------------------------
    // Zeitlimit für Explosion
    // --------------------------------------------------------
    const timeLimit = 2000 + Math.random() * 3000;

    setTimeout(() => {
        if (clicked) return;

        enemy.src = boomImg;
        flashRed();
        lives--;

        updateUI();

        setTimeout(() => {
            enemy.remove();
            checkRoundEnd();
        }, 500);

        if (lives <= 0) {
            endGame();
        }
    }, timeLimit);
}

// ------------------------------------------------------------
// Gegnerbewegung
// ------------------------------------------------------------
function moveEnemy(enemy, speedX, speedY) {
    function step() {
        if (!document.body.contains(enemy)) return;

        let x = enemy.offsetLeft + speedX;
        let y = enemy.offsetTop + speedY;

        if (x < 0 || x > window.innerWidth - 60) speedX *= -1;
        if (y < 0 || y > window.innerHeight - 60) speedY *= -1;

        enemy.style.left = (enemy.offsetLeft + speedX) + "px";
        enemy.style.top = (enemy.offsetTop + speedY) + "px";

        requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// ------------------------------------------------------------
// Effekte
// ------------------------------------------------------------
function flashRed() {
    container.classList.add("flash-red");
    setTimeout(() => container.classList.remove("flash-red"), 200);
}

// ------------------------------------------------------------
// START OVERLAY
// ------------------------------------------------------------
function createStartOverlay() {
    const overlay = document.createElement("div");
    overlay.id = "start-overlay";
    overlay.className = "overlay";

    overlay.innerHTML = `
        <div>🎮 Boom! – Start</div>
        <button id="start-btn">Spiel starten</button>
    `;

    document.body.appendChild(overlay);

    document.getElementById("start-btn").addEventListener("click", () => {
        overlay.style.display = "none";
        startRound();
    });
}

// ------------------------------------------------------------
// RUNDEN-OVERLAY
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
        overlay.style.display = "none";
        startRound();
    });
}

function showRoundOverlay() {
    const overlay = document.getElementById("round-overlay");
    const text = document.getElementById("round-text");

    text.textContent = `Runde ${round} geschafft!`;
    overlay.style.display = "flex";

    round++;
    updateUI();
}

// ------------------------------------------------------------
// GAME OVER OVERLAY
// ------------------------------------------------------------
function createGameOverOverlay() {
    const overlay = document.createElement("div");
    overlay.id = "gameover-overlay";
    overlay.className = "overlay";
    overlay.style.display = "none";

    overlay.innerHTML = `
        <div>💀 GAME OVER 💀</div>
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

// ------------------------------------------------------------
// SPIELENDE
// ------------------------------------------------------------
function endGame() {
    try {
        if (typeof addHighscore === "function") {
            addHighscore("Spieler", score, "Miss");
        }
    } catch (e) {
        console.error("Highscore Fehler:", e);
    }

    const overlay = document.getElementById("gameover-overlay");
    const finalScore = document.getElementById("final-score");

    finalScore.textContent = "Dein Score: " + score;
    overlay.style.display = "flex";
}