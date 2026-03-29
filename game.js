const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const diplomaCanvas = document.getElementById("diplomaCanvas");
const diplomaCtx = diplomaCanvas.getContext("2d");

const introOverlay = document.getElementById("introOverlay");
const stageOverlay = document.getElementById("stageOverlay");
const diplomaOverlay = document.getElementById("diplomaOverlay");
const stageOverlayTitle = document.getElementById("stageOverlayTitle");
const stageOverlayText = document.getElementById("stageOverlayText");
const diplomaMessage = document.getElementById("diplomaMessage");
const diplomaMetrics = document.getElementById("diplomaMetrics");
const rankValue = document.getElementById("rankValue");
const statusLine = document.getElementById("statusLine");
const copyStatus = document.getElementById("copyStatus");

const scoreValue = document.getElementById("scoreValue");
const stageValue = document.getElementById("stageValue");
const livesValue = document.getElementById("livesValue");
const bestValue = document.getElementById("bestValue");

const STORAGE_KEY = "starward-defenders-best";
const WORLD = { width: canvas.width, height: canvas.height };
const keys = { left: false, right: false, fire: false };
const pointer = { left: false, right: false, fire: false };
const stars = Array.from({ length: 140 }, () => ({
  x: Math.random() * WORLD.width,
  y: Math.random() * WORLD.height,
  speed: 18 + Math.random() * 45,
  size: Math.random() * 2 + 0.8
}));

const SHIELD_PATTERN = [
  "     ##########     ",
  "   ##############   ",
  "  ################  ",
  " ################## ",
  "####################",
  "####################",
  "####################",
  "########    ########",
  "#######      #######",
  "######        ######",
  "#####          #####"
];
const SHIELD_CELL_SIZE = 4;

const levelConfigs = [
  { rows: 3, cols: 6, enemySpeed: 45, drop: 16, fireDelay: 1.8, bulletSpeed: 205, enemySize: 28, move: "march", shields: 4, maxShots: 1, scoreBase: 20, desc: "The scouts arrive slowly. Learn the rhythm." },
  { rows: 3, cols: 7, enemySpeed: 56, drop: 18, fireDelay: 1.6, bulletSpeed: 225, enemySize: 28, move: "march", shields: 4, maxShots: 1, scoreBase: 24, desc: "Wider formation, quicker step, tighter firing windows." },
  { rows: 4, cols: 7, enemySpeed: 66, drop: 18, fireDelay: 1.45, bulletSpeed: 240, enemySize: 26, move: "march", shields: 4, maxShots: 2, scoreBase: 28, desc: "The second rank joins, and overlapping fire begins." },
  { rows: 4, cols: 8, enemySpeed: 76, drop: 20, fireDelay: 1.32, bulletSpeed: 250, enemySize: 26, move: "sway", shields: 3, maxShots: 2, scoreBase: 32, desc: "A lateral sway disrupts easy aiming." },
  { rows: 5, cols: 8, enemySpeed: 88, drop: 22, fireDelay: 1.2, bulletSpeed: 270, enemySize: 24, move: "sway", shields: 3, maxShots: 2, scoreBase: 36, desc: "More hulls, fewer shields, faster punishment." },
  { rows: 5, cols: 9, enemySpeed: 104, drop: 22, fireDelay: 1.05, bulletSpeed: 292, enemySize: 24, move: "dive", shields: 3, maxShots: 3, scoreBase: 40, desc: "Raiders peel off and dive toward your lane." },
  { rows: 5, cols: 9, enemySpeed: 120, drop: 24, fireDelay: 0.95, bulletSpeed: 312, enemySize: 22, move: "dive", shields: 2, maxShots: 3, scoreBase: 46, desc: "Dive attacks intensify, and bullets travel harder." },
  { rows: 6, cols: 9, enemySpeed: 136, drop: 24, fireDelay: 0.88, bulletSpeed: 332, enemySize: 22, move: "zigzag", shields: 2, maxShots: 3, scoreBase: 52, desc: "Dense assault wings zigzag across the sky." },
  { rows: 6, cols: 10, enemySpeed: 154, drop: 26, fireDelay: 0.8, bulletSpeed: 352, enemySize: 20, move: "zigzag", shields: 1, maxShots: 4, scoreBase: 58, desc: "Almost no shelter remains. The fleet crowds the field." },
  { rows: 6, cols: 10, enemySpeed: 174, drop: 28, fireDelay: 0.72, bulletSpeed: 375, enemySize: 20, move: "storm", shields: 1, maxShots: 5, scoreBase: 66, desc: "Final storm. Maximum speed, crossfire, and relentless descent." }
];

