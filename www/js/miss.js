'use strict';

/* ---------------------------
   DOM Elemente
   --------------------------- */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;
const miss = document.getElementById("miss");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const roundNumEl = document.getElementById("roundNum");

/* ---------------------------
   Lives UI
   --------------------------- */
let lives = 3;
function ensureLivesUI() {
  let el = document.getElementById("livesDisplay");
  if (!el) {
    el = document.createElement("div");
    el.id = "livesDisplay";
    el.style.position = "fixed";
    el.style.left = "16px";
    el.style.bottom = "28px";
    el.style.zIndex = 99999;
    el.style.padding = "10px 14px";
    el.style.borderRadius = "10px";
    el.style.background = "rgba(0,0,0,0.65)";
    el.style.color = "#fff";
    el.style.fontFamily = "system-ui, sans-serif";
    el.style.fontSize = "15px";
    el.style.pointerEvents = "none";
    document.body.appendChild(el);
  }
  el.textContent = `Leben: ${lives}`;
}
ensureLivesUI();

function updateLivesUI() {
  const el = document.getElementById("livesDisplay");
  if (el) el.textContent = `Leben: ${lives}`;
}

/* ---------------------------
   Helpers
   --------------------------- */
function safeAddListener(el, evt, handler, opts) {
  if (!el || !el.addEventListener) return;
  el.addEventListener(evt, handler, opts);
}
function safeRemoveListener(el, evt, handler, opts) {
  if (!el || !el.removeEventListener) return;
  try { el.removeEventListener(evt, handler, opts); } catch (e) {}
}
function safeGetRect(el) {
  if (!el || !el.getBoundingClientRect) return null;
  try { return el.getBoundingClientRect(); } catch (e) { return null; }
}

/* ---------------------------
   Spielzustand
   --------------------------- */
let width = 0;
let height = 0;
let path = [];
let segsInfo = null;
let round = 1;

let missSize = { w: 80, h: 80 };
let topQuarterY = 0;

let debug = false;
let showSafeZone = debug;

let prestartActive = false;
let playing = false;
let dragging = false;

let currentAlong = 0;
let lastAlong = 0;

let lossInProgress = false;
let freezeInput = false;

let pendingGameOver = false;   // <-- NEU

const START_Y_FACTOR = 0.18;
const TARGET_Y_FACTOR = 0.78;
const PRESTART_THRESHOLD_FACTOR = 0.60;

const PRESTART_EXIT_BUFFER = 8;
const END_THRESHOLD = 6;

/* ---------------------------
   Resize
   --------------------------- */
function resizeGame() {
  if (!canvas) return;
  const w = Math.floor(window.innerWidth);
  const h = Math.floor(window.innerHeight);

  canvas.width = w;
  canvas.height = h;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";

  width = w;
  height = h;

  topQuarterY = Math.round(height * PRESTART_THRESHOLD_FACTOR);

  const rect = safeGetRect(miss);
  if (rect) {
    missSize.w = rect.width;
    missSize.h = rect.height;
  }
  draw();
}
window.addEventListener("resize", resizeGame);
resizeGame();

/* ---------------------------
   Spline
   --------------------------- */
function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2*p1.x) + (-p0.x+p2.x)*t + (2*p0.x-5*p1.x+4*p2.x-p3.x)*t2 + (-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
    y: 0.5 * ((2*p1.y) + (-p0.y+p2.y)*t + (2*p0.y-5*p1.y+4*p2.y-p3.y)*t2 + (-p0.y+3*p1.y-3*p2.y+p3.y)*t3)
  };
}

function getSplinePoints(ctrl, samples=12) {
  if (!ctrl || ctrl.length < 2) return ctrl || [];
  const pts = [];
  const pad = [ctrl[0], ...ctrl, ctrl[ctrl.length-1]];
  for (let i=0;i<pad.length-3;i++) {
    const p0=pad[i], p1=pad[i+1], p2=pad[i+2], p3=pad[i+3];
    for (let s=0;s<samples;s++) {
      pts.push(catmullRom(p0,p1,p2,p3, s/samples));
    }
  }
  pts.push(ctrl[ctrl.length-1]);
  return pts;
}

/* ---------------------------
   Pfad
   --------------------------- */
// Vollständiges Snippet — kompletter Ersatz
// Öffentliche Funktionsnamen unverändert: generatePathForRound, computeSegments, pointAtDistance, projectPointOnPath, getMaxDeviationPx
// Benötigt im äußeren Scope: width, height, missSize
// Minimale Anforderung: Zwischenpunkte beliebig, einziges Kriterium: Abstand >= 200px

