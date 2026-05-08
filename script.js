// CONFIG
const SHEET_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbznPkMpl4pUYNqtOL-_5E0MGwOoBoo4acHQ2qeXOlKBwLripBmL-l83XkOEaJscBhBOIQ/exec";
const SUBMIT_SECRET = "!@ghfjrcx";  // harus sama dengan Apps Script

// GAME CONFIG
const BOARD_SIZE = 8;
const ECOSYSTEMS = 8; // sudah ditambah 1 gambar lagi (rialo1.png ... rialo8.png)
const THRESHOLD_SCORE = 500;
const GAME_DURATION_SEC = 60; // 1 minute

// state
let board = [];
let score = 0;
let gameTimerId = null;
let timeLeft = GAME_DURATION_SEC;
let gameActive = false;

// Hint state
let lastActionAt = Date.now();
let hintShown = false;
const HINT_COST_MANUAL = 10;
const HINT_COST_AUTO = 5;


const startBtn = document.getElementById('startBtn');
const overlay = null;
const gameDiv = document.getElementById('game');
const scoreSpan = document.getElementById('score');
const timerEl = document.getElementById('timer');
const boardDiv = document.getElementById('board');

let discordName = "";
let walletAddress = "";

const newStartBtn = document.getElementById('newStartBtn');

if(newStartBtn){
  newStartBtn.addEventListener('click', () => {

    discordName = "guest";
    walletAddress = "guest";

    startGame();
  });
}

function startGame() {
  // idle watcher for hints
  lastActionAt = Date.now();
  if (!window.__hintIdleInterval){ window.__hintIdleInterval = setInterval(()=>{
    if (!gameActive) return;
    const idle = Date.now() - lastActionAt;
    if (idle > 6000 && !hintShown) {
      if (showHint()) { try{ score = Math.max(0, Number(score||0) - HINT_COST_AUTO); scoreSpan.textContent = score; }catch(e){} }
    }
  }, 1000); }
  score = 0;
  timeLeft = GAME_DURATION_SEC;
  gameActive = true;
  SFX.start.currentTime = 0;
  SFX.start.play();
  // tampilkan game lagi
gameDiv.classList.remove('hidden');

// reset board baru
initBoard();
  scoreSpan.textContent = score;
  timerEl.textContent = `Time: ${timeLeft}s`;
  // start countdown
  gameTimerId = setInterval(() => {
    timeLeft--;
    timerEl.textContent = `Time: ${timeLeft}s`;
   if (timeLeft <= 0) {

  clearInterval(gameTimerId);

  timeLeft = 0;

  timerEl.textContent = `Time: 0s`;

  endGame();

  return;
}
  }, 1000);
}

