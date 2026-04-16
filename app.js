/**
 * app.js — Rush Hour: AIC Tech Vibe
 * Mobile-optimized puzzle game with Firebase integration
 * ES6+ Vanilla JS, 60fps drag-and-drop, touch-first
 */

// ============================================================
// SECTION 1: FIREBASE CONFIGURATION (Paste your credentials here)
// ============================================================
const firebaseConfig = {
  apiKey:            "AIzaSyDuwfL6stihPCPOSdLm83DOyGTKqDu056s",
  authDomain:        "rush-hour-76a77.firebaseapp.com",
  // ⚠️  REQUIRED for Realtime Database — format:
  //     https://<project-id>-default-rtdb.firebaseio.com
  //  or https://<project-id>-default-rtdb.<region>.firebasedatabase.app
  //  Find it in: Firebase Console → Realtime Database → Data tab (URL shown at the top)
  databaseURL:       "https://rush-hour-76a77-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "rush-hour-76a77",
  storageBucket:     "rush-hour-76a77.firebasestorage.app",
  messagingSenderId: "718984440819",
  appId:             "1:718984440819:web:00512625166e277e50c086",
  measurementId:     "G-C3WHDPNFJ7"
};

// ============================================================
// SECTION 2: FIREBASE INIT (using compat SDK via CDN)
// ============================================================
let db = null;

function initFirebase() {
  try {
    if (typeof firebase === 'undefined') {
      console.warn('[Firebase] SDK not loaded. Running in offline mode.');
      return;
    }
    // Avoid "already initialized" error on hot-reload
    const app = firebase.apps.length
      ? firebase.apps[0]
      : firebase.initializeApp(firebaseConfig);
    db = firebase.database(app);
    console.log('[Firebase] Connected ✓', firebaseConfig.databaseURL);
  } catch (e) {
    console.error('[Firebase] Init failed:', e.message);
    console.error('Check: 1) databaseURL value  2) Database Rules allow read/write  3) Realtime Database is enabled in your project');
  }
}

/**
 * submitGameData — Saves game result to Firebase Realtime Database
 * @param {Object} data - { nickname, email, timeTakenMS, moves, wantsOffer }
 * @returns {Promise<string|null>} - Push key or null on failure
 */
async function submitGameData(data) {
  if (!db) {
    console.warn('[Firebase] Database not available, skipping submit.');
    return null;
  }
  const entry = {
    ...data,
    timestamp: Date.now(),
  };
  const ref = db.ref('leaderboard').push();
  await ref.set(entry);
  return ref.key;
}

// ============================================================
// SECTION 3: GAME CONSTANTS & GRID SETUP
// ============================================================
const GRID_SIZE = 6;
const TIMER_START = 180; // 3 minutes in seconds
const EXIT_ROW = 2;   // Row of the Red Car and exit (0-indexed)

/**
 * Level definitions.
 * Each vehicle: { id, type:'car'|'truck', orient:'H'|'V', row, col, cssClass }
 * row/col are 0-indexed top-left cell.
 * Red car id must be 'redcar'.
 */