const state = {
  running: false,
  lastTime: 0,
  mode: "intro",
  bestScore: Number(localStorage.getItem(STORAGE_KEY) || 0),
  stage: 1,
  score: 0,
  lives: 3,
  shotsFired: 0,
  shotsHit: 0,
  enemiesDestroyed: 0,
  player: null,
  playerBullets: [],
  enemyBullets: [],
  particles: [],
  enemies: [],
  shields: [],
  formation: null,
  lastDiplomaRecord: null,
  stageIntroGrace: 0,
  lastDefeatReason: null,
  audio: {
    ctx: null,
    enabled: false
  }
};

bestValue.textContent = state.bestScore;

function getBaseLineY() {
  return WORLD.height - 6;
}

function getCitadelRect() {
  return {
    x: 0,
    y: WORLD.height - 52,
    width: WORLD.width,
    height: 52
  };
}

function createPlayer() {
  state.player = {
    width: 48,
    height: 24,
    x: WORLD.width / 2 - 24,
    y: WORLD.height - 76,
    speed: 320,
    cooldown: 0,
    invulnerable: 0
  };
}

function createShieldMask() {
  return SHIELD_PATTERN.map((row) => [...row].map((cell) => cell === "#"));
}

function countShieldCells(mask) {
  let total = 0;
  for (const row of mask) {
    for (const cell of row) {
      if (cell) {
        total += 1;
      }
    }
  }
  return total;
}

function createShields(count) {
  if (!count) {
    return [];
  }

  const shields = [];
  const width = SHIELD_PATTERN[0].length * SHIELD_CELL_SIZE;
  const height = SHIELD_PATTERN.length * SHIELD_CELL_SIZE;
  const gap = WORLD.width / (count + 1);
  for (let i = 0; i < count; i += 1) {
    const mask = createShieldMask();
    shields.push({
      x: gap * (i + 1) - width / 2,
      y: WORLD.height - 174,
      width,
      height,
      cellSize: SHIELD_CELL_SIZE,
      mask,
      cellsAlive: countShieldCells(mask)
    });
  }
  return shields;
}

function shieldHasCells(shield) {
  return shield.cellsAlive > 0;
}

function findShieldImpact(shield, bullet) {
  if (!shieldHasCells(shield) || !overlaps(bullet, shield)) {
    return null;
  }

  const cellSize = shield.cellSize;
  const startCol = Math.max(0, Math.floor((bullet.x - shield.x) / cellSize));
  const endCol = Math.min(shield.mask[0].length - 1, Math.floor((bullet.x + bullet.width - shield.x) / cellSize));
  const startRow = Math.max(0, Math.floor((bullet.y - shield.y) / cellSize));
  const endRow = Math.min(shield.mask.length - 1, Math.floor((bullet.y + bullet.height - shield.y) / cellSize));

  for (let row = startRow; row <= endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      if (!shield.mask[row][col]) {
        continue;
      }

      const cellRect = {
        x: shield.x + col * cellSize,
        y: shield.y + row * cellSize,
        width: cellSize,
        height: cellSize
      };
      if (overlaps(bullet, cellRect)) {
        return {
          x: bullet.x + bullet.width / 2,
          y: bullet.y + bullet.height / 2
        };
      }
    }
  }

  return null;
}

function erodeShield(shield, impactX, impactY, radiusX, radiusY) {
  let removed = 0;
  const cellSize = shield.cellSize;

  for (let row = 0; row < shield.mask.length; row += 1) {
    for (let col = 0; col < shield.mask[row].length; col += 1) {
      if (!shield.mask[row][col]) {
        continue;
      }

      const centerX = shield.x + col * cellSize + cellSize / 2;
      const centerY = shield.y + row * cellSize + cellSize / 2;
      const dx = (centerX - impactX) / radiusX;
      const dy = (centerY - impactY) / radiusY;

      if (dx * dx + dy * dy <= 1) {
        shield.mask[row][col] = false;
        removed += 1;
      }
    }
  }

  shield.cellsAlive = Math.max(0, shield.cellsAlive - removed);
  return removed;
}

function buildStage(stageNumber) {
  const cfg = levelConfigs[stageNumber - 1];
  const paddingX = 72;
  const spacingX = cfg.enemySize + 18;
  const spacingY = cfg.enemySize + 14;
  const startX = Math.max(paddingX, (WORLD.width - ((cfg.cols - 1) * spacingX + cfg.enemySize)) / 2);
  const startY = 86;

  state.playerBullets = [];
  state.enemyBullets = [];
  state.particles = [];
  state.enemies = [];
  state.shields = createShields(cfg.shields);
  state.formation = {
    direction: 1,
    speed: cfg.enemySpeed,
    drop: cfg.drop,
    fireDelay: cfg.fireDelay,
    bulletSpeed: cfg.bulletSpeed,
    maxShots: cfg.maxShots,
    move: cfg.move,
    lastFire: 0,
    elapsed: 0
  };

  for (let row = 0; row < cfg.rows; row += 1) {
    for (let col = 0; col < cfg.cols; col += 1) {
      state.enemies.push({
        x: startX + col * spacingX,
        y: startY + row * spacingY,
        baseX: startX + col * spacingX,
        baseY: startY + row * spacingY,
        width: cfg.enemySize,
        height: cfg.enemySize * 0.7,
        alive: true,
        row,
        col,
        score: cfg.scoreBase + (cfg.rows - row - 1) * 6,
        dive: 0,
        zigSeed: Math.random() * Math.PI * 2
      });
    }
  }

  state.stageIntroGrace = 0.9;
  state.lastDefeatReason = null;
  stageValue.textContent = stageNumber + " / 10";
  statusLine.textContent = "Stage " + stageNumber + ": " + cfg.desc;
}