function initBoard() {
  board = [];
  boardDiv.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, 75px)`;
  boardDiv.innerHTML = '';
  for (let r = 0; r < BOARD_SIZE; r++) {
    board[r] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      const type = Math.floor(Math.random() * ECOSYSTEMS) + 1;
      board[r][c] = type;
      const tile = createTile(type, r, c);
      boardDiv.appendChild(tile);
    }
  }
}

function createTile(type, r, c) {
  const tile = document.createElement('div');
  tile.className = 'tile';
  tile.style.backgroundImage = `url(assets/rialo${type}.png)`;
  tile.dataset.row = r;
  tile.dataset.col = c;
  tile.addEventListener('click', tileClick);
  return tile;
}

let firstTile = null;
function tileClick(e) {
  lastActionAt = Date.now();
  clearHints();
  if (!gameActive) return;
  const tile = e.currentTarget;
  if (!firstTile) {
    firstTile = tile;
    tile.style.outline = '3px solid rgba(255,255,255,0.6)';
    return;
  }
  swapTiles(firstTile, tile);
  firstTile.style.outline = 'none';
  firstTile = null;
}

function swapTiles(t1, t2) {

  const r1 = Number(t1.dataset.row);
  const c1 = Number(t1.dataset.col);

  const r2 = Number(t2.dataset.row);
  const c2 = Number(t2.dataset.col);

  const dr = Math.abs(r1 - r2);
  const dc = Math.abs(c1 - c2);

  // hanya tile samping
  if (dr + dc !== 1) return;

  // swap data
  const temp = board[r1][c1];

  board[r1][c1] = board[r2][c2];
  board[r2][c2] = temp;

  // update visual
  t1.style.backgroundImage =
    `url(assets/rialo${board[r1][c1]}.png)`;

  t2.style.backgroundImage =
    `url(assets/rialo${board[r2][c2]}.png)`;

  try {

  SFX.swap.currentTime = 0;

  SFX.swap.play();

} catch(e){}

  // cek apakah swap menghasilkan match
  const matched =
    hasAnyMatchAt(r1, c1) ||
    hasAnyMatchAt(r2, c2);

  // kalau tidak match → balik lagi
  if (!matched) {
    SFX.invalid.currentTime = 0;
    SFX.invalid.play();

    setTimeout(() => {

      const tempBack = board[r1][c1];

      board[r1][c1] = board[r2][c2];
      board[r2][c2] = tempBack;

      t1.style.backgroundImage =
        `url(assets/rialo${board[r1][c1]}.png)`;

      t2.style.backgroundImage =
        `url(assets/rialo${board[r2][c2]}.png)`;

    }, 140);

    return;
  }

  // kalau match → lanjut resolve
  setTimeout(() => {

    clearHints();

    checkMatchesAndResolve();

  }, 120);
}

function checkMatchesAndResolve() {
  const toClear = new Set();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE - 2; c++) {
      const t = board[r][c];
      if (t === board[r][c+1] && t === board[r][c+2]) {
        toClear.add(`${r},${c}`); toClear.add(`${r},${c+1}`); toClear.add(`${r},${c+2}`);
      }
    }
  }
  for (let c = 0; c < BOARD_SIZE; c++) {
    for (let r = 0; r < BOARD_SIZE - 2; r++) {
      const t = board[r][c];
      if (t === board[r+1][c] && t === board[r+2][c]) {
        toClear.add(`${r},${c}`); toClear.add(`${r+1},${c}`); toClear.add(`${r+2},${c}`);
      }
    }
  }
  if (toClear.size === 0) return;
  SFX.match.currentTime = 0;
  SFX.match.play();
  const gained = toClear.size * 10;
  score += gained;
  scoreSpan.textContent = score;
  for (const key of toClear) {
    const [r,c] = key.split(',').map(Number);
    board[r][c] = null;
    const tileEl = document.querySelector(`.tile[data-row='${r}'][data-col='${c}']`);
    if (tileEl) tileEl.style.opacity = '0.35';
  }
  for (let c = 0; c < BOARD_SIZE; c++) {
    const col = [];
    for (let r = BOARD_SIZE - 1; r >= 0; r--) col.push(board[r][c]);
    const filtered = col.filter(v => v !== null);
    while (filtered.length < BOARD_SIZE) filtered.push(Math.floor(Math.random() * ECOSYSTEMS) + 1);
    for (let r = BOARD_SIZE - 1, k = 0; k < BOARD_SIZE; k++, r--) {
      board[r][c] = filtered[k];
    }
  }
  reRenderBoard();
  clearHints();
  setTimeout(checkMatchesAndResolve, 160);
}

function reRenderBoard() {
  boardDiv.innerHTML = '';
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const tile = createTile(board[r][c], r, c);
      boardDiv.appendChild(tile);
    }
  }
}

function endGame() {
  if (!gameActive) return;
  gameActive = false;
  clearInterval(gameTimerId);
  if (score >= THRESHOLD_SCORE) {
    submitToSheet({ discordName, walletAddress, score })
      .then(ok => {
        if (ok) alert(`🌊 Pod Recharged Successfully!\n\nTotal Energy: ${score}`);
        else alert(`🌊 Pod Fully Recharged!\n\nTotal Energy: ${score}`);
      });
  } else {
    alert(`🌊 Recharge Failed\n\nEnergy Collected: ${score}\nRequired Energy: ${THRESHOLD_SCORE}`);
  }
  gameDiv.classList.add('hidden');
}

async function submitToSheet(payload) {
  const body = {
    secret: SUBMIT_SECRET,
    discordName: payload.discordName,
    walletAddress: payload.walletAddress,
    score: payload.score
  };
  try {
    const res = await fetch(SHEET_WEBHOOK_URL, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    const txt = await res.text();
    console.log('Sheet response:', txt);
    return res.ok;
  } catch (err) {
    console.error('Submit error', err);
    return false;
  }
}

/* HUD SYNC (append-only) */
(function(){
  function set(id, v){ const el=document.getElementById(id); if(el) el.textContent=String(v); }
  function renderHUD(){
    try {
      set('scoreTop', score);
      set('scoreBig', score);
      set('thresholdNum', score);
      const t = (typeof timeLeft!=='undefined'? timeLeft : 0) + 's';
      set('timeTop', t); set('timeLeftBig', t);
      // best
      const best = Math.max(Number(localStorage.getItem('bestScore')||0), Number(score||0));
      localStorage.setItem('bestScore', best); set('bestPill', best);
      // bar
      const bar=document.getElementById('progressBar');
      if (bar){ const pct=Math.max(0,Math.min(100,Math.round((Number(score||0)/THRESHOLD_SCORE)*100))); bar.style.width=pct+'%'; }
    } catch(e){}
  }
  setInterval(renderHUD, 200);
})();

const SFX = {

  swap: new Audio("assets/sfx/swap.wav"),

  invalid: new Audio("assets/sfx/invalid.wav"),

  match: new Audio("assets/sfx/match.wav"),

  combo: new Audio("assets/sfx/combo.wav"),

  start: new Audio("assets/sfx/start.wav")

};



function clearHints(){
  try{
    document.querySelectorAll('.tile.hint').forEach(el=>el.classList.remove('hint'));
  }catch(e){}
  hintShown = false;
}

function hasAnyMatchAt(r,c){
  const t = board[r][c];
  if (t == null) return false;
  // horizontal
  let count = 1;
  for (let j=c-1; j>=0 && board[r][j]===t; j--) count++;
  for (let j=c+1; j<BOARD_SIZE && board[r][j]===t; j++) count++;
  if (count>=3) return true;
  // vertical
  count = 1;
  for (let i=r-1; i>=0 && board[i][c]===t; i--) count++;
  for (let i=r+1; i<BOARD_SIZE && board[i][c]===t; i++) count++;
  return count>=3;
}

function wouldCreateMatch(r1,c1,r2,c2){
  const a = board[r1][c1], b = board[r2][c2];
  board[r1][c1] = b; board[r2][c2] = a;
  const ok = hasAnyMatchAt(r1,c1) || hasAnyMatchAt(r2,c2);
  board[r1][c1] = a; board[r2][c2] = b;
  return ok;
}

function findAnyHint(){
  for (let r=0;r<BOARD_SIZE;r++){
    for (let c=0;c<BOARD_SIZE;c++){
      if (c+1<BOARD_SIZE && wouldCreateMatch(r,c,r,c+1)) return [[r,c],[r,c+1]];
      if (r+1<BOARD_SIZE && wouldCreateMatch(r,c,r+1,c)) return [[r,c],[r+1,c]];
    }
  }
  return null;
}

function showHint(){
  const pair = findAnyHint();
  if (!pair) return false;
  clearHints();
  pair.forEach(([r,c])=>{
    const el = document.querySelector(`.tile[data-row='${r}'][data-col='${c}']`);
    if (el) el.classList.add('hint');
  });
  hintShown = true;
  return true;
}

// Hint button (optional)
(function(){
  const btn = document.getElementById('hintBtn');
  if (!btn) return;
  btn.addEventListener('click', ()=>{
    lastActionAt = Date.now();
    if (showHint()){
      try { score = Math.max(0, Number(score||0) - HINT_COST_MANUAL); scoreSpan.textContent = score; } catch(e){}
    }
  });
})();

initBoard();