// --- 1. DOM 元素获取 ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const titleScreen = document.getElementById('title-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const endTitle = document.getElementById('end-title');
const endReason = document.getElementById('end-reason');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const homeBtn = document.getElementById('home-btn');

// --- 2. 游戏全局配置 (常量) ---
const MAX_COINS_ON_SCREEN = 3;
const COIN_SPAWN_INTERVAL = 7;
const COINS_TO_WIN = 20;
const SAFE_TIME = 20;
const DASH_WINDOW_DURATION = 5;
const DASH_COOLDOWN = 5;
const MASH_THRESHOLD = 0.2;
const DANGER_DISTANCE = 50;

// --- 3. 游戏状态变量 (需要在重置时初始化的变量) ---
let player, enemy, coins, collectedCoins, coinSpawnTimer;
let isChasePhase, isGameOver, isVictory, isGameRunning;
let startTime, currentTime;
let isWhiteout, whiteoutTimer, whiteoutDuration, whiteoutCooldownTimer, nextWhiteoutTime;
let isDashWindowActive, dashWindowTimer, isDashOnCooldown, dashCooldownTimer;
let lastDashKeyPressTime, dashMashCounter;
let isPlayerInDanger;
let keys = { w: false, a: false, s: false, d: false };
let lastInputVector = { x: 0, y: 0 };
let animationFrameId; // 用于控制游戏循环

// --- 4. 初始化与游戏流程控制 ---

// 绑定按钮事件
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
homeBtn.addEventListener('click', returnToTitle);

function initGameVars() {
    // 重置所有游戏逻辑变量
    player = {
        x: canvas.width / 2, y: canvas.height / 2,
        radius: 15, color: 'cyan',
        speed: 2.8, dashSpeed: 6
    };
    enemy = null;
    coins = [];
    collectedCoins = 0;
    coinSpawnTimer = 7;
    isChasePhase = false;
    isGameOver = false;
    isVictory = false;
    isWhiteout = false;
    whiteoutTimer = 0;
    whiteoutDuration = 0;
    whiteoutCooldownTimer = 0;
    nextWhiteoutTime = Math.random() * 10 + 20;
    isDashWindowActive = false;
    dashWindowTimer = 0;
    isDashOnCooldown = false;
    dashCooldownTimer = 0;
    lastDashKeyPressTime = 0;
    dashMashCounter = 0;
    isPlayerInDanger = false;
    keys = { w: false, a: false, s: false, d: false };
    lastInputVector = { x: 0, y: 0 };
    
    startTime = Date.now(); // 重置时间
}

function startGame() {
    initGameVars();
    isGameRunning = true;
    
    // UI 切换
    titleScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    
    // 启动循环
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    gameLoop();
}

function returnToTitle() {
    isGameRunning = false;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // UI 切换
    gameOverScreen.classList.add('hidden');
    titleScreen.classList.remove('hidden');
}

function showGameOver(victory) {
    isGameRunning = false;
    isVictory = victory;
    
    endTitle.textContent = victory ? '胜利！' : '游戏结束';
    endTitle.style.color = victory ? 'gold' : 'red';
    endReason.textContent = victory 
        ? `恭喜！你收集了所有 ${COINS_TO_WIN} 枚金币！` 
        : `很遗憾，被敌人抓住了。收集金币: ${collectedCoins}`;
        
    gameOverScreen.classList.remove('hidden');
}

// --- 5. 输入处理 ---
window.addEventListener('keydown', (e) => {
    if (!isGameRunning) return;
    const keyCode = e.code;
    if (keyCode === 'KeyW') keys.w = true;
    if (keyCode === 'KeyA') keys.a = true;
    if (keyCode === 'KeyS') keys.s = true;
    if (keyCode === 'KeyD') keys.d = true;
});
window.addEventListener('keyup', (e) => {
    if (!isGameRunning) return;
    const keyCode = e.code;
    if (keyCode === 'KeyW') keys.w = false;
    if (keyCode === 'KeyA') keys.a = false;
    if (keyCode === 'KeyS') keys.s = false;
    if (keyCode === 'KeyD') keys.d = false;
});
canvas.addEventListener('mousedown', (e) => {
    if (!isGameRunning) return;
    if (e.button === 0) {
        const elapsedTime = (Date.now() - startTime) / 1000;
        if (!isDashWindowActive && !isDashOnCooldown) {
            isDashWindowActive = true;
            dashWindowTimer = 0;
            dashMashCounter = 0;
        }
        if (isDashWindowActive) {
            lastDashKeyPressTime = elapsedTime;
            dashMashCounter++;
        }
    }
});