const LEVELS = {
  0: {
    // Tutorial — very simple, 2-move solve
    vehicles: [
      { id: 'redcar', type: 'car', orient: 'H', row: 2, col: 0, cssClass: 'red-car' },
      { id: 'b1', type: 'car', orient: 'V', row: 0, col: 3, cssClass: 'blue-car' },
    ],
    exitSide: 'right', // 'right' | 'left' | 'top' | 'bottom'
    exitIndex: 2,      // Which row/col the exit is on (matches EXIT_ROW for 'right'/'left')
  },

  2: {
    /**
     * COMPETITIVE LEVEL 2 — Hard chain-of-moves puzzle (14 vehicles).
     *
     * Grid layout (0-indexed, R = red car, exit → right at row 2):
     *      c0   c1   c2   c3   c4   c5
     * r0:   .    A    A    B    B    .
     * r1:   C    D    D    .    E    E
     * r2:   C    R    R    F    G    .  EXIT→
     * r3:   N    .    .    F    G    J
     * r4:   N    I    I    L    L    J
     * r5:   K    K    .    M    M    .
     *
     * Verified 8-move solution:
     *   1. B right 1  → r0c3 free
     *   2. F up 2     → r2c3 free ✓
     *   3. C up 1     → r2c0 free
     *   4. N up 1     → r4c0 free
     *   5. I left 1   → r4c2 free
     *   6. L left 1   → r4c4 free
     *   7. G down 1   → r2c4 free ✓  (r2c5 was always free)
     *   8. R right →  EXIT
     */
    vehicles: [
      // Red car — exit right, row 2
      { id: 'redcar', type: 'car', orient: 'H', row: 2, col: 1, cssClass: 'red-car' },
      // Row 0 blockers
      { id: 'v_A', type: 'car', orient: 'H', row: 0, col: 1, cssClass: 'blue-car' }, // A
      { id: 'v_B', type: 'car', orient: 'H', row: 0, col: 3, cssClass: 'yellow-car' }, // B — must move right first
      // Column 0 chain: C → N
      { id: 'v_C', type: 'car', orient: 'V', row: 1, col: 0, cssClass: 'green-car' }, // C
      { id: 'v_N', type: 'car', orient: 'V', row: 3, col: 0, cssClass: 'teal-truck' }, // N (styled as teal)
      // Row 1 filler
      { id: 'v_D', type: 'car', orient: 'H', row: 1, col: 1, cssClass: 'purple-car' }, // D
      { id: 'v_E', type: 'car', orient: 'H', row: 1, col: 4, cssClass: 'cyan-truck' }, // E (styled as cyan)
      // Column 3/4 blockers in row 2-3
      { id: 'v_F', type: 'car', orient: 'V', row: 2, col: 3, cssClass: 'orange-truck' }, // F — blocks r2c3
      { id: 'v_G', type: 'car', orient: 'V', row: 2, col: 4, cssClass: 'pink-car' }, // G — blocks r2c4
      // Column 5 blocker (row 3-4)
      { id: 'v_J', type: 'car', orient: 'V', row: 3, col: 5, cssClass: 'purple-car' }, // J
      // Row 4 chain: I → L
      { id: 'v_I', type: 'car', orient: 'H', row: 4, col: 1, cssClass: 'blue-car' }, // I — blocks L from shifting left
      { id: 'v_L', type: 'car', orient: 'H', row: 4, col: 3, cssClass: 'yellow-car' }, // L — blocks G from dropping
      // Row 5 decoration / dead-end cars
      { id: 'v_K', type: 'car', orient: 'H', row: 5, col: 0, cssClass: 'green-car' }, // K
      { id: 'v_M', type: 'car', orient: 'H', row: 5, col: 3, cssClass: 'pink-car' }, // M
    ],
    exitSide: 'right',
    exitIndex: 2,
  },
};

// ============================================================
// SECTION 4: STATE
// ============================================================
const state = {
  level: 0,
  vehicles: [],      // Array of vehicle state objects
  occupancy: [],      // 6x6 occupancy grid (vehicle id or null)
  timer: TIMER_START,
  timerInterval: null,
  moves: 0,
  gameActive: false,
  startTime: null,
  exitSide: 'right',
  exitIndex: 2,
  rotation: 0,       // Applied rotation in degrees (0/90/180/270)
  tutorialDone: false,
};

// ============================================================
// SECTION 5: ROTATION UTILITIES
// ============================================================

/**
 * Rotate a (row, col) point around the center of a 6x6 grid by `deg` degrees.
 * Returns { row, col }.
 */