function syncHud() {
  scoreValue.textContent = state.score;
  stageValue.textContent = state.stage + " / 10";
  livesValue.textContent = state.lives;
  bestValue.textContent = state.bestScore;
}

function resetCampaign() {
  state.stage = 1;
  state.score = 0;
  state.lives = 3;
  state.shotsFired = 0;
  state.shotsHit = 0;
  state.enemiesDestroyed = 0;
  state.lastDiplomaRecord = null;
  state.lastDefeatReason = null;
  state.mode = "playing";
  introOverlay.classList.add("hidden");
  stageOverlay.classList.add("hidden");
  diplomaOverlay.classList.add("hidden");
  copyStatus.textContent = "Generate a record and copy the diploma image to share it.";
  createPlayer();
  buildStage(state.stage);
  syncHud();
  ensureAudio();
  playSound("start");
}

function startLoop() {
  if (!state.running) {
    state.running = true;
    state.lastTime = performance.now();
    requestAnimationFrame(loop);
  }
}

function loop(now) {
  if (!state.running) {
    return;
  }

  const dt = Math.min((now - state.lastTime) / 1000, 0.033);
  state.lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function update(dt) {
  updateStars(dt);
  updateParticles(dt);
  state.stageIntroGrace = Math.max(0, state.stageIntroGrace - dt);

  if (state.mode !== "playing") {
    return;
  }

  updatePlayer(dt);
  updateBullets(dt);
  updateEnemies(dt);
  checkStageState();
  syncHud();
}

function updateStars(dt) {
  for (const star of stars) {
    star.y += star.speed * dt;
    if (star.y > WORLD.height) {
      star.y = -4;
      star.x = Math.random() * WORLD.width;
    }
  }
}

function updatePlayer(dt) {
  const player = state.player;
  if (!player) {
    return;
  }

  const moveLeft = keys.left || pointer.left;
  const moveRight = keys.right || pointer.right;
  const fire = keys.fire || pointer.fire;

  if (moveLeft && !moveRight) {
    player.x -= player.speed * dt;
  } else if (moveRight && !moveLeft) {
    player.x += player.speed * dt;
  }

  player.x = Math.max(20, Math.min(WORLD.width - player.width - 20, player.x));
  player.cooldown = Math.max(0, player.cooldown - dt);
  player.invulnerable = Math.max(0, player.invulnerable - dt);

  if (fire && player.cooldown === 0) {
    state.playerBullets.push({
      x: player.x + player.width / 2 - 2,
      y: player.y - 14,
      width: 4,
      height: 14,
      vy: -440
    });
    player.cooldown = 0.32;
    state.shotsFired += 1;
    playSound("shoot");
  }
}

function updateBullets(dt) {
  for (const bullet of state.playerBullets) {
    bullet.y += bullet.vy * dt;
  }
  for (const bullet of state.enemyBullets) {
    bullet.y += bullet.vy * dt;
  }

  handleBulletCollisions();

  state.playerBullets = state.playerBullets.filter((bullet) => bullet.y + bullet.height > 0 && !bullet.spent);
  state.enemyBullets = state.enemyBullets.filter((bullet) => bullet.y < WORLD.height + 20 && !bullet.spent);
}

function handleBulletCollisions() {
  for (const bullet of state.playerBullets) {
    for (const enemy of state.enemies) {
      if (!enemy.alive || !overlaps(bullet, enemy)) {
        continue;
      }

      bullet.spent = true;
      enemy.alive = false;
      state.score += enemy.score;
      state.enemiesDestroyed += 1;
      state.shotsHit += 1;
      spawnBurst(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, "#7fffd4", 12);
      playSound("enemyDown");
      break;
    }

    if (bullet.spent) {
      continue;
    }

    for (const shield of state.shields) {
      const impact = findShieldImpact(shield, bullet);
      if (!impact) {
        continue;
      }
      bullet.spent = true;
      erodeShield(shield, impact.x, impact.y + 5, 10, 11);
      spawnBurst(bullet.x, bullet.y, "#ffcf5a", 6);
      break;
    }
  }

  for (const bullet of state.enemyBullets) {
    for (const shield of state.shields) {
      const impact = findShieldImpact(shield, bullet);
      if (!impact) {
        continue;
      }
      bullet.spent = true;
      erodeShield(shield, impact.x, impact.y - 5, 10, 11);
      spawnBurst(bullet.x, bullet.y, "#ff6b6b", 5);
      break;
    }

    if (bullet.spent) {
      continue;
    }

    if (state.player && state.player.invulnerable === 0 && overlaps(bullet, state.player)) {
      bullet.spent = true;
      hitPlayer();
    }
  }
}

function hitPlayer() {
  spawnBurst(state.player.x + state.player.width / 2, state.player.y + state.player.height / 2, "#ff6b6b", 18);
  playSound("hit");
  state.lives -= 1;
  syncHud();

  if (state.lives <= 0) {
    state.lastDefeatReason = "player-destroyed";
    finishCampaign(false);
    return;
  }

  state.player.x = WORLD.width / 2 - state.player.width / 2;
  state.player.invulnerable = 2;
  statusLine.textContent = "Hull breach. " + state.lives + " lives remaining.";
}

function updateEnemies(dt) {
  const livingEnemies = state.enemies.filter((enemy) => enemy.alive);
  if (!livingEnemies.length) {
    return;
  }

  const formation = state.formation;
  formation.elapsed += dt;
  const speedBoost = 1 + (1 - livingEnemies.length / state.enemies.length) * 0.7;
  let horizontalSpeed = formation.speed * formation.direction * speedBoost;

  if (formation.move === "sway") {
    horizontalSpeed += Math.sin(formation.elapsed * 2.1) * 28;
  } else if (formation.move === "zigzag") {
    horizontalSpeed += Math.sign(Math.sin(formation.elapsed * 3.5)) * 38;
  } else if (formation.move === "storm") {
    horizontalSpeed += Math.sin(formation.elapsed * 4.8) * 42;
  }

  for (const enemy of livingEnemies) {
    enemy.baseX += horizontalSpeed * dt;
    enemy.x = enemy.baseX;
    enemy.y = enemy.baseY;

    if (formation.move === "sway" || formation.move === "storm") {
      enemy.y += Math.sin(formation.elapsed * 2 + enemy.col * 0.6) * 5;
    } else if (formation.move === "zigzag") {
      enemy.y += Math.sin(formation.elapsed * 3.4 + enemy.zigSeed) * 6;
    }

    if ((formation.move === "dive" || formation.move === "storm") && enemy.dive > 0) {
      enemy.y += (1.3 - enemy.dive) * 120;
      enemy.x += Math.sin(formation.elapsed * 8 + enemy.zigSeed) * 18;
      enemy.dive = Math.max(0, enemy.dive - dt);
    }
  }

  const bounds = getEnemyBounds(livingEnemies, "baseX");
  if (bounds.minX <= 16 || bounds.maxX >= WORLD.width - 16) {
    const correction = bounds.minX <= 16
      ? 16 - bounds.minX
      : (WORLD.width - 16) - bounds.maxX;

    formation.direction *= -1;
    for (const enemy of livingEnemies) {
      enemy.baseX += correction;
      enemy.x += correction;
      enemy.baseY += formation.drop;
      enemy.y += formation.drop;
    }
  }

  const lowestEnemyBottom = Math.max(...livingEnemies.map((enemy) => enemy.y + enemy.height));
  const formationBottom = Math.max(...livingEnemies.map((enemy) => enemy.baseY + enemy.height));
  if (state.stageIntroGrace <= 0 && formationBottom >= getBaseLineY()) {
    state.lastDefeatReason = "citadel-breached";
    console.warn("Campaign ended", {
      reason: state.lastDefeatReason,
      stage: state.stage,
      lives: state.lives,
      lowestEnemyBottom,
      formationBottom,
      baseline: getBaseLineY(),
      grace: state.stageIntroGrace
    });
    finishCampaign(false);
    return;
  }

  formation.lastFire += dt;
  if (formation.lastFire >= formation.fireDelay) {
    formation.lastFire = 0;
    for (let i = 0; i < formation.maxShots; i += 1) {
      const shooter = pickShooter(livingEnemies);
      if (!shooter) {
        continue;
      }

      state.enemyBullets.push({
        x: shooter.x + shooter.width / 2 - 2,
        y: shooter.y + shooter.height,
        width: 4,
        height: 14,
        vy: formation.bulletSpeed + Math.random() * 28
      });

      if ((formation.move === "dive" || formation.move === "storm") && Math.random() < 0.25) {
        shooter.dive = 1.1;
      }
    }
  }
}

function pickShooter(livingEnemies) {
  const columns = new Map();
  for (const enemy of livingEnemies) {
    const current = columns.get(enemy.col);
    if (!current || enemy.y > current.y) {
      columns.set(enemy.col, enemy);
    }
  }

  const frontline = [...columns.values()];
  if (!frontline.length) {
    return null;
  }

  return frontline[Math.floor(Math.random() * frontline.length)];
}

function getEnemyBounds(enemies, positionKey = "x") {
  return enemies.reduce((acc, enemy) => {
    const x = enemy[positionKey] ?? enemy.x;
    acc.minX = Math.min(acc.minX, x);
    acc.maxX = Math.max(acc.maxX, x + enemy.width);
    return acc;
  }, { minX: Infinity, maxX: -Infinity });
}

function checkStageState() {
  if (!state.enemies.length || !state.enemies.every((enemy) => !enemy.alive)) {
    return;
  }

  if (state.stage >= 10) {
    finishCampaign(true);
    return;
  }

  state.mode = "intermission";
  stageOverlayTitle.textContent = "Stage " + state.stage + " Cleared";
  stageOverlayText.textContent = "Score locked at " + state.score + ". Next: Stage " + (state.stage + 1) + ". " + levelConfigs[state.stage].desc;
  stageOverlay.classList.remove("hidden");
  statusLine.textContent = "Stage " + state.stage + " cleared.";
  playSound("stageClear");
}

function advanceStage() {
  state.stage += 1;
  state.mode = "playing";
  stageOverlay.classList.add("hidden");
  buildStage(state.stage);
  syncHud();
}

function finishCampaign(victory) {
  state.mode = "diploma";
  if (state.score > state.bestScore) {
    state.bestScore = state.score;
    localStorage.setItem(STORAGE_KEY, String(state.bestScore));
  }
  syncHud();

  const accuracy = state.shotsFired ? Math.round((state.shotsHit / state.shotsFired) * 100) : 0;
  const stageReached = victory ? 10 : Math.max(0, state.stage - 1);
  const rank = getRank(victory, state.score, accuracy, stageReached);
  const metrics = [
    ["Final Score", state.score],
    ["Stages Cleared", (victory ? 10 : stageReached) + " / 10"],
    ["Enemies Defeated", state.enemiesDestroyed],
    ["Accuracy", accuracy + "%"],
    ["Best Score", state.bestScore]
  ];

  diplomaMessage.textContent = victory
    ? "All ten stages held. The academy recognizes your defense record."
    : "The citadel fell during stage " + state.stage + ". Your campaign record has been archived.";
  rankValue.textContent = rank;
  diplomaMetrics.replaceChildren();

  for (const [label, value] of metrics) {
    const item = document.createElement("div");
    item.className = "metric";
    item.append(label);
    const strong = document.createElement("strong");
    strong.textContent = value;
    item.appendChild(strong);
    diplomaMetrics.appendChild(item);
  }

  state.lastDiplomaRecord = { victory, accuracy, stageReached, rank, metrics };
  renderDiploma(state.lastDiplomaRecord);
  copyStatus.textContent = "Diploma image ready. Use Copy Diploma Image to place it on your clipboard.";
  diplomaOverlay.classList.remove("hidden");
  stageOverlay.classList.add("hidden");
  introOverlay.classList.add("hidden");
  statusLine.textContent = victory ? "Campaign complete. Diploma issued." : "Campaign ended. Diploma issued.";
  playSound(victory ? "victory" : "loss");
}

function getRank(victory, score, accuracy, stageReached) {
  if (victory && score >= 5000 && accuracy >= 48) {
    return "Galactic Marshal";
  }
  if ((victory && score >= 4200) || (!victory && stageReached >= 9)) {
    return "Fleet Commander";
  }
  if ((victory && score >= 2800) || (!victory && (score >= 2800 || stageReached >= 7))) {
    return "Star Captain";
  }
  if ((victory && score >= 1600) || (!victory && (score >= 1600 || stageReached >= 5))) {
    return "Wing Leader";
  }
  return victory ? "Cadet Laureate" : "Cadet";
}

function spawnBurst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 180,
      vy: (Math.random() - 0.5) * 180,
      life: 0.4 + Math.random() * 0.4,
      size: 1 + Math.random() * 3,
      color
    });
  }
}

