let lives = 3;
let round = 1;
let score = 0;

// ------------------------------------------------------------
// VIDEO GLOBAL EINMAL LADEN (WICHTIG!)
// ------------------------------------------------------------
const videoTemplate = document.createElement("video");
videoTemplate.src = "resources/evil.mp4";
videoTemplate.autoplay = true;
videoTemplate.loop = true;
videoTemplate.muted = true;
videoTemplate.playsInline = true;

// ------------------------------------------------------------
// DOM ELEMENTE
// ------------------------------------------------------------
const container = document.getElementById("game-container");
const livesBox = document.getElementById("lives");
const roundBox = document.getElementById("round");
const scoreBox = document.getElementById("score");

// ------------------------------------------------------------
// Highscore-Eingabedialog erzeugen
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

    document.getElementById("hs-save").addEventListener("click", () => {
        const name = document.getElementById("hs-name").value.trim() || "Spieler";
        const sc = Number(document.getElementById("hs-score").textContent);

        addHighscore(name, sc, "Tico wird sauer");

        box.style.display = "none";
        showGameOverMenu(sc);
    });
}

createHighscoreInput();

// ------------------------------------------------------------
// Game Over Menü erzeugen
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

// ------------------------------------------------------------
// Game Over Menü anzeigen
// ------------------------------------------------------------
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
    const maxGeneration = round + 1;

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
// Gegner erzeugen – VIDEO + PNG (hit/boom)
// ------------------------------------------------------------
function spawnEnemy(options = {}) {
    const generation = options.generation || 1;
    const maxGeneration = options.maxGeneration || 2;

    const enemy = document.createElement("div");
    enemy.classList.add("enemy");

    // Enemy unsichtbar starten, um Platzhalter-Frame zu vermeiden
    enemy.style.display = "none";

    // Video aus globalem Template klonen
    const vid = videoTemplate.cloneNode(true);
    enemy.appendChild(vid);

    enemy.dataset.generation = String(generation);
    enemy.dataset.maxGeneration = String(maxGeneration);

    const maxX = window.innerWidth - 75;
    const maxY = window.innerHeight - 75;

    enemy.style.left = Math.random() * maxX + "px";
    enemy.style.top = Math.random() * maxY + "px";

    container.appendChild(enemy);

    // Nach kurzer Zeit sichtbar machen (verhindert grauen Platzhalter)
    setTimeout(() => {
        enemy.style.display = "block";
    }, 50);

    let clicked = false;

    // Geschwindigkeit
    let speedX = (Math.random() * 4 - 2) * 0.4;
    let speedY = (Math.random() * 4 - 2) * 0.4;

    if (Math.abs(speedX) < 0.15) speedX = speedX >= 0 ? 0.15 : -0.15;
    if (Math.abs(speedY) < 0.15) speedY = speedY >= 0 ? 0.15 : -0.15;

    enemy.dataset.speedX = speedX;
    enemy.dataset.speedY = speedY;

    moveEnemy(enemy);

    // --------------------------------------------------------
    // KLICK
    // --------------------------------------------------------
    enemy.addEventListener("click", () => {
        if (clicked) return;
        clicked = true;

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

            // Split-Logik
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

    // --------------------------------------------------------
    // Explosion (wenn nicht geklickt)
    // --------------------------------------------------------
    const timeLimit = 2000 + Math.random() * 3000;

    setTimeout(() => {
        if (clicked) return;

        if (enemy.contains(vid)) enemy.removeChild(vid);

        const img = document.createElement("img");
        img.src = "resources/boom.png";
        enemy.appendChild(img);

        flashRed();
        lives--;
        updateUI();

        setTimeout(() => {
            enemy.remove();
            checkRoundEnd();
        }, 600);

        if (lives <= 0) endGame();
    }, timeLimit);
}
    // --------------------------------------------------------
    // Explosion (wenn nicht geklickt)
    // --------------------------------------------------------
    const timeLimit = 2000 + Math.random() * 3000;

    setTimeout(() => {
        if (clicked) return;

        if (enemy.contains(vid)) enemy.removeChild(vid);

        const img = document.createElement("img");
        img.src = "resources/boom.png";
        enemy.appendChild(img);

        flashRed();
        lives--;
        updateUI();

        setTimeout(() => {
            enemy.remove();
            checkRoundEnd();
        }, 600);

        if (lives <= 0) endGame();
    }, timeLimit);
}

// ------------------------------------------------------------
// Gegnerbewegung
// ------------------------------------------------------------
function moveEnemy(enemy) {
    function step() {
        if (!document.body.contains(enemy)) return;

        let speedX = parseFloat(enemy.dataset.speedX);
        let speedY = parseFloat(enemy.dataset.speedY);

        let x = parseFloat(enemy.style.left);
        let y = parseFloat(enemy.style.top);

        x += speedX;
        y += speedY;

        if (x < 0 || x > window.innerWidth - 75) speedX *= -1;
        if (y < 0 || y > window.innerHeight - 75) speedY *= -1;

        enemy.dataset.speedX = speedX;
        enemy.dataset.speedY = speedY;

        enemy.style.left = x + "px";
        enemy.style.top = y + "px";

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

createRoundOverlay();

function showRoundOverlay() {
    const overlay = document.getElementById("round-overlay");
    const text = document.getElementById("round-text");

    text.textContent = `Runde ${round} geschafft!`;
    overlay.style.display = "flex";

    round++;
    updateUI();
}

// ------------------------------------------------------------
// SPIELENDE
// ------------------------------------------------------------
function endGame() {
    const hsBox = document.getElementById("hs-input");
    document.getElementById("hs-score").textContent = score;
    hsBox.style.display = "flex";
}
