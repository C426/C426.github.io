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

// UI 文本元素
const uiTitle = document.getElementById('ui-title');
const uiInstructions = document.getElementById('ui-instructions');

// 语言相关元素
const langBtn = document.getElementById('lang-btn');
const langMenu = document.getElementById('lang-menu');
const langOptions = document.querySelectorAll('.lang-option');

// --- 2. 多语言配置 ---
const translations = {
    zh: {
        title: "躲避与收集",
        instructions: "WASD 移动 | 鼠标左键 冲刺",
        start: "开始游戏",
        restart: "重新开始游戏",
        home: "返回主界面",
        victory: "胜利！",
        gameOver: "游戏结束",
        winReason: "恭喜！你收集了所有金币！",
        loseReason: "很遗憾，被敌人抓住了。",
        coinsCollected: "收集金币",
        time: "时间",
        coins: "金币",
        dashReady: "冲刺准备就绪 [鼠标左键]",
        dashCool: "冲刺冷却",
        dashActive: "冲刺中! 连按!",
        danger: "危"
    },
    ja: {
        title: "回避と収集",
        instructions: "WASD 移動 | 左クリック ダッシュ",
        start: "ゲーム開始",
        restart: "リスタート",
        home: "ホームに戻る",
        victory: "勝利！",
        gameOver: "ゲームオーバー",
        winReason: "おめでとう！全コイン収集完了！",
        loseReason: "残念、敵に捕まりました。",
        coinsCollected: "獲得コイン",
        time: "タイム",
        coins: "コイン",
        dashReady: "ダッシュ可能 [左クリック]",
        dashCool: "クールダウン",
        dashActive: "連打せよ!",
        danger: "危"
    },
    en: {
        title: "Dodge & Collect",
        instructions: "WASD to Move | Left Click to Dash",
        start: "Start Game",
        restart: "Try Again",
        home: "Main Menu",
        victory: "Victory!",
        gameOver: "Game Over",
        winReason: "Congrats! All coins collected!",
        loseReason: "You were caught by the enemy.",
        coinsCollected: "Coins Collected",
        time: "Time",
        coins: "Coins",
        dashReady: "Dash Ready [L-Click]",
        dashCool: "Cooldown",
        dashActive: "MASH CLICK!",
        danger: "RUN"
    }
};

let currentLang = 'zh'; // 默认语言

// --- 3. 语言切换逻辑 ---

// 切换菜单显示/隐藏
langBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // 防止冒泡
    langMenu.classList.toggle('show');
});

// 点击其他地方关闭菜单
document.addEventListener('click', (e) => {
    if (!langBtn.contains(e.target) && !langMenu.contains(e.target)) {
        langMenu.classList.remove('show');
    }
});

// 选择语言
langOptions.forEach(option => {
    option.addEventListener('click', () => {
        const selectedLang = option.getAttribute('data-lang');
        setLanguage(selectedLang);
        langMenu.classList.remove('show');
    });
});

function setLanguage(lang) {
    currentLang = lang;
    const t = translations[lang];

    // 更新 DOM 文本
    uiTitle.textContent = t.title;
    uiInstructions.textContent = t.instructions;
    startBtn.textContent = t.start;
    restartBtn.textContent = t.restart;
    homeBtn.textContent = t.home;

    // 更新菜单勾选状态
    langOptions.forEach(opt => {
        if (opt.getAttribute('data-lang') === lang) {
            opt.textContent = '✓ ' + getLangName(opt.getAttribute('data-lang'));
        } else {
            opt.textContent = '　 ' + getLangName(opt.getAttribute('data-lang')); // 全角空格占位
        }
    });
}

function getLangName(code) {
    if (code === 'zh') return '中文';
    if (code === 'ja') return '日本語';
    if (code === 'en') return 'English';
    return code;
}


// --- 4. 游戏全局配置 (常量) ---
const MAX_COINS_ON_SCREEN = 3;
const COIN_SPAWN_INTERVAL = 7;
const COINS_TO_WIN = 20;
const SAFE_TIME = 20;
const DASH_WINDOW_DURATION = 5;
const DASH_COOLDOWN = 5;
const MASH_THRESHOLD = 0.2;
const DANGER_DISTANCE = 50;

// --- 5. 游戏状态变量 ---
let player, enemy, coins, collectedCoins, coinSpawnTimer;
let isChasePhase, isGameOver, isVictory, isGameRunning;
let startTime;
let isWhiteout, whiteoutTimer, whiteoutDuration, whiteoutCooldownTimer, nextWhiteoutTime;
let isDashWindowActive, dashWindowTimer, isDashOnCooldown, dashCooldownTimer;
let lastDashKeyPressTime, dashMashCounter;
let isPlayerInDanger;
let keys = { w: false, a: false, s: false, d: false };
let animationFrameId;