// --- 6. 游戏循环 ---
function gameLoop() {
    if (!isGameRunning) return;

    if (isGameOver || isVictory) {
        showGameOver(isVictory);
        return; 
    }

    update();
    draw();
    animationFrameId = requestAnimationFrame(gameLoop);
}

function update() {
    const deltaTime = 1 / 60;
    const elapsedTime = (Date.now() - startTime) / 1000;
    let currentSpeed = player.speed;

    // 冲刺逻辑
    if (isDashWindowActive) {
        dashWindowTimer += deltaTime;
        if (elapsedTime - lastDashKeyPressTime < MASH_THRESHOLD) {
            currentSpeed = player.dashSpeed;
        }
        if (dashWindowTimer > DASH_WINDOW_DURATION) {
            isDashWindowActive = false;
            isDashOnCooldown = true;
            dashCooldownTimer = 0;
        }
    }
    if (isDashOnCooldown) {
        dashCooldownTimer += deltaTime;
        if (dashCooldownTimer > DASH_COOLDOWN) {
            isDashOnCooldown = false;
        }
    }

    // 玩家移动
    const inputVector = { x: (keys.d ? 1 : 0) - (keys.a ? 1 : 0), y: (keys.s ? 1 : 0) - (keys.w ? 1 : 0) };
    if (inputVector.x !== 0 || inputVector.y !== 0) {
        const magnitude = Math.sqrt(inputVector.x * inputVector.x + inputVector.y * inputVector.y);
        player.x += (inputVector.x / magnitude) * currentSpeed;
        player.y += (inputVector.y / magnitude) * currentSpeed;
    }
    player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));

    // 敌人生成
    const COIN_SPAWN_START_TIME = Math.random() * 2 + 3; // 移到这里或作为常量
    if (!isChasePhase && elapsedTime > SAFE_TIME) { isChasePhase = true; spawnEnemy(elapsedTime); }

    // 金币逻辑
    if (elapsedTime > 3) { // 简化判断，3秒后开始生成
        coinSpawnTimer += deltaTime;
        if (coinSpawnTimer >= COIN_SPAWN_INTERVAL) {
            if (coins.length < MAX_COINS_ON_SCREEN) { spawnCoin(elapsedTime); }
            coinSpawnTimer = 0;
        }
    }
    for (let i = coins.length - 1; i >= 0; i--) {
        const coin = coins[i];
        const dx = player.x - coin.x;
        const dy = player.y - coin.y;
        if (Math.sqrt(dx * dx + dy * dy) < player.radius + coin.size / 2) {
            collectedCoins++;
            coins.splice(i, 1);
            if (collectedCoins >= COINS_TO_WIN) {
                isVictory = true;
            }
        }
    }

    // 敌人逻辑
    if (isChasePhase && enemy) {
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        isPlayerInDanger = (!isWhiteout && distance < DANGER_DISTANCE);

        if (isWhiteout) {
            whiteoutTimer += deltaTime;
            if (whiteoutTimer > whiteoutDuration) {
                isWhiteout = false;
                // 瞬移逻辑
                const teleportAngle = Math.random() * Math.PI * 2;
                let minDistance = 50;
                if (inputVector.x !== 0 || inputVector.y !== 0) {
                    const playerAngle = Math.atan2(inputVector.y, inputVector.x);
                    let angleDiff = Math.abs(teleportAngle - playerAngle);
                    if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
                    if (angleDiff < Math.PI / 4) minDistance = 200;
                }
                const finalTeleportDistance = player.radius + enemy.radius + minDistance + Math.random() * 100;
                const targetX = player.x + Math.cos(teleportAngle) * finalTeleportDistance;
                const targetY = player.y + Math.sin(teleportAngle) * finalTeleportDistance;
                enemy.x = Math.max(enemy.radius, Math.min(canvas.width - enemy.radius, targetX));
                enemy.y = Math.max(enemy.radius, Math.min(canvas.height - enemy.radius, targetY));
                endDashAndStun(enemy);
            }
        } else {
            whiteoutCooldownTimer += deltaTime;
            if (whiteoutCooldownTimer > nextWhiteoutTime) {
                isWhiteout = true; whiteoutTimer = 0;
                whiteoutDuration = Math.random() * 1 + 1;
                whiteoutCooldownTimer = 0;
                nextWhiteoutTime = Math.random() * 10 + 20;
            }
        }

        if (enemy.isStunned) {
            enemy.stunTimer += deltaTime;
            if (enemy.stunTimer > enemy.STUN_DURATION) {
                enemy.isStunned = false;
            }
        } else {
            const proximityThreshold = 150;
            if (enemy.isDashing) {
                enemy.speed = enemy.normalSpeed * 10;
            } else if (distance < proximityThreshold) {
                enemy.speed = player.speed;
            } else {
                enemy.speed = enemy.normalSpeed;
            }

            enemy.dashCooldownTimer += deltaTime;
            if (!enemy.isDashing && enemy.dashCooldownTimer > enemy.DASH_COOLDOWN && enemy.dashCooldownTimer > enemy.nextDashTime) {
                enemy.isDashing = true;
                enemy.dashDurationTimer = 0;
                enemy.dashCooldownTimer = 0;
                enemy.nextDashTime = Math.random() * 10 + 10;
            }

            const moveDistanceThisFrame = enemy.speed;
            const stopDistance = player.radius * 3;

            if (enemy.isDashing && distance <= moveDistanceThisFrame + stopDistance) {
                const targetX = player.x - (dx / distance) * stopDistance;
                const targetY = player.y - (dy / distance) * stopDistance;
                enemy.x = targetX;
                enemy.y = targetY;
                endDashAndStun(enemy);
            } else if (distance > 0) {
                const moveX = (dx / distance) * moveDistanceThisFrame;
                const moveY = (dy / distance) * moveDistanceThisFrame;
                enemy.x += moveX;
                enemy.y += moveY;
            }
        }

        const finalDistance = Math.sqrt(Math.pow(player.x - enemy.x, 2) + Math.pow(player.y - enemy.y, 2));
        if (!isWhiteout && finalDistance < player.radius + enemy.radius) {
            isGameOver = true;
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 背景
    if (isWhiteout) { ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height); } 
    else { ctx.fillStyle = 'black'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    
    // 玩家
    drawCircle(player.x, player.y, player.radius, player.color);
    
    // 危险提示
    if (isPlayerInDanger) {
        ctx.fillStyle = 'red';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('危', player.x, player.y);
    }
    
    // 敌人
    if (!isWhiteout && isChasePhase && enemy) {
        drawCircle(enemy.x, enemy.y, enemy.radius, enemy.color);
    }
    
    // 金币
    coins.forEach(coin => { drawSquare(coin.x, coin.y, coin.size, coin.color); });
    
    // UI 信息
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const uiColor = isWhiteout ? 'black' : 'white';
    ctx.fillStyle = uiColor;
    ctx.font = '24px sans-serif';
    ctx.textBaseline = 'bottom'; 
    
    ctx.textAlign = 'left';
    ctx.fillText(`Time: ${elapsedTime}`, 10, 30);
    
    ctx.textAlign = 'right';
    ctx.fillText(`Coins: ${collectedCoins} / ${COINS_TO_WIN}`, canvas.width - 10, 30);
    
    ctx.textAlign = 'center';
    let dashText = '';
    if (isDashOnCooldown) {
        const remainingCooldown = Math.max(0, DASH_COOLDOWN - dashCooldownTimer).toFixed(1);
        ctx.fillStyle = 'red';
        dashText = `冲刺冷却: ${remainingCooldown}s`;
    } else {
        ctx.fillStyle = 'lime';
        dashText = '冲刺准备就绪 [鼠标左键]';
    }
    if (isDashWindowActive) {
        ctx.fillStyle = 'yellow';
        const remainingWindow = Math.max(0, DASH_WINDOW_DURATION - dashWindowTimer).toFixed(1);
        dashText = `冲刺中! 连按! ${remainingWindow}s`;
    }
    ctx.fillText(dashText, canvas.width / 2, 30);
}

// --- 7. 辅助函数 ---
function drawSquare(x, y, size, color) { ctx.fillStyle = color; ctx.fillRect(x - size / 2, y - size / 2, size, size); }
function drawCircle(x, y, radius, color) { ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.closePath(); }
function endDashAndStun(enemyRef) { if (!enemyRef) return; enemyRef.isDashing = false; enemyRef.speed = enemyRef.normalSpeed; enemyRef.isStunned = true; enemyRef.stunTimer = 0; }
function spawnCoin(elapsedTime) { const size = player.radius * 1.5; const coin = { x: Math.random()*(canvas.width - size) + size/2, y: Math.random()*(canvas.height - size) + size/2, size: size, color: 'gold' }; coins.push(coin); }
function spawnEnemy(elapsedTime) {
    const x = Math.random() < 0.5 ? 0 : canvas.width;
    const y = Math.random() * canvas.height;
    enemy = {
        x: x, y: y, radius: 15, color: 'red', 
        normalSpeed: 3, 
        speed: 3, 
        isDashing: false, dashCooldownTimer: 0, dashDurationTimer: 0, 
        nextDashTime: Math.random() * 10 + 10,
        DASH_COOLDOWN: 10, DASH_DURATION: 0.5,
        isStunned: false, stunTimer: 0, STUN_DURATION: 0.2
    };
}