function rotateCell(row, col, deg) {
  const maxIdx = GRID_SIZE - 1;
  switch (((deg % 360) + 360) % 360) {
    case 0: return { row, col };
    case 90: return { row: col, col: maxIdx - row };
    case 180: return { row: maxIdx - row, col: maxIdx - col };
    case 270: return { row: maxIdx - col, col: row };
    default: return { row, col };
  }
}

/**
 * Rotate vehicle orientation by deg degrees.
 * H/V flip on 90° or 270°.
 */
function rotateOrient(orient, deg) {
  const norm = ((deg % 360) + 360) % 360;
  if (norm === 90 || norm === 270) return orient === 'H' ? 'V' : 'H';
  return orient;
}

/**
 * Rotate the exit side label.
 */
function rotateExitSide(side, deg) {
  const sides = ['right', 'bottom', 'left', 'top'];
  const steps = Math.round(((deg % 360) + 360) % 360 / 90);
  const idx = sides.indexOf(side);
  return sides[(idx + steps) % 4];
}

/**
 * When we rotate an exit at a given row/col boundary position,
 * we need to transform the exit index too.
 */
function rotateExitIndex(side, index, deg) {
  const maxIdx = GRID_SIZE - 1;
  // Determine the (row, col) of the exit cell on the boundary
  let eRow, eCol;
  switch (side) {
    case 'right': eRow = index; eCol = maxIdx; break;
    case 'left': eRow = index; eCol = 0; break;
    case 'top': eRow = 0; eCol = index; break;
    case 'bottom': eRow = maxIdx; eCol = index; break;
  }
  const { row: nr, col: nc } = rotateCell(eRow, eCol, deg);
  const newSide = rotateExitSide(side, deg);
  switch (newSide) {
    case 'right': return nr;
    case 'left': return nr;
    case 'top': return nc;
    case 'bottom': return nc;
  }
  return index;
}

/**
 * Apply a rotation to the entire level definition.
 * Returns { vehicles, exitSide, exitIndex }.
 */
function applyRotation(levelDef, deg) {
  if (deg === 0) return { ...levelDef };

  const rotatedVehicles = levelDef.vehicles.map(v => {
    // For H vehicles occupying (row, col) and (row, col+1),
    // after rotation the top-left might shift. We rotate the top-left and
    // also rotate the orientation, adjusting for multi-cell direction.
    let { row: r, col: c } = rotateCell(v.row, v.col, deg);
    const newOrient = rotateOrient(v.orient, deg);

    // After rotation, for a V-to-H or H-to-V flip the span direction changes.
    // We also need to ensure the top-left corner is still the minimal (row,col).
    const len = v.type === 'truck' ? 3 : 2;

    // Compute all cells of the vehicle before rotation, rotate each, get min
    const cells = [];
    for (let i = 0; i < len; i++) {
      const cr = v.orient === 'H' ? v.row : v.row + i;
      const cc = v.orient === 'H' ? v.col + i : v.col;
      cells.push(rotateCell(cr, cc, deg));
    }

    // Top-left is min row then min col
    let minRow = Math.min(...cells.map(c => c.row));
    let minCol = Math.min(...cells.map(c => c.col));

    return { ...v, row: minRow, col: minCol, orient: newOrient };
  });

  const newExitSide = rotateExitSide(levelDef.exitSide, deg);
  const newExitIndex = rotateExitIndex(levelDef.exitSide, levelDef.exitIndex, deg);

  return { vehicles: rotatedVehicles, exitSide: newExitSide, exitIndex: newExitIndex };
}

// ============================================================
// SECTION 6: OCCUPANCY GRID HELPERS
// ============================================================

function makeOccupancyGrid() {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
}

function placeVehicle(grid, v) {
  const len = v.type === 'truck' ? 3 : 2;
  for (let i = 0; i < len; i++) {
    const r = v.orient === 'H' ? v.row : v.row + i;
    const c = v.orient === 'H' ? v.col + i : v.col;
    grid[r][c] = v.id;
  }
}