function _rng(seed) {
  let t = seed >>> 0;
  return function() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function _clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

function _catmullRom(p0,p1,p2,p3,t){
  const t2=t*t, t3=t2*t;
  return {
    x:0.5*((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
    y:0.5*((2*p1.y)+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3)
  };
}

function getSplinePoints(ctrl, samplesPerSegment){
  if (!ctrl || ctrl.length<2) return ctrl.slice();
  const out=[];
  for (let i=0;i<ctrl.length-1;i++){
    const p0 = i-1>=0?ctrl[i-1]:ctrl[i];
    const p1 = ctrl[i];
    const p2 = ctrl[i+1];
    const p3 = i+2<ctrl.length?ctrl[i+2]:ctrl[i+1];
    for (let s=0;s<samplesPerSegment;s++){
      out.push(_catmullRom(p0,p1,p2,p3,s/samplesPerSegment));
    }
  }
  out.push(ctrl[ctrl.length-1]);
  return out;
}

function _samplePolylineEven(pts, step){
  const samples=[];
  for (let i=0;i<pts.length-1;i++){
    const a=pts[i], b=pts[i+1];
    const dx=b.x-a.x, dy=b.y-a.y;
    const len=Math.hypot(dx,dy);
    const n=Math.max(1, Math.ceil(len/step));
    for (let t=0;t<n;t++){
      const u=t/n;
      samples.push({x:a.x+dx*u, y:a.y+dy*u});
    }
  }
  samples.push(pts[pts.length-1]);
  return samples;
}

function _buildGrid(samples, cellSize){
  const grid=new Map();
  function key(gx,gy){ return gx+','+gy; }
  samples.forEach((p,idx)=>{
    const gx=Math.floor(p.x/cellSize), gy=Math.floor(p.y/cellSize);
    const k=key(gx,gy);
    if (!grid.has(k)) grid.set(k,[]);
    grid.get(k).push({p,idx});
  });
  return {grid, key, cellSize};
}
function _neighborsGrid(gridObj,x,y){
  const res=[];
  const {grid,key,cellSize}=gridObj;
  const gx=Math.floor(x/cellSize), gy=Math.floor(y/cellSize);
  for (let dx=-1;dx<=1;dx++) for (let dy=-1;dy<=1;dy++){
    const k=key(gx+dx,gy+dy);
    if (grid.has(k)) res.push(...grid.get(k));
  }
  return res;
}
function _checkSeparation(samples, minSep, excludeRadius, cellSize){
  const gridObj=_buildGrid(samples, cellSize);
  const min2=minSep*minSep;
  for (let i=0;i<samples.length;i++){
    const p=samples[i];
    const neigh=_neighborsGrid(gridObj,p.x,p.y);
    for (let it of neigh){
      const j=it.idx;
      if (Math.abs(j-i)<=excludeRadius) continue;
      const q=it.p;
      const dx=p.x-q.x, dy=p.y-q.y;
      if (dx*dx+dy*dy < min2) return false;
    }
  }
  return true;
}

function getMaxDeviationPx(){
  return Math.max(24, Math.round(Math.min(missSize.w, missSize.h) * 0.6));
}

function computeSegments(pts){
  const segs=[]; let total=0;
  for (let i=0;i<pts.length-1;i++){
    const a=pts[i], b=pts[i+1];
    const dx=b.x-a.x, dy=b.y-a.y;
    const len=Math.hypot(dx,dy);
    segs.push({a,b,len});
    total+=len;
  }
  return {segs,total};
}

function pointAtDistance(si,d){
  if (!si||!si.segs.length) return {x:0,y:0};
  if (d<=0) return si.segs[0].a;
  if (d>=si.total) return si.segs[si.segs.length-1].b;
  let acc=0;
  for (let s of si.segs){
    if (acc + s.len >= d){
      const t=(d-acc)/s.len;
      return {x:s.a.x+(s.b.x-s.a.x)*t, y:s.a.y+(s.b.y-s.a.y)*t};
    }
    acc+=s.len;
  }
  return si.segs[si.segs.length-1].b;
}

function projectPointOnPath(si,p){
  let best={dist:Infinity,along:0}; let acc=0;
  for (let s of si.segs){
    const ax=s.a.x, ay=s.a.y, bx=s.b.x, by=s.b.y;
    const vx=bx-ax, vy=by-ay;
    const wx=p.x-ax, wy=p.y-ay;
    const len2=vx*vx+vy*vy;
    let t=0;
    if (len2>0) t=(vx*wx+vy*wy)/len2;
    t=_clamp(t,0,1);
    const px=ax+vx*t, py=ay+vy*t;
    const dx=p.x-px, dy=p.y-py;
    const d=Math.hypot(dx,dy);
    const along=acc + s.len*t;
    if (d<best.dist) best={dist:d,along};
    acc+=s.len;
  }
  return best;
}

// generatePathForRound: neue Logik
function generatePathForRound(r, opts){
  opts = opts || {};
  const seed = (typeof opts.seed !== 'undefined') ? opts.seed : (Math.floor(Math.random()*1e9) ^ r);
  const rng = _rng(seed);

  const sFactor = (typeof START_Y_FACTOR !== 'undefined') ? START_Y_FACTOR : 0.12;
  const tFactor = (typeof TARGET_Y_FACTOR !== 'undefined') ? TARGET_Y_FACTOR : 0.88;
  const start = (typeof startPoint !== 'undefined') ? {x:startPoint.x, y:startPoint.y} : {x:Math.round(width/2), y:Math.round(height*sFactor)};
  const target = (typeof targetPoint !== 'undefined') ? {x:targetPoint.x, y:targetPoint.y} : {x:Math.round(width/2), y:Math.round(height*tFactor)};

  const straightDist = Math.hypot(target.x-start.x, target.y-start.y);
  const desiredLength = straightDist * Math.pow(1.10, Math.max(0, r-1));

  const R = getMaxDeviationPx();
  const minSep = 2*R + 2;
  const sampleStep = Math.max(3, Math.floor(R/2));
  const excludeRadius = Math.ceil(minSep / sampleStep);
  const cellSize = minSep;

  const numExtra = Math.max(0, r-1);
  const marginX = Math.max(missSize.w, Math.round(width*0.03));
  const marginY = Math.max(missSize.h, Math.round(height*0.03));
  const minX = marginX, maxX = width - marginX;
  const minY = marginY, maxY = height - marginY;

  const REQUIRED_MIN_DIST = 200; // 200px Abstand

  function placeRandomPoints(count){
    const pts=[];
    for (let i=0;i<count;i++){
      let placed=false, attempts=0;
      while(!placed && attempts<500){
        attempts++;
        const x = Math.round(minX + rng()*(maxX-minX));
        const y = Math.round(minY + rng()*(maxY-minY));
        const cand={x,y};
        let ok=true;
        // check against start/target
        const anchors = [start, target];
        for (let a of anchors){
          const dx=cand.x-a.x, dy=cand.y-a.y;
          if (dx*dx+dy*dy < REQUIRED_MIN_DIST*REQUIRED_MIN_DIST){ ok=false; break; }
        }
        if (!ok) continue;
        for (let p of pts){
          const dx=cand.x-p.x, dy=cand.y-p.y;
          if (dx*dx+dy*dy < REQUIRED_MIN_DIST*REQUIRED_MIN_DIST){ ok=false; break; }
        }
        if (!ok) continue;
        pts.push(cand); placed=true;
      }
      if (!placed){
        // relax by placing on a grid to guarantee placement
        let placedGrid=false;
        for (let gx=minX; gx<=maxX && !placedGrid; gx+=REQUIRED_MIN_DIST){
          for (let gy=minY; gy<=maxY && !placedGrid; gy+=REQUIRED_MIN_DIST){
            const cand={x:gx + Math.floor(rng()*Math.min(REQUIRED_MIN_DIST, maxX-gx)), y:gy + Math.floor(rng()*Math.min(REQUIRED_MIN_DIST, maxY-gy))};
            let ok=true;
            for (let a of [start,target]){ const dx=cand.x-a.x, dy=cand.y-a.y; if (dx*dx+dy*dy < REQUIRED_MIN_DIST*REQUIRED_MIN_DIST) { ok=false; break; } }
            for (let p of pts){ const dx=cand.x-p.x, dy=cand.y-p.y; if (dx*dx+dy*dy < REQUIRED_MIN_DIST*REQUIRED_MIN_DIST) { ok=false; break; } }
            if (ok){ pts.push(cand); placedGrid=true; break; }
          }
        }
        if (!placedGrid) pts.push({x:Math.round(minX + rng()*(maxX-minX)), y:Math.round(minY + rng()*(maxY-minY))});
      }
    }
    return pts;
  }

  function visitOrderNearestNeighbor(points){
    if (!points || points.length===0) return [];
    const pts = points.slice();
    const order=[];
    let cur = {x:start.x,y:start.y};
    while(pts.length){
      let bestIdx=0, bestD=Infinity;
      for (let i=0;i<pts.length;i++){
        const dx=pts[i].x-cur.x, dy=pts[i].y-cur.y;
        const d=Math.hypot(dx,dy);
        if (d<bestD){ bestD=d; bestIdx=i; }
      }
      order.push(pts.splice(bestIdx,1)[0]);
      cur = order[order.length-1];
    }
    return order;
  }

  function roundCorners(raw, maxCorner){
    function normalize(v){ const L=Math.hypot(v.x,v.y)||1; return {x:v.x/L,y:v.y/L}; }
    const out=[raw[0]];
    for (let i=1;i<raw.length-1;i++){
      const A=raw[i-1], B=raw[i], C=raw[i+1];
      const vAB={x:B.x-A.x,y:B.y-A.y}, vBC={x:C.x-B.x,y:C.y-B.y};
      const dAB=Math.hypot(vAB.x,vAB.y), dBC=Math.hypot(vBC.x,vBC.y);
      if (dAB<1e-6||dBC<1e-6){ out.push(B); continue; }
      const nAB=normalize(vAB), nBC=normalize(vBC);
      const rCorner=Math.min(maxCorner, dAB*0.45, dBC*0.45);
      const Bin={x:B.x - nAB.x*rCorner, y:B.y - nAB.y*rCorner};
      const Bout={x:B.x + nBC.x*rCorner, y:B.y + nBC.y*rCorner};
      Bin.x=_clamp(Bin.x, missSize.w/2, width-missSize.w/2);
      Bin.y=_clamp(Bin.y, missSize.h/2, height-missSize.h/2);
      Bout.x=_clamp(Bout.x, missSize.w/2, width-missSize.w/2);
      Bout.y=_clamp(Bout.y, missSize.h/2, height-missSize.h/2);
      out.push(Bin);
      out.push({x:(Bin.x+Bout.x)/2, y:(Bin.y+Bout.y)/2});
      out.push(Bout);
    }
    out.push(raw[raw.length-1]);
    return out;
  }

  const maxAttempts = (opts && opts.maxAttempts) ? opts.maxAttempts : 24;
  for (let attempt=0; attempt<maxAttempts; attempt++){
    const extras = placeRandomPoints(numExtra);
    const orderedExtras = visitOrderNearestNeighbor(extras);
    const raw = [{x:start.x,y:start.y}, ...orderedExtras.map(p=>({x:p.x,y:p.y})), {x:target.x,y:target.y}];
    const maxCorner = Math.max(8, Math.round(Math.min(width,height) * 0.05));
    const ctrl = roundCorners(raw, maxCorner);

    const samplesPerSegment = Math.min(48, 8 + Math.floor(r*1.6));
    const candidate = getSplinePoints(ctrl, samplesPerSegment);

    let L=0;
    for (let i=0;i<candidate.length-1;i++){
      const dx=candidate[i+1].x-candidate[i].x, dy=candidate[i+1].y-candidate[i].y;
      L += Math.hypot(dx,dy);
    }

    if (L < desiredLength * 0.9) continue;

    const samples = _samplePolylineEven(candidate, sampleStep);
    const ok = _checkSeparation(samples, minSep, excludeRadius, cellSize);
    if (ok){
      candidate[0] = {x:start.x,y:start.y};
      candidate[candidate.length-1] = {x:target.x,y:target.y};
      return candidate;
    }
    rng(); rng();
  }

  // Fallback: deterministic grid placement with 200px spacing
  const fallbackExtras=[];
  let gx = Math.max(0, Math.floor((width - 2*marginX) / REQUIRED_MIN_DIST));
  let gy = Math.max(0, Math.floor((height - 2*marginY) / REQUIRED_MIN_DIST));
  if (gx<1) gx=1; if (gy<1) gy=1;
  let placed=0;
  for (let ix=0; ix<gx && placed<numExtra; ix++){
    for (let iy=0; iy<gy && placed<numExtra; iy++){
      const x = Math.round(marginX + (ix+0.5)*(width-2*marginX)/gx);
      const y = Math.round(marginY + (iy+0.5)*(height-2*marginY)/gy);
      const dxS=x-start.x, dyS=y-start.y, dxT=x-target.x, dyT=y-target.y;
      if (dxS*dxS+dyS*dyS < REQUIRED_MIN_DIST*REQUIRED_MIN_DIST) continue;
      if (dxT*dxT+dyT*dyT < REQUIRED_MIN_DIST*REQUIRED_MIN_DIST) continue;
      fallbackExtras.push({x,y});
      placed++;
    }
  }
  while (fallbackExtras.length < numExtra){
    fallbackExtras.push({x:Math.round(minX + rng()*(maxX-minX)), y:Math.round(minY + rng()*(maxY-minY))});
  }
  const rawFallback = [{x:start.x,y:start.y}, ...fallbackExtras, {x:target.x,y:target.y}];
  const ctrlFallback = roundCorners(rawFallback, Math.max(8, Math.round(Math.min(width,height)*0.04)));
  const fallbackPts = getSplinePoints(ctrlFallback, Math.min(64, 12 + Math.floor(r*1.5)));
  fallbackPts[0] = {x:start.x,y:start.y};
  fallbackPts[fallbackPts.length-1] = {x:target.x,y:target.y};
  return fallbackPts;
}

/* ---------------------------
   Preview (fehlende Funktion wiederherstellen)
   --------------------------- */
async function animatePreview(points) {
  return new Promise(resolve => {
    if (!points || points.length < 2) return resolve();
    segsInfo = computeSegments(points);
    const total = segsInfo.total;

    const duration = Math.max(1400, total * 0.90);

    const startTime = performance.now();

    function step(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const dist = t * total;
      const p = pointAtDistance(segsInfo, dist);

      miss.style.left = (p.x - missSize.w/2) + "px";
      miss.style.top  = (p.y - missSize.h/2) + "px";

      draw();

      if (t < 1) requestAnimationFrame(step);
      else resolve();
    }

    const startP = points[0];
    miss.style.left = (startP.x - missSize.w/2) + "px";
    miss.style.top  = (startP.y - missSize.h/2) + "px";

    requestAnimationFrame(step);
  });
}
/* ---------------------------
   Trail System - Globale Variablen (füge zu den bestehenden globalen Variablen hinzu)
   --------------------------- */
let trailPoints = []; // {x, y, t}
let trailTime = 0;
let roundStartTime = 0;
let gameLoopId = null;

const TRAIL_DURATION_BASE = 1200; // ms für Runde 1
const TRAIL_FADE_STEPS = 20;

/* ---------------------------
   Trail Update & Draw
   --------------------------- */
/* ---------------------------
   Trail: ersetzt updateTrail, draw, gameLoop und Integrationszeilen
   --------------------------- */

function updateTrail(currentPos) {
  const now = performance.now();
  trailTime = now - roundStartTime;

  if (!currentPos || typeof currentPos.x !== 'number') return;

  // Abstand-Filter
  const last = trailPoints[trailPoints.length - 1];
  const MIN_DIST = 3;
  if (!last || Math.hypot(currentPos.x - last.x, currentPos.y - last.y) >= MIN_DIST) {
    trailPoints.push({ x: currentPos.x, y: currentPos.y, t: now });
  }

  // Begrenze Länge
  const maxLen = TRAIL_FADE_STEPS * 2;
  if (trailPoints.length > maxLen) {
    trailPoints.splice(0, trailPoints.length - maxLen);
  }
}

function draw() {
  // Voraussetzungen
  if (!ctx) return;
  if (!Array.isArray(path)) return;
  if (typeof width !== "number" || typeof height !== "number") return;
  if (path.length <= 1) {
    ctx.clearRect(0, 0, width, height);
    return;
  }

  // Interner Zustand (persistiert als Eigenschaft von draw)
  if (!draw._state) {
    draw._state = {
      raf: null,
      startTime: null,
      baseDuration: 10000,   // Basisdauer in ms (z.B. 10s)
      initialFactor: 3,      // erste Runde ist baseDuration / initialFactor
      durationMin: 200,      // minimale Dauer in ms (Schutz gegen zu schnelle Runden)
      roundsCompleted: 0,    // Anzahl abgeschlossener Runden
      loop: false,           // true = automatisch wiederholen (dann wird jede Runde schneller)
      penRadius: 4,
      penColor: "rgba(0,150,255,0.95)",
      strokeColor: "rgba(0,150,255,0.18)",
      lastPathHash: null,
      done: false,
      segments: null,
      totalLen: 0,
      phase: "draw",         // "draw" | "fade" | "done"
      fadeStart: null,
      fadeDuration: 800      // Ausblenddauer in ms
    };
  }
  const s = draw._state;

  // Helper: einfacher Hash für path (ändert sich, wenn Punkte sich ändern)
  function pathHash(pts) {
    let h = pts.length + "|";
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      h += Math.round(p.x) + "," + Math.round(p.y) + ";";
    }
    return h;
  }

  // Reset wenn Pfad neu oder verändert
  const currentHash = pathHash(path);
  const isNew = currentHash !== s.lastPathHash;
  s.lastPathHash = currentHash;
  if (isNew) {
    s.startTime = null;
    s.done = false;
    s.segments = null;
    s.totalLen = 0;
    s.phase = "draw";
    s.fadeStart = null;
    // roundsCompleted bleibt erhalten, damit Geschwindigkeit akkumuliert über Runden
    if (s.raf) { cancelAnimationFrame(s.raf); s.raf = null; }
  }

  // Berechne Segmente (räumlich)
  if (!s.segments) {
    const segs = [];
    let total = 0;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      segs.push({ from: a, to: b, len: len });
      total += len;
    }
    s.segments = segs;
    s.totalLen = total;
  }

  // Berechne die aktuelle Dauer:
  // - Erste Runde: baseDuration / initialFactor
  // - Danach: baseDuration / initialFactor / (1.15 ^ roundsCompleted)
  function currentDuration() {
    const factorRounds = Math.pow(1.10, Math.max(0, s.roundsCompleted || 0));
    const dur = Math.round(s.baseDuration / s.initialFactor / factorRounds);
    return Math.max(s.durationMin, dur);
  }

  // Wenn bereits komplett fertig und ausgeblendet, nichts mehr zeichnen
  if (s.phase === "done") {
    ctx.clearRect(0, 0, width, height);
    return;
  }

  // Render-Funktion
  function render(now) {
    if (!s.startTime) s.startTime = now;
    ctx.clearRect(0, 0, width, height);

    if (s.phase === "draw") {
      const dur = currentDuration();
      const elapsed = now - s.startTime;
      const t = Math.min(1, elapsed / Math.max(1, dur)); // 0..1
      const drawLen = s.totalLen * t;

      // Zeichne bisherige Strecke exakt entlang der Segmente
      ctx.save();
      ctx.lineWidth = Math.max(1, getMaxDeviationPx() * 0.25);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = s.strokeColor;
      ctx.beginPath();

      let remaining = drawLen;
      let penX = path[0].x, penY = path[0].y;
      let started = false;

      for (let i = 0; i < s.segments.length; i++) {
        const { from, to, len } = s.segments[i];
        if (remaining <= 0) break;

        if (remaining >= len) {
          if (!started) { ctx.moveTo(from.x, from.y); started = true; }
          ctx.lineTo(to.x, to.y);
          remaining -= len;
          penX = to.x; penY = to.y;
        } else {
          const ratio = remaining / len;
          const ix = from.x + (to.x - from.x) * ratio;
          const iy = from.y + (to.y - from.y) * ratio;
          if (!started) { ctx.moveTo(from.x, from.y); started = true; }
          ctx.lineTo(ix, iy);
          penX = ix; penY = iy;
          remaining = 0;
          break;
        }
      }

      ctx.stroke();
      ctx.restore();

      // Pen zeichnen solange t < 1
      if (t < 1) {
        ctx.save();
        ctx.fillStyle = s.penColor;
        ctx.beginPath();
        ctx.arc(penX, penY, s.penRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        s.raf = requestAnimationFrame(render);
      } else {
        // Nachzeichnung fertig: starte Fade-Phase
        s.phase = "fade";
        s.fadeStart = now;
        s.raf = requestAnimationFrame(render);
      }
    } else if (s.phase === "fade") {
      // Fade out: reduziere Alpha der gesamten gezeichneten Linie über fadeDuration
      const fadeElapsed = now - s.fadeStart;
      const f = Math.min(1, fadeElapsed / Math.max(1, s.fadeDuration)); // 0..1
      const alpha = 1 - f; // 1 -> 0

      // Zeichne die komplette Linie mit reduzierter Alpha
      ctx.save();
      ctx.lineWidth = Math.max(1, getMaxDeviationPx() * 0.25);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      let base = s.strokeColor;
      const rgbaMatch = base.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)$/);
      if (rgbaMatch) {
        const r = rgbaMatch[1], g = rgbaMatch[2], b = rgbaMatch[3];
        const origA = rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1;
        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha * origA})`;
      } else {
        ctx.strokeStyle = `rgba(0,150,255,${alpha})`;
      }

      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.stroke();
      ctx.restore();

      if (f < 1) {
        s.raf = requestAnimationFrame(render);
      } else {
        // Fade komplett: clear und beenden
        ctx.clearRect(0, 0, width, height);
        s.phase = "done";
        s.raf = null;
        s.startTime = null;

        // Runde als abgeschlossen zählen
        s.roundsCompleted = (s.roundsCompleted || 0) + 1;

        // Wenn loop aktiv, starte nächste Runde (nun 15% schneller)
        if (s.loop) {
          s.phase = "draw";
          s.startTime = null;
          s.fadeStart = null;
          s.raf = requestAnimationFrame(render);
        }
      }
    }
  }

  // Starte Animation falls noch nicht laufend
  if (!s.raf) {
    s.raf = requestAnimationFrame(render);
  } else {
    // Falls RAF bereits läuft, aktualisiere sofort den sichtbaren Frame
    render(performance.now());
  }
}
function gameLoop() {
  if (playing && segsInfo) {
    const pos = pointAtDistance(segsInfo, currentAlong); // {x,y} erwartet
    updateTrail(pos);
    draw();
  }

  if (playing) {
    gameLoopId = requestAnimationFrame(gameLoop);
  } else if (gameLoopId) {
    cancelAnimationFrame(gameLoopId);
    gameLoopId = null;
  }
}

/* ---------------------------
   Integrationszeilen (ersetzen die bisherigen)
   --------------------------- */

// In startEvaluationMode(initialProj) nach playing=true:
roundStartTime = performance.now();
trailPoints = [];
if (gameLoopId) cancelAnimationFrame(gameLoopId);
gameLoopId = requestAnimationFrame(gameLoop);

// In startCurrentRound() nach enablePrestartMode();
trailPoints = [];
roundStartTime = performance.now();

/* ---------------------------
   startCurrentRound
   --------------------------- */
async function startCurrentRound(withPreview = true) {
  path = generatePathForRound(round);
  segsInfo = computeSegments(path);
  currentAlong = 0;
  lastAlong = 0;

  if (withPreview) {
    await animatePreview(path);
  }

  const startP = path[0];
  miss.style.left = (startP.x - missSize.w/2) + "px";
  miss.style.top  = (startP.y - missSize.h/2) + "px";

  enablePrestartMode();

  // draw initial frame (inkl. Trail falls vorhanden)
  draw();
}

/* ---------------------------
   Verlust‑Logik
   --------------------------- */
async function triggerLossCheckLoop() {

  if (lives === 0 || overlay.classList.contains("gameOverScreen")) return;
  if (lossInProgress) return;

  lossInProgress = true;
  freezeInput = true;

  overlay.classList.add("redFlash");

  while (true) {
    await new Promise(r => setTimeout(r, 200));

    const rect = safeGetRect(miss);
    if (!rect) continue;

    const midX = rect.left + rect.width / 2;
    const midY = rect.top + rect.height / 2;

    const proj = projectPointOnPath(segsInfo, { x: midX, y: midY });

    if (proj.dist <= getMaxDeviationPx()) {

      lives = Math.max(0, lives - 1);
      updateLivesUI();

      if (lives === 0) {

        pendingGameOver = true;   // <-- NEU

        overlay.classList.remove("redFlash");
        freezeInput = true;
        lossInProgress = false;
        return;
      }

      overlay.classList.remove("redFlash");
      freezeInput = false;
      lossInProgress = false;
      return;
    }
  }
}

/* ---------------------------
   SYNCHRONER GAME OVER FIX
   --------------------------- */
window.addEventListener("pointerup", () => {
  if (pendingGameOver) {
    pendingGameOver = false;
    runGameOver();
  }
});

function runGameOver() {
  const score = Math.max(0, round - 1);

  try {
    if (typeof checkForHighscore === "function" &&
        checkForHighscore(score, "Tico sucht sein Zuhause")) {

      const name = prompt(`Neuer Highscore! Runde ${score}. Dein Name:`);

      if (name && typeof addHighscore === "function") {
        addHighscore(name, score, "Tico sucht sein Zuhause");
      }
    }

    if (typeof showHighscores === "function") {
      showHighscores();
    }
  } catch (e) {
    console.error("Highscore error:", e);
  }

  overlay.innerHTML = `
    <div class="gameOverContainer">
      <div class="gameOverTitle">GAME OVER</div>
      <div class="gameOverScore">Runden: ${score}
  `;
  overlay.classList.add("gameOverScreen");

// Button-Listener sicher setzen, auch wenn pointerup auf dem Button passiert ist
setTimeout(() => {
  const btn = document.getElementById("backToMenuBtn");
  if (btn) {
    btn.onclick = () => {
      window.location.href = "index.html";
    };
  }
}, 0);
}

/* ---------------------------
   Prestart
   --------------------------- */
function enablePrestartMode() {
  prestartActive = true;
  playing = false;
  dragging = false;

  if (miss) miss._preSwitchedToEval = false;

  const startP = path[0];
  miss.style.left = (startP.x - missSize.w / 2) + "px";
  miss.style.top = (startP.y - missSize.h / 2) + "px";

  miss.style.touchAction = "none";
  miss.style.pointerEvents = "auto";

  function onDown(ev) {
    if (freezeInput) return;
    ev.preventDefault();
    dragging = true;
    miss.classList.add("dragging");
    try { miss.setPointerCapture(ev.pointerId); } catch (e) {}
  }

  async function onMove(ev) {
    if (!dragging || freezeInput) return;

    let x = ev.clientX, y = ev.clientY;
    x = Math.max(missSize.w / 2, Math.min(width - missSize.w / 2, x));
    y = Math.max(missSize.h / 2, Math.min(height - missSize.h / 2, y));
    miss.style.left = (x - missSize.w / 2) + "px";
    miss.style.top = (y - missSize.h / 2) + "px";

    const rect = safeGetRect(miss);
    if (!rect) return;
    const midX = rect.left + rect.width / 2;
    const midY = rect.top + rect.height / 2;

    if (midY > topQuarterY - PRESTART_EXIT_BUFFER) {
      const proj = projectPointOnPath(segsInfo, { x: midX, y: midY });

      if (proj.dist > getMaxDeviationPx()) {
        triggerLossCheckLoop();
        return;
      }

      miss._preSwitchedToEval = true;

      safeRemoveListener(miss, "pointerdown", miss._preDown);
      safeRemoveListener(window, "pointermove", miss._preMove);
      safeRemoveListener(window, "pointerup", miss._preUp);

      prestartActive = false;
      startEvaluationMode(proj);

      try { miss.setPointerCapture(ev.pointerId); } catch (e) {}
      if (miss._moveHandler) miss._moveHandler(ev);
    }
  }

  function onUp(ev) {
    if (!dragging) return;
    dragging = false;
    miss.classList.remove("dragging");
    try { miss.releasePointerCapture(ev.pointerId); } catch (e) {}
  }

  miss._preDown = onDown;
  miss._preMove = onMove;
  miss._preUp = onUp;

  safeAddListener(miss, "pointerdown", onDown);
  safeAddListener(window, "pointermove", onMove);
  safeAddListener(window, "pointerup", onUp);

  draw();
}

/* ---------------------------
   Evaluation
   --------------------------- */
function startEvaluationMode(initialProj) {
  playing = true;

  if (initialProj) {
    currentAlong = initialProj.along;
    lastAlong = currentAlong;
    const pos = pointAtDistance(segsInfo, currentAlong);
    miss.style.left = (pos.x - missSize.w / 2) + "px";
    miss.style.top = (pos.y - missSize.h / 2) + "px";
  } else {
    currentAlong = 0;
    lastAlong = 0;
  }

  miss.style.touchAction = "none";
  miss.style.pointerEvents = "auto";

  function onDown(ev) {
    if (freezeInput) return;
    ev.preventDefault();
    dragging = true;
    miss.classList.add("dragging");
    try { miss.setPointerCapture(ev.pointerId); } catch (e) {}
  }

  async function onMove(ev) {
    if (!dragging || freezeInput) return;

    let x = ev.clientX, y = ev.clientY;
    x = Math.max(missSize.w / 2, Math.min(width - missSize.w / 2, x));
    y = Math.max(missSize.h / 2, Math.min(height - missSize.h / 2, y));
    miss.style.left = (x - missSize.w / 2) + "px";
    miss.style.top = (y - missSize.h / 2) + "px";

    const proj = projectPointOnPath(segsInfo, { x, y });

    if (proj.dist > getMaxDeviationPx()) {
      triggerLossCheckLoop();
      return;
    }

    if (proj.along >= lastAlong - 2) {
      currentAlong = proj.along;
      lastAlong = Math.max(lastAlong, currentAlong);
    }

    if (currentAlong >= segsInfo.total - END_THRESHOLD) {
      dragging = false;
      miss.classList.remove("dragging");
      try { miss.releasePointerCapture(ev.pointerId); } catch (e) {}
      onSuccess();
    }
  }

  function onUp(ev) {
    if (!dragging) return;
    dragging = false;
    miss.classList.remove("dragging");
    try { miss.releasePointerCapture(ev.pointerId); } catch (e) {}
  }

  miss._downHandler = onDown;
  miss._moveHandler = onMove;
  miss._upHandler = onUp;

  safeAddListener(miss, "pointerdown", onDown);
  safeAddListener(window, "pointermove", onMove);
  safeAddListener(window, "pointerup", onUp);

  draw();
}

/* ---------------------------
   Erfolg / nächste Runde
   --------------------------- */
function onSuccess() {
  flash("green");
  setTimeout(async () => {
    round++;
    if (roundNumEl) roundNumEl.textContent = round;

    await startCurrentRound(true);
  }, 250);
}

/* ---------------------------
   Flash
   --------------------------- */
function flash(color) {
  if (!overlay) return;
  overlay.classList.add(color === "green" ? "greenFlash" : "redFlash");
  setTimeout(() => overlay.classList.remove("greenFlash", "redFlash"), 300);
}

/* ---------------------------
   Start-Button
   --------------------------- */
if (startBtn) {
  startBtn.addEventListener("click", async () => {
    const rect = safeGetRect(miss);
    if (rect) {
      missSize.w = rect.width;
      missSize.h = rect.height;
    }

    await startCurrentRound(true);
  });
}

/* ---------------------------
   Miss image size initialization
   --------------------------- */
function initMissSizeFromImage() {
  if (!miss) return;
  function setSize() {
    const rect = safeGetRect(miss);
    if (rect) {
      missSize.w = rect.width;
      missSize.h = rect.height;
    }
  }
  if (miss.complete) {
    setSize();
  } else {
    safeAddListener(miss, "load", setSize, { once: true });
    setTimeout(setSize, 500);
  }
}
initMissSizeFromImage();

/* ---------------------------
   Debug: Safe‑Zone Toggle
   --------------------------- */
(function createDebugSafeZoneToggle() {
  if (!debug) return;

  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.top = "10px";
  wrapper.style.right = "10px";
  wrapper.style.zIndex = 100000;
  wrapper.style.background = "rgba(0,0,0,0.45)";
  wrapper.style.color = "#fff";
  wrapper.style.padding = "6px 10px";
  wrapper.style.borderRadius = "8px";
  wrapper.style.fontFamily = "system-ui, sans-serif";
  wrapper.style.fontSize = "13px";
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "center";
  wrapper.style.gap = "8px";

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = showSafeZone;
  cb.id = "safeZoneToggle";
  cb.style.cursor = "pointer";

  const label = document.createElement("label");
  label.htmlFor = "safeZoneToggle";
  label.textContent = "Safe‑Zone anzeigen";
  label.style.cursor = "pointer";

  cb.addEventListener("change", () => {
    showSafeZone = cb.checked;
    draw();
  });

  wrapper.appendChild(cb);
  wrapper.appendChild(label);
  document.body.appendChild(wrapper);
})();

/* ---------------------------
   Highscore Init
   --------------------------- */
try {
  if (typeof Highscore !== "undefined" && Highscore && typeof Highscore.init === "function") {
    Highscore.init({
      title: "Highscores",
      showButton: true,
      buttonText: "Highscores",
      attachTo: document.body
    });
  }
} catch (e) {
  console.warn("Highscore init failed", e);
}

/* ---------------------------
   Initial Setup
   --------------------------- */
(async function initialSetup() {
  path = generatePathForRound(round);
  segsInfo = computeSegments(path);

  const startP = path[0];
  miss.style.left = (startP.x - missSize.w / 2) + "px";
  miss.style.top = (startP.y - missSize.h / 2) + "px";

  updateLivesUI();

  await animatePreview(path);

  enablePrestartMode();
  draw();
})();
// Sicherstellen, dass der Button existiert und klickbar ist
(function(){
  const btn = document.getElementById('menuBtn');
  if (!btn) return;
  // Entferne mögliche Inline-Blocker
  btn.style.pointerEvents = 'auto';
  btn.addEventListener('click', () => {
    window.location.href = 'index.html';
  }, { passive: true });
})();