// --- 6. 初始化与游戏流程控制 ---
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
homeBtn.addEventListener('click', returnToTitle);

function initGameVars() {
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
    
    startTime = Date.now();
}

function startGame() {
    initGameVars();
    isGameRunning = true;
    titleScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    gameLoop();
}

function returnToTitle() {
    isGameRunning = false;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    gameOverScreen.classList.add('hidden');
    titleScreen.classList.remove('hidden');
}

function showGameOver(victory) {
    isGameRunning = false;
    isVictory = victory;
    
    const t = translations[currentLang]; // 获取当前语言文本

    endTitle.textContent = victory ? t.victory : t.gameOver;
    endTitle.style.color = victory ? 'gold' : 'red';
    
    if (victory) {
        endReason.textContent = t.winReason;
    } else {
        endReason.textContent = `${t.loseReason} ${t.coinsCollected}: ${collectedCoins}`;
    }
        
    gameOverScreen.classList.remove('hidden');
}

// --- 7. 输入处理 ---
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

// --- 8. 游戏循环 ---
function gameLoop() {
    if (!isGameRunning) return;
    if (isGameOver || isVictory) { showGameOver(isVictory); return; }
    update();
    draw();
    animationFrameId = requestAnimationFrame(gameLoop);
}

function update() {
    const deltaTime = 1 / 60;
    const elapsedTime = (Date.now() - startTime) / 1000;
    let currentSpeed = player.speed;

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

    const inputVector = { x: (keys.d ? 1 : 0) - (keys.a ? 1 : 0), y: (keys.s ? 1 : 0) - (keys.w ? 1 : 0) };
    if (inputVector.x !== 0 || inputVector.y !== 0) {
        const magnitude = Math.sqrt(inputVector.x * inputVector.x + inputVector.y * inputVector.y);
        player.x += (inputVector.x / magnitude) * currentSpeed;
        player.y += (inputVector.y / magnitude) * currentSpeed;
    }
    player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));

    if (!isChasePhase && elapsedTime > SAFE_TIME) { isChasePhase = true; spawnEnemy(elapsedTime); }

    if (elapsedTime > 3) {
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

    if (isChasePhase && enemy) {
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        isPlayerInDanger = (!isWhiteout && distance < DANGER_DISTANCE);

        if (isWhiteout) {
            whiteoutTimer += deltaTime;
            if (whiteoutTimer > whiteoutDuration) {
                isWhiteout = false;
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
        if (!isWhiteout && finalDistance < player.radius + enemy.radius) { isGameOver = true; }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const t = translations[currentLang]; // 获取当前语言配置

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
        ctx.fillText(t.danger, player.x, player.y); // 使用翻译文本
    }
    
    // 敌人
    if (!isWhiteout && isChasePhase && enemy) {
        drawCircle(enemy.x, enemy.y, enemy.radius, enemy.color);
    }
    
    // 金币
    coins.forEach(coin => { drawSquare(coin.x, coin.y, coin.size, coin.color); });
    
    // UI 信息 (全部使用翻译文本)
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const uiColor = isWhiteout ? 'black' : 'white';
    ctx.fillStyle = uiColor;
    ctx.font = '24px sans-serif';
    ctx.textBaseline = 'bottom'; 
    
    ctx.textAlign = 'left';
    ctx.fillText(`${t.time}: ${elapsedTime}`, 10, 30);
    
    ctx.textAlign = 'right';
    ctx.fillText(`${t.coins}: ${collectedCoins} / ${COINS_TO_WIN}`, canvas.width - 10, 30);
    
    ctx.textAlign = 'center';
    let dashText = '';
    if (isDashOnCooldown) {
        const remainingCooldown = Math.max(0, DASH_COOLDOWN - dashCooldownTimer).toFixed(1);
        ctx.fillStyle = 'red';
        dashText = `${t.dashCool}: ${remainingCooldown}s`;
    } else {
        ctx.fillStyle = 'lime';
        dashText = t.dashReady;
    }
    if (isDashWindowActive) {
        ctx.fillStyle = 'yellow';
        const remainingWindow = Math.max(0, DASH_WINDOW_DURATION - dashWindowTimer).toFixed(1);
        dashText = `${t.dashActive} ${remainingWindow}s`;
    }
    ctx.fillText(dashText, canvas.width / 2, 30);
}

// --- 9. 辅助函数 ---
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