function removeVehicle(grid, v) {
  const len = v.type === 'truck' ? 3 : 2;
  for (let i = 0; i < len; i++) {
    const r = v.orient === 'H' ? v.row : v.row + i;
    const c = v.orient === 'H' ? v.col + i : v.col;
    if (grid[r][c] === v.id) grid[r][c] = null;
  }
}

function rebuildOccupancy() {
  state.occupancy = makeOccupancyGrid();
  state.vehicles.forEach(v => placeVehicle(state.occupancy, v));
}

// ============================================================
// SECTION 7: CELL SIZE & GEOMETRY
// ============================================================
function getCellSize() {
  const gridWrapper = document.getElementById('grid-wrapper');
  const totalGap = (GRID_SIZE - 1) * 3; // grid-gap 3px
  const totalPad = 6; // 3px padding each side
  const inner = gridWrapper.offsetWidth - totalPad;
  return Math.floor((inner - totalGap) / GRID_SIZE);
}

function vehiclePixelPos(v) {
  const cs = getCellSize();
  const gap = 3;
  const pad = 3;
  return {
    x: pad + v.col * (cs + gap),
    y: pad + v.row * (cs + gap),
  };
}

function vehiclePixelSize(v) {
  const cs = getCellSize();
  const gap = 3;
  const len = v.type === 'truck' ? 3 : 2;
  if (v.orient === 'H') {
    return { w: len * cs + (len - 1) * gap, h: cs };
  } else {
    return { w: cs, h: len * cs + (len - 1) * gap };
  }
}

// ============================================================
// SECTION 8: DOM RENDERING
// ============================================================
const gridEl = document.getElementById('game-grid');

function renderGrid() {
  gridEl.innerHTML = '';

  // 1. Background cells
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      gridEl.appendChild(cell);
    }
  }

  // 2. Vehicles
  state.vehicles.forEach(v => {
    const el = document.createElement('div');
    const { x, y } = vehiclePixelPos(v);
    const { w, h } = vehiclePixelSize(v);
    const len = v.type === 'truck' ? 3 : 2;

    el.className = `vehicle ${v.type} ${v.cssClass} orient-${v.orient}`;
    el.id = `veh-${v.id}`;
    el.dataset.id = v.id;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.transform = 'translate(0,0)';
    el.setAttribute('aria-label', `${v.type} ${v.id} at row ${v.row + 1} col ${v.col + 1}`);

    attachDragHandlers(el, v);
    gridEl.appendChild(el);
  });

  // 3. Exit door
  renderExitDoor();
}

function renderExitDoor() {
  // Remove existing
  document.querySelectorAll('.exit-door').forEach(e => e.remove());

  const cs = getCellSize();
  const gap = 3;
  const pad = 3;
  const gridWrapper = document.getElementById('grid-wrapper');

  const door = document.createElement('div');
  door.className = `exit-door exit-${state.exitSide}`;

  const idx = state.exitIndex;
  const cellStart = pad + idx * (cs + gap);

  switch (state.exitSide) {
    case 'right':
      door.style.width = '12px';
      door.style.height = `${cs}px`;
      door.style.right = '-14px';
      door.style.top = `${cellStart}px`;
      break;
    case 'left':
      door.style.width = '12px';
      door.style.height = `${cs}px`;
      door.style.left = '-14px';
      door.style.top = `${cellStart}px`;
      break;
    case 'top':
      door.style.height = '12px';
      door.style.width = `${cs}px`;
      door.style.top = '-14px';
      door.style.left = `${cellStart}px`;
      break;
    case 'bottom':
      door.style.height = '12px';
      door.style.width = `${cs}px`;
      door.style.bottom = '-14px';
      door.style.left = `${cellStart}px`;
      break;
  }

  gridWrapper.appendChild(door);
}

