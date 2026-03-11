// grid.js — erzeugt ein 10x10 Overlay über dem Bild und macht Quadranten klickbar
document.addEventListener("DOMContentLoaded", () => {
  const ROWS = 10;
  const COLS = 10;

  const overlay = document.getElementById("overlay");
  const imageWrap = document.getElementById("imageWrap");
  const baseImage = document.getElementById("baseImage");
  const toggleBordersBtn = document.getElementById("toggleBorders");
  const clearSelectionBtn = document.getElementById("clearSelection");
  const exportSelectionBtn = document.getElementById("exportSelection");
  const selectionList = document.getElementById("selectionList");

  let showBorders = true;
  let selected = new Set();

  // create cells dynamically
  function createGrid() {
    overlay.innerHTML = "";
    // use percentage sizes so grid is responsive with the image
    const wPct = 100 / COLS;
    const hPct = 100 / ROWS;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const idx = r * COLS + c; // 0..99
        const cell = document.createElement("div");
        cell.className = "grid-cell";
        cell.dataset.index = idx;
        cell.dataset.row = r;
        cell.dataset.col = c;
        // position in percent
        cell.style.left = (c * wPct) + "%";
        cell.style.top = (r * hPct) + "%";
        cell.style.width = wPct + "%";
        cell.style.height = hPct + "%";

        // optional small label for debugging
        const label = document.createElement("div");
        label.className = "label";
        label.textContent = idx + 1; // 1..100
        // comment out next line if you don't want labels visible
        // cell.appendChild(label);

        // click handler
        cell.addEventListener("click", (ev) => {
          ev.stopPropagation();
          toggleCellSelection(idx, cell);
        });

        overlay.appendChild(cell);
      }
    }
    updateBorderVisibility();
    updateSelectionUI();
  }

  function toggleCellSelection(idx, cellEl) {
    if (selected.has(idx)) {
      selected.delete(idx);
      cellEl.classList.remove("selected");
    } else {
      selected.add(idx);
      cellEl.classList.add("selected");
    }
    updateSelectionUI();
  }

  function clearSelection() {
    selected.clear();
    document.querySelectorAll(".grid-cell.selected").forEach(el => el.classList.remove("selected"));
    updateSelectionUI();
  }

  function updateSelectionUI() {
    if (selected.size === 0) {
      selectionList.textContent = "Keine Quadranten ausgewählt.";
    } else {
      // show indices as 1-based, sorted
      const arr = Array.from(selected).sort((a,b)=>a-b).map(i => i+1);
      selectionList.textContent = `Ausgewählt (${arr.length}): ${arr.join(", ")}`;
    }
  }

  function updateBorderVisibility() {
    document.querySelectorAll(".grid-cell").forEach(el => {
      el.style.border = showBorders ? getComputedStyle(document.documentElement).getPropertyValue('--overlay-border') : "none";
    });
  }

  // export selection to clipboard (comma separated indices 1..100)
  async function exportSelection() {
    const arr = Array.from(selected).sort((a,b)=>a-b).map(i => i+1);
    const text = arr.join(",");
    try {
      await navigator.clipboard.writeText(text);
      exportSelectionBtn.textContent = "Kopiert!";
      setTimeout(()=> exportSelectionBtn.textContent = "Auswahl kopieren", 900);
    } catch (e) {
      // fallback: show in selectionList
      selectionList.textContent = "Kopieren fehlgeschlagen. Auswahl: " + text;
    }
  }

  // toggle borders
  toggleBordersBtn.addEventListener("click", () => {
    showBorders = !showBorders;
    updateBorderVisibility();
  });

  clearSelectionBtn.addEventListener("click", () => {
    clearSelection();
  });

  exportSelectionBtn.addEventListener("click", () => {
    exportSelection();
  });

  // recreate grid when image size changes (orientation / resize)
  let resizeObserver = new ResizeObserver(() => {
    // overlay uses percent positioning so no need to recalc sizes,
    // but we keep this in case you want to adapt behavior later.
  });
  resizeObserver.observe(imageWrap);

  // initialize
  createGrid();

  // convenience: clicking the image clears selection if ctrl/shift pressed
  baseImage.addEventListener("click", (ev) => {
    if (ev.ctrlKey || ev.shiftKey) clearSelection();
  });

  // expose some helpers for console debugging
  window.__grid = {
    selectAll: () => {
      document.querySelectorAll(".grid-cell").forEach((el) => {
        const idx = Number(el.dataset.index);
        selected.add(idx);
        el.classList.add("selected");
      });
      updateSelectionUI();
    },
    clear: clearSelection,
    getSelected: () => Array.from(selected).sort((a,b)=>a-b).map(i => i+1)
  };
});