function updateParticles(dt) {
  for (const particle of state.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
  }
  state.particles = state.particles.filter((particle) => particle.life > 0);
}

function overlaps(a, b) {
  return a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;
}

function render() {
  ctx.clearRect(0, 0, WORLD.width, WORLD.height);
  drawStars();
  drawCitadel();
  drawShields();
  drawBullets();
  drawEnemies();
  drawPlayer();
  drawParticles();
  drawStageBanner();
}

function drawStars() {
  ctx.fillStyle = "rgba(239, 247, 255, 0.85)";
  for (const star of stars) {
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
}

function drawCitadel() {
  const base = getCitadelRect();
  ctx.save();
  ctx.fillStyle = "rgba(9, 25, 38, 0.98)";
  ctx.fillRect(base.x, base.y, base.width, base.height);
  ctx.fillStyle = "rgba(127, 255, 212, 0.18)";
  ctx.fillRect(base.x, base.y, base.width, 10);
  ctx.fillStyle = "rgba(255, 207, 90, 0.16)";
  for (let i = 0; i < 9; i += 1) {
    ctx.fillRect(i * 110 + 22, base.y + 18, 66, 20);
  }
  ctx.fillStyle = "#7fffd4";
  ctx.fillRect(0, getBaseLineY(), WORLD.width, 4);
  ctx.restore();
}

function drawPlayer() {
  const player = state.player;
  if (!player) {
    return;
  }
  if (player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2 === 0) {
    return;
  }

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = "#7fffd4";
  ctx.beginPath();
  ctx.moveTo(player.width / 2, 0);
  ctx.lineTo(player.width, player.height);
  ctx.lineTo(player.width * 0.72, player.height);
  ctx.lineTo(player.width * 0.58, player.height * 0.62);
  ctx.lineTo(player.width * 0.42, player.height * 0.62);
  ctx.lineTo(player.width * 0.28, player.height);
  ctx.lineTo(0, player.height);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffcf5a";
  ctx.fillRect(player.width / 2 - 4, player.height * 0.56, 8, player.height * 0.52);
  ctx.restore();
}

function drawEnemies() {
  for (const enemy of state.enemies) {
    if (!enemy.alive) {
      continue;
    }

    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.fillStyle = enemy.row % 2 === 0 ? "#ffcf5a" : "#8cb8ff";
    ctx.beginPath();
    ctx.moveTo(enemy.width * 0.5, 0);
    ctx.lineTo(enemy.width, enemy.height * 0.22);
    ctx.lineTo(enemy.width * 0.82, enemy.height);
    ctx.lineTo(enemy.width * 0.62, enemy.height * 0.7);
    ctx.lineTo(enemy.width * 0.38, enemy.height * 0.7);
    ctx.lineTo(enemy.width * 0.18, enemy.height);
    ctx.lineTo(0, enemy.height * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#07111f";
    ctx.fillRect(enemy.width * 0.27, enemy.height * 0.28, enemy.width * 0.1, enemy.height * 0.12);
    ctx.fillRect(enemy.width * 0.63, enemy.height * 0.28, enemy.width * 0.1, enemy.height * 0.12);
    ctx.restore();
  }
}

function drawBullets() {
  ctx.fillStyle = "#7fffd4";
  for (const bullet of state.playerBullets) {
    ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
  }
  ctx.fillStyle = "#ff6b6b";
  for (const bullet of state.enemyBullets) {
    ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
  }
}

function drawShields() {
  for (const shield of state.shields) {
    if (!shieldHasCells(shield)) {
      continue;
    }

    for (let row = 0; row < shield.mask.length; row += 1) {
      for (let col = 0; col < shield.mask[row].length; col += 1) {
        if (!shield.mask[row][col]) {
          continue;
        }

        const alpha = 0.36 + (row / shield.mask.length) * 0.32;
        ctx.fillStyle = "rgba(127, 255, 212, " + alpha + ")";
        ctx.fillRect(
          shield.x + col * shield.cellSize,
          shield.y + row * shield.cellSize,
          shield.cellSize - 0.5,
          shield.cellSize - 0.5
        );
      }
    }
  }
}

function drawParticles() {
  for (const particle of state.particles) {
    ctx.globalAlpha = Math.max(0, particle.life);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  }
  ctx.globalAlpha = 1;
}

function drawStageBanner() {
  if (state.mode !== "playing") {
    return;
  }
  ctx.save();
  ctx.fillStyle = "rgba(3, 7, 15, 0.35)";
  ctx.fillRect(16, 14, 460, 34);
  ctx.fillStyle = "#eff7ff";
  ctx.font = "16px Trebuchet MS";
  ctx.fillText("Stage " + state.stage + ": " + levelConfigs[state.stage - 1].desc, 28, 36);
  ctx.restore();
}

function renderDiploma(record) {
  const width = diplomaCanvas.width;
  const height = diplomaCanvas.height;
  const parchment = diplomaCtx.createLinearGradient(0, 0, 0, height);
  parchment.addColorStop(0, "#f5e9bc");
  parchment.addColorStop(1, "#dcc689");

  diplomaCtx.clearRect(0, 0, width, height);
  diplomaCtx.fillStyle = parchment;
  diplomaCtx.fillRect(0, 0, width, height);

  diplomaCtx.strokeStyle = "rgba(90, 58, 16, 0.42)";
  diplomaCtx.lineWidth = 4;
  diplomaCtx.strokeRect(20, 20, width - 40, height - 40);
  diplomaCtx.lineWidth = 2;
  diplomaCtx.strokeRect(38, 38, width - 76, height - 76);

  drawDiplomaArt(width, height, record.victory);

  diplomaCtx.fillStyle = "#412711";
  diplomaCtx.textAlign = "center";
  diplomaCtx.font = "700 26px Georgia";
  diplomaCtx.fillText("Defense Academy Diploma", width / 2, 74);
  diplomaCtx.font = "18px Georgia";
  diplomaCtx.fillText("Awarded for the Starward Defenders campaign", width / 2, 106);

  diplomaCtx.font = "700 44px Georgia";
  diplomaCtx.fillText(record.rank, width / 2, 164);
  diplomaCtx.font = "18px Georgia";
  diplomaCtx.fillText(record.victory ? "For holding all ten stages against the invading fleet" : "For gallantry under overwhelming invasion pressure", width / 2, 198);

  diplomaCtx.textAlign = "left";
  diplomaCtx.font = "700 22px Georgia";
  diplomaCtx.fillText("Campaign Record", 92, 376);

  diplomaCtx.font = "18px Georgia";
  let metricY = 416;
  for (const [label, value] of record.metrics) {
    diplomaCtx.fillStyle = "#5f4023";
    diplomaCtx.fillText(label, 92, metricY);
    diplomaCtx.fillStyle = "#1b2438";
    diplomaCtx.fillText(String(value), 334, metricY);
    metricY += 34;
  }

  diplomaCtx.fillStyle = "#412711";
  diplomaCtx.font = "italic 18px Georgia";
  diplomaCtx.fillText("Signed on the orbital defense grid", 92, 584);
  diplomaCtx.textAlign = "right";
  diplomaCtx.font = "700 22px Georgia";
  diplomaCtx.fillText("Commandant Aster Vale", width - 92, 584);
}

function drawDiplomaArt(width, height, victory) {
  const sky = diplomaCtx.createLinearGradient(0, 0, width, 0);
  sky.addColorStop(0, "rgba(28, 43, 70, 0.88)");
  sky.addColorStop(1, "rgba(58, 88, 124, 0.82)");
  diplomaCtx.fillStyle = sky;
  diplomaCtx.fillRect(520, 224, 344, 272);

  diplomaCtx.fillStyle = "rgba(255, 255, 255, 0.8)";
  for (let i = 0; i < 34; i += 1) {
    const x = 542 + (i * 47) % 300;
    const y = 246 + (i * 61) % 210;
    const size = 1 + (i % 3);
    diplomaCtx.fillRect(x, y, size, size);
  }

  const planet = diplomaCtx.createRadialGradient(688, 330, 18, 688, 330, 86);
  planet.addColorStop(0, victory ? "#ffe4a6" : "#ffb69c");
  planet.addColorStop(1, victory ? "#d9874e" : "#9e4d42");
  diplomaCtx.fillStyle = planet;
  diplomaCtx.beginPath();
  diplomaCtx.arc(688, 330, 86, 0, Math.PI * 2);
  diplomaCtx.fill();

  diplomaCtx.strokeStyle = "rgba(255, 229, 176, 0.78)";
  diplomaCtx.lineWidth = 10;
  diplomaCtx.beginPath();
  diplomaCtx.ellipse(688, 330, 120, 30, -0.18, 0, Math.PI * 2);
  diplomaCtx.stroke();

  diplomaCtx.fillStyle = "#7fffd4";
  diplomaCtx.beginPath();
  diplomaCtx.moveTo(622, 428);
  diplomaCtx.lineTo(726, 456);
  diplomaCtx.lineTo(670, 392);
  diplomaCtx.closePath();
  diplomaCtx.fill();
  diplomaCtx.fillStyle = "#ffcf5a";
  diplomaCtx.fillRect(666, 404, 12, 46);

  drawLaurel(114, 196, false);
  drawLaurel(width - 114, 196, true);
}

function drawLaurel(x, y, mirrored) {
  diplomaCtx.save();
  diplomaCtx.translate(x, y);
  diplomaCtx.scale(mirrored ? -1 : 1, 1);
  diplomaCtx.strokeStyle = "#7a5a1a";
  diplomaCtx.lineWidth = 4;
  diplomaCtx.beginPath();
  diplomaCtx.moveTo(0, 0);
  diplomaCtx.quadraticCurveTo(18, 72, 10, 156);
  diplomaCtx.stroke();
  for (let i = 0; i < 7; i += 1) {
    const yy = 18 + i * 20;
    diplomaCtx.fillStyle = i % 2 === 0 ? "#6a9850" : "#88b765";
    diplomaCtx.beginPath();
    diplomaCtx.ellipse(18, yy, 18, 8, -0.6, 0, Math.PI * 2);
    diplomaCtx.fill();
  }
  diplomaCtx.restore();
}

function bindHold(buttonId, keyName) {
  const button = document.getElementById(buttonId);
  const activate = (event) => {
    event.preventDefault();
    pointer[keyName] = true;
    ensureAudio();
  };
  const deactivate = (event) => {
    event.preventDefault();
    pointer[keyName] = false;
  };
  button.addEventListener("pointerdown", activate);
  button.addEventListener("pointerup", deactivate);
  button.addEventListener("pointerleave", deactivate);
  button.addEventListener("pointercancel", deactivate);
}

function ensureAudio() {
  if (state.audio.enabled) {
    if (state.audio.ctx && state.audio.ctx.state === "suspended") {
      state.audio.ctx.resume().catch(() => {});
    }
    return;
  }

  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) {
    return;
  }

  state.audio.ctx = new AudioCtor();
  state.audio.enabled = true;
}

function tone(freq, type, duration, gainValue, startOffset, slideTo) {
  if (!state.audio.enabled || !state.audio.ctx) {
    return;
  }

  const audioCtx = state.audio.ctx;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const startTime = audioCtx.currentTime + (startOffset || 0);
  const endTime = startTime + duration;

  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  if (slideTo) {
    osc.frequency.exponentialRampToValueAtTime(slideTo, endTime);
  }

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(gainValue, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(startTime);
  osc.stop(endTime + 0.02);
}

function playSound(kind) {
  if (!state.audio.enabled || !state.audio.ctx) {
    return;
  }

  if (kind === "shoot") {
    tone(660, "square", 0.08, 0.032, 0, 880);
  } else if (kind === "enemyDown") {
    tone(220, "sawtooth", 0.14, 0.038, 0, 90);
  } else if (kind === "hit") {
    tone(180, "triangle", 0.26, 0.05, 0, 60);
  } else if (kind === "stageClear") {
    tone(392, "triangle", 0.18, 0.03, 0, 494);
    tone(494, "triangle", 0.18, 0.03, 0.12, 587);
    tone(587, "triangle", 0.28, 0.032, 0.24, 784);
  } else if (kind === "victory") {
    tone(523.25, "triangle", 0.2, 0.032, 0, 659.25);
    tone(659.25, "triangle", 0.2, 0.032, 0.14, 783.99);
    tone(783.99, "triangle", 0.44, 0.036, 0.28, 1046.5);
  } else if (kind === "loss") {
    tone(220, "sawtooth", 0.18, 0.03, 0, 164.81);
    tone(164.81, "sawtooth", 0.22, 0.03, 0.16, 123.47);
    tone(123.47, "triangle", 0.32, 0.03, 0.34, 82.41);
  } else if (kind === "start") {
    tone(329.63, "triangle", 0.12, 0.026, 0, 392);
    tone(392, "triangle", 0.16, 0.026, 0.1, 523.25);
  }
}

async function copyDiplomaImage() {
  if (!state.lastDiplomaRecord) {
    copyStatus.textContent = "Finish a run first so the diploma can be rendered.";
    return;
  }

  if (!navigator.clipboard || typeof navigator.clipboard.write !== "function" || typeof ClipboardItem === "undefined") {
    copyStatus.textContent = "This browser cannot copy images to the clipboard. Try the GitHub Pages version over HTTPS.";
    return;
  }

  const blob = await new Promise((resolve) => diplomaCanvas.toBlob(resolve, "image/png"));
  if (!blob) {
    copyStatus.textContent = "The diploma image could not be generated.";
    return;
  }

  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    copyStatus.textContent = "Diploma image copied. You can paste it into email, chat, or documents.";
    playSound("stageClear");
  } catch (error) {
    copyStatus.textContent = "Copy failed. Your browser may require a secure page or clipboard permission.";
  }
}

document.addEventListener("keydown", (event) => {
  if (event.code === "ArrowLeft" || event.code === "KeyA") {
    keys.left = true;
  }
  if (event.code === "ArrowRight" || event.code === "KeyD") {
    keys.right = true;
  }
  if (event.code === "Space") {
    event.preventDefault();
    keys.fire = true;
    ensureAudio();
  }
});

document.addEventListener("keyup", (event) => {
  if (event.code === "ArrowLeft" || event.code === "KeyA") {
    keys.left = false;
  }
  if (event.code === "ArrowRight" || event.code === "KeyD") {
    keys.right = false;
  }
  if (event.code === "Space") {
    keys.fire = false;
  }
});

bindHold("leftButton", "left");
bindHold("rightButton", "right");
bindHold("fireButton", "fire");

function startGame() {
  resetCampaign();
  startLoop();
}

document.getElementById("startButton").addEventListener("click", startGame);
document.getElementById("launchButton").addEventListener("click", startGame);
document.getElementById("continueButton").addEventListener("click", advanceStage);
document.getElementById("restartButton").addEventListener("click", startGame);
document.getElementById("copyButton").addEventListener("click", () => {
  ensureAudio();
  copyDiplomaImage();
});

createPlayer();
renderDiploma({
  victory: true,
  rank: "Cadet",
  metrics: [["Final Score", 0], ["Stages Cleared", "0 / 10"], ["Enemies Defeated", 0], ["Accuracy", "0%"], ["Best Score", state.bestScore]]
});
syncHud();
render();