// ============================================================
// SECTION 9: DRAG & DROP (TOUCH + MOUSE)
// ============================================================
function attachDragHandlers(el, vehicleRef) {
  // Touch events (primary, mobile-first)
  el.addEventListener('touchstart', onDragStart, { passive: false });
  // Mouse fallback for desktop testing
  el.addEventListener('mousedown', onDragStart, { passive: false });
}

let drag = null; // Active drag state

function onDragStart(e) {
  if (!state.gameActive) return;
  e.preventDefault();
  e.stopPropagation();

  const clientPos = getClientPos(e);
  const id = e.currentTarget.dataset.id;
  const v = state.vehicles.find(x => x.id === id);
  if (!v) return;

  // Dismiss tutorial overlay on first interaction
  if (!state.tutorialDone) {
    dismissTutorial();
  }

  const el = document.getElementById(`veh-${id}`);
  const rect = el.getBoundingClientRect();
  const gridRect = gridEl.getBoundingClientRect();

  drag = {
    v,
    el,
    startClientX: clientPos.x,
    startClientY: clientPos.y,
    startX: v.col,
    startY: v.row,
    currentDelta: 0,   // cells moved
    gridRect,
    moved: false,
  };

  el.classList.add('dragging');

  document.addEventListener('touchmove', onDragMove, { passive: false });
  document.addEventListener('touchend', onDragEnd, { passive: false });
  document.addEventListener('mousemove', onDragMove, { passive: false });
  document.addEventListener('mouseup', onDragEnd, { passive: false });
}

function onDragMove(e) {
  if (!drag) return;
  e.preventDefault();

  const clientPos = getClientPos(e);
  const cs = getCellSize();
  const gap = 3;
  const step = cs + gap;

  const dx = clientPos.x - drag.startClientX;
  const dy = clientPos.y - drag.startClientY;

  const { v, el } = drag;

  if (v.orient === 'H') {
    // Constrain to horizontal only
    const maxPositiveCells = GRID_SIZE - v.col - (v.type === 'truck' ? 3 : 2);
    const maxNegativeCells = v.col;

    const clamped = Math.max(-maxNegativeCells * step, Math.min(maxPositiveCells * step, dx));
    el.style.transform = `translate(${clamped}px, 0)`;
    drag.currentPixelDelta = clamped;
    drag.moved = Math.abs(dx) > 4;
  } else {
    const len = v.type === 'truck' ? 3 : 2;
    const maxPositiveCells = GRID_SIZE - v.row - len;
    const maxNegativeCells = v.row;

    // We also need to check real occupancy while dragging for visual feedback
    const clamped = Math.max(-maxNegativeCells * step, Math.min(maxPositiveCells * step, dy));
    el.style.transform = `translate(0, ${clamped}px)`;
    drag.currentPixelDelta = clamped;
    drag.moved = Math.abs(dy) > 4;
  }
}

function onDragEnd(e) {
  if (!drag) return;
  e.preventDefault();

  document.removeEventListener('touchmove', onDragMove);
  document.removeEventListener('touchend', onDragEnd);
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);

  const { v, el } = drag;
  const cs = getCellSize();
  const gap = 3;
  const step = cs + gap;

  const pixelDelta = drag.currentPixelDelta || 0;
  const rawCells = pixelDelta / step;
  const snapCells = Math.round(rawCells);

  let moved = false;

  if (snapCells !== 0) {
    // Validate with occupancy
    const actualCells = tryMove(v, snapCells);
    if (actualCells !== 0) {
      // Apply move
      removeVehicle(state.occupancy, v);
      if (v.orient === 'H') {
        v.col += actualCells;
      } else {
        v.row += actualCells;
      }
      placeVehicle(state.occupancy, v);

      // Update DOM position
      const { x, y } = vehiclePixelPos(v);
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.transform = 'translate(0, 0)';

      state.moves++;
      updateMovesDisplay();

      // Check win condition
      if (checkWin(v)) {
        animateWin(v, el);
      }

      moved = true;
    }
  }

  // Snap back if no move
  if (!moved) {
    el.style.transform = 'translate(0, 0)';
  }

  el.classList.remove('dragging');
  drag = null;
}

/**
 * Calculate how many cells a vehicle can actually move in direction `cells`.
 * Respects occupancy. Returns the clamped cell count (may be 0).
 */
function tryMove(v, cells) {
  const len = v.type === 'truck' ? 3 : 2;
  const sign = cells > 0 ? 1 : -1;
  let able = 0;

  for (let step = 1; step <= Math.abs(cells); step++) {
    if (v.orient === 'H') {
      const testCol = v.col + sign * step + (sign > 0 ? len - 1 : 0) - (sign > 0 ? 0 : 0);
      // Leading edge column
      const leadCol = sign > 0 ? v.col + len - 1 + step : v.col - step;
      if (leadCol < 0 || leadCol >= GRID_SIZE) break;
      const occId = state.occupancy[v.row][leadCol];
      if (occId !== null && occId !== v.id) break;
    } else {
      const leadRow = sign > 0 ? v.row + len - 1 + step : v.row - step;
      if (leadRow < 0 || leadRow >= GRID_SIZE) break;
      const occId = state.occupancy[leadRow][v.col];
      if (occId !== null && occId !== v.id) break;
    }
    able = step * sign;
  }

  return able;
}

/**
 * Check if the red car has reached the exit.
 */
function checkWin(v) {
  if (v.id !== 'redcar') return false;
  const len = v.type === 'truck' ? 3 : 2;

  switch (state.exitSide) {
    case 'right':
      return v.orient === 'H' && v.row === state.exitIndex && v.col + len === GRID_SIZE;
    case 'left':
      return v.orient === 'H' && v.row === state.exitIndex && v.col === 0;
    case 'bottom':
      return v.orient === 'V' && v.col === state.exitIndex && v.row + len === GRID_SIZE;
    case 'top':
      return v.orient === 'V' && v.col === state.exitIndex && v.row === 0;
    default:
      return false;
  }
}

// ============================================================
// SECTION 10: TOUCH / MOUSE POSITION HELPER
// ============================================================
function getClientPos(e) {
  if (e.touches && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  if (e.changedTouches && e.changedTouches.length > 0) {
    return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

// ============================================================
// SECTION 11: TIMER
// ============================================================
function startTimer() {
  clearInterval(state.timerInterval);
  state.timer = TIMER_START;
  renderTimer();

  state.timerInterval = setInterval(() => {
    state.timer--;
    renderTimer();

    if (state.timer <= 0) {
      clearInterval(state.timerInterval);
      onTimeout();
    }
  }, 1000);
}

function renderTimer() {
  const m = Math.floor(state.timer / 60).toString().padStart(2, '0');
  const s = (state.timer % 60).toString().padStart(2, '0');
  const el = document.getElementById('timer-display');
  el.textContent = `${m}:${s}`;

  el.classList.remove('warning', 'critical');
  if (state.timer <= 10) {
    el.classList.add('critical');
  } else if (state.timer <= 30) {
    el.classList.add('warning');
  }
}

function updateMovesDisplay() {
  document.getElementById('moves-display').textContent = state.moves;
}

// ============================================================
// SECTION 12: WIN / TIMEOUT / GAME FLOW
// ============================================================
function animateWin(v, el) {
  clearInterval(state.timerInterval);
  state.gameActive = false;

  const timeTakenMS = Date.now() - state.startTime;

  // Flash effect
  const flash = document.getElementById('win-flash');
  flash.classList.add('active');
  setTimeout(() => flash.classList.remove('active'), 700);

  // Particles
  launchParticles();

  // Slide car out of grid
  const offset = state.exitSide === 'right' ? 200 :
    state.exitSide === 'left' ? -200 :
      state.exitSide === 'bottom' ? 200 : -200;
  if (state.exitSide === 'right' || state.exitSide === 'left') {
    el.style.transition = 'transform 0.4s ease-in';
    el.style.transform = `translate(${offset}px, 0)`;
  } else {
    el.style.transition = 'transform 0.4s ease-in';
    el.style.transform = `translate(0, ${offset}px)`;
  }

  // Tutorial complete → auto-advance to Level 2 (the only competitive level), no modal
  if (state.level === 0) {
    setTimeout(() => {
      showToast('🎉 Tutorial done! Starting the challenge...');
      setTimeout(() => startLevel(2), 800);
    }, 500);
    return;
  }

  // Competitive levels → show leaderboard form
  setTimeout(() => showResultModal(true, timeTakenMS), 700);
}

function onTimeout() {
  state.gameActive = false;
  const timeTakenMS = Date.now() - state.startTime;

  // Tutorial timeout → silently restart it, no modal
  if (state.level === 0) {
    showToast("⏰ Time's up! Try the tutorial again.");
    setTimeout(() => startLevel(0), 800);
    return;
  }

  // Competitive levels → show result modal
  showToast("⏰ Time's up!");
  setTimeout(() => showResultModal(false, timeTakenMS), 600);
}

// ============================================================
// SECTION 13: RESULT MODAL
// ============================================================
function showResultModal(won, timeTakenMS) {
  const backdrop = document.getElementById('modal-backdrop');
  const icon = document.getElementById('modal-icon');
  const title = document.getElementById('modal-title');
  const subtitle = document.getElementById('modal-subtitle');
  const timeStat = document.getElementById('stat-time');
  const movesStat = document.getElementById('stat-moves');
  const submitBtn = document.getElementById('submit-btn');

  icon.textContent = won ? '🏆' : '⏰';
  title.textContent = won ? 'PUZZLE SOLVED!' : 'TIME\'S UP!';
  subtitle.textContent = won
    ? 'Tap any car to move it to the exit!'
    : 'Better luck next time. Try again!';

  const secs = Math.floor(timeTakenMS / 1000);
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  timeStat.textContent = `${m}:${s}`;
  movesStat.textContent = state.moves;

  submitBtn.disabled = false;
  submitBtn.innerHTML = '🚀 Submit to Leaderboard';

  // Store for submission
  submitBtn.dataset.timeTakenMS = timeTakenMS;
  submitBtn.dataset.won = won;

  backdrop.classList.add('visible');
}

function hideModal() {
  document.getElementById('modal-backdrop').classList.remove('visible');
}

// ============================================================
// SECTION 14: FORM SUBMISSION
// ============================================================
document.getElementById('submit-btn').addEventListener('click', async () => {
  const nickname = document.getElementById('nickname-input').value.trim();
  const email = document.getElementById('email-input').value.trim();
  const wantsOffer = document.getElementById('offer-checkbox').checked;
  const btn = document.getElementById('submit-btn');
  const timeTakenMS = parseInt(btn.dataset.timeTakenMS, 10);
  const won = btn.dataset.won === 'true';

  if (!nickname || !email) {
    showToast('⚠️ Please fill in nickname and email');
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('⚠️ Please enter a valid email');
    return;
  }

  // Show loading
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Uploading...';

  try {
    await submitGameData({
      nickname,
      email,
      timeTakenMS,
      moves: state.moves,
      wantsOffer,
      won,
      level: state.level,
    });
    showToast('✅ Score submitted!');
    hideModal();
    showToast('🎉 Check the leaderboard!');
    setTimeout(() => startLevel(state.level), 800);
  } catch (err) {
    console.error('[Submit]', err);
    btn.innerHTML = '❌ Failed — Retry';
    btn.disabled = false;
    showToast('❌ Submission failed. Check credentials.');
  }
});

document.getElementById('play-again-btn').addEventListener('click', () => {
  hideModal();
  startLevel(state.level);
});

// ============================================================
// SECTION 15: TUTORIAL
// ============================================================
function showTutorial() {
  const overlay = document.getElementById('tutorial-overlay');
  overlay.classList.remove('hidden');
  state.tutorialDone = false;
}

function dismissTutorial() {
  const overlay = document.getElementById('tutorial-overlay');
  overlay.classList.add('hidden');
  state.tutorialDone = true;
}

document.getElementById('tutorial-overlay').addEventListener('click', dismissTutorial);
document.getElementById('tutorial-overlay').addEventListener('touchend', dismissTutorial, { passive: false });

// ============================================================
// SECTION 16: LEVEL INITIALIZATION
// ============================================================
function startLevel(levelNum) {
  clearInterval(state.timerInterval);
  state.level = levelNum;
  state.moves = 0;
  state.gameActive = false;
  drag = null;

  updateMovesDisplay();
  document.getElementById('level-badge').textContent =
    levelNum === 0 ? 'TUTORIAL' : 'CHALLENGE';

  const levelDef = LEVELS[levelNum];
  if (!levelDef) {
    console.error(`Level ${levelNum} not defined`);
    return;
  }

  // Level 2: apply random rotation for anti-cheat (prevents memorisation)
  let finalDef = levelDef;
  if (levelNum === 2) {
    const angles = [0, 90, 180, 270];
    const rotation = angles[Math.floor(Math.random() * angles.length)];
    state.rotation = rotation;
    finalDef = applyRotation(levelDef, rotation);
    console.log(`[Anti-cheat] Level ${levelNum} rotated ${rotation}°`);
  } else {
    state.rotation = 0;
  }

  // Deep copy vehicles
  state.vehicles = finalDef.vehicles.map(v => ({ ...v }));
  state.exitSide = finalDef.exitSide;
  state.exitIndex = finalDef.exitIndex;

  rebuildOccupancy();
  renderGrid();

  // Show tutorial overlay for level 0
  if (levelNum === 0) {
    showTutorial();
  } else {
    const overlay = document.getElementById('tutorial-overlay');
    overlay.classList.add('hidden');
    state.tutorialDone = true;
  }

  state.moves = 0;
  state.startTime = Date.now();
  state.gameActive = true;

  startTimer();
}

// ============================================================
// SECTION 17: BUTTON HANDLERS
// ============================================================
document.getElementById('btn-restart').addEventListener('click', () => {
  startLevel(state.level);
});

document.getElementById('btn-level0').addEventListener('click', () => {
  startLevel(0);
});


document.getElementById('btn-level2').addEventListener('click', () => {
  startLevel(2);
});

// ============================================================
// SECTION 18: PARTICLES (Win celebration)
// ============================================================
function launchParticles() {
  const canvas = document.getElementById('particle-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.classList.add('active');

  const colors = ['#00d4ff', '#00ff88', '#ff3366', '#ffaa00', '#b066ff'];
  const particles = Array.from({ length: 80 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height * 0.5,
    vx: (Math.random() - 0.5) * 6,
    vy: Math.random() * -4 - 2,
    size: Math.random() * 8 + 3,
    color: colors[Math.floor(Math.random() * colors.length)],
    life: 1,
    decay: Math.random() * 0.02 + 0.008,
    gravity: 0.12,
  }));

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    particles.forEach(p => {
      if (p.life <= 0) return;
      alive = true;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.life -= p.decay;

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    if (alive) {
      requestAnimationFrame(animate);
    } else {
      canvas.classList.remove('active');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  requestAnimationFrame(animate);
}

// ============================================================
// SECTION 19: TOAST NOTIFICATIONS
// ============================================================
let toastTimer = null;

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// ============================================================
// SECTION 20: WINDOW RESIZE — re-render grid geometry
// ============================================================
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (state.vehicles.length > 0) renderGrid();
  }, 150);
});

// ============================================================
// SECTION 21: BOOT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initFirebase();
  startLevel(0); // Start with tutorial
});
