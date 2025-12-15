// --- 1. DOM 元素获取 ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI 元素
const titleScreen = document.getElementById('title-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const scoreDisplay = document.getElementById('score-display');
const uiTitle = document.getElementById('ui-title');
const uiInstructions = document.getElementById('ui-instructions');
const endTitle = document.getElementById('end-title');
const endScore = document.getElementById('end-score');

// 按钮
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const homeBtn = document.getElementById('home-btn');
const langBtn = document.getElementById('lang-btn');
const langMenu = document.getElementById('lang-menu');
const langOptions = document.querySelectorAll('.lang-option');

// --- 2. 多语言配置 ---
const translations = {
    zh: {
        title: "Flappy Bird",
        instructions: "空格键 / 点击 跳跃",
        start: "开始游戏",
        restart: "再试一次",
        home: "返回主页",
        gameOver: "游戏结束",
        score: "得分",
        win: "胜利！"
    },
    ja: {
        title: "Flappy Bird",
        instructions: "スペース / クリックでジャンプ",
        start: "スタート",
        restart: "もう一度",
        home: "ホームへ",
        gameOver: "ゲームオーバー",
        score: "スコア",
        win: "クリア！"
    },
    en: {
        title: "Flappy Bird",
        instructions: "Space / Click to Jump",
        start: "Start Game",
        restart: "Try Again",
        home: "Main Menu",
        gameOver: "Game Over",
        score: "Score",
        win: "You Win!"
    }
};
let currentLang = 'zh';

// --- 3. 语言切换逻辑 ---
langBtn.addEventListener('click', (e) => { e.stopPropagation(); langMenu.classList.toggle('show'); });
document.addEventListener('click', (e) => { if (!langBtn.contains(e.target) && !langMenu.contains(e.target)) langMenu.classList.remove('show'); });
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
    uiTitle.textContent = t.title;
    uiInstructions.textContent = t.instructions;
    startBtn.textContent = t.start;
    restartBtn.textContent = t.restart;
    homeBtn.textContent = t.home;
    langOptions.forEach(opt => {
        opt.textContent = (opt.getAttribute('data-lang') === lang ? '✓ ' : '　 ') + getLangName(opt.getAttribute('data-lang'));
    });
}
function getLangName(code) { return code === 'zh' ? '中文' : (code === 'ja' ? '日本語' : 'English'); }

// --- 4. 游戏核心逻辑 (基于你提供的代码) ---
// 修正画布尺寸以匹配 CSS
canvas.width = 400;
canvas.height = 600;

const bird = { x: 50, y: 150, radius: 15, gravity: 0.5, jump: 9, velocity: 0 };
let pipes = [];
const pipeWidth = 50;
const pipeGap = 160; // 稍微调整难度
const pipeInterval = 200; // 管道间距
let frameCount = 0;
let score = 0;
let isGameRunning = false;
let isGameOver = false;
let animationFrameId;

// 绑定按钮事件
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
homeBtn.addEventListener('click', () => {
    // 返回上一级目录的主页
    window.location.href = '../index.html'; 
});

function initGame() {
    score = 0;
    bird.y = canvas.height / 2;
    bird.velocity = 0;
    pipes = [];
    frameCount = 0;
    isGameOver = false;
    scoreDisplay.textContent = score;
}

function startGame() {
    initGame();
    isGameRunning = true;
    titleScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    scoreDisplay.classList.remove('hidden');
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    gameLoop();
}

function stopGame(win = false) {
    isGameRunning = false;
    isGameOver = true;
    const t = translations[currentLang];
    
    endTitle.textContent = win ? t.win : t.gameOver;
    endScore.textContent = `${t.score}: ${score}`;
    
    gameOverScreen.classList.remove('hidden');
}

// 物理逻辑
function update() {
    // 小鸟物理
    bird.velocity += bird.gravity;
    bird.y += bird.velocity;

    // 地板和天花板碰撞
    if (bird.y + bird.radius >= canvas.height) {
        bird.y = canvas.height - bird.radius;
        stopGame();
    }
    if (bird.y - bird.radius <= 0) {
        bird.y = bird.radius;
        bird.velocity = 0;
    }

    // 管道逻辑
    if (frameCount % 180 === 0) { // 每180帧生成一个管道
        let pipeTopHeight = Math.random() * (canvas.height - pipeGap - 100) + 50;
        pipes.push({
            x: canvas.width,
            top: pipeTopHeight,
            bottom: canvas.height - pipeTopHeight - pipeGap,
            scored: false
        });
    }

    pipes.forEach((pipe, index) => {
        pipe.x -= 2;

        // 碰撞检测
        if (
            bird.x + bird.radius > pipe.x && 
            bird.x - bird.radius < pipe.x + pipeWidth &&
            (bird.y - bird.radius < pipe.top || bird.y + bird.radius > canvas.height - pipe.bottom)
        ) {
            stopGame();
        }

        // 得分逻辑
        if (!pipe.scored && pipe.x + pipeWidth < bird.x) {
            score++;
            pipe.scored = true;
            scoreDisplay.textContent = score;
        }

        // 移除屏幕外的管道
        if (pipe.x + pipeWidth < 0) {
            pipes.splice(index, 1);
        }
    });

    frameCount++;
}

// 绘图逻辑
function draw() {
    // 清空画布 (背景色由 CSS 控制，这里只需 clearRect)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 画小鸟
    ctx.beginPath();
    ctx.arc(bird.x, bird.y, bird.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#f4d03f"; // 黄色小鸟
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#000";
    ctx.stroke();
    ctx.closePath();
    
    // 画眼睛 (增加一点细节)
    ctx.beginPath();
    ctx.arc(bird.x + 5, bird.y - 5, 4, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();
    ctx.closePath();

    // 画管道
    pipes.forEach(pipe => {
        ctx.fillStyle = "#2ecc71"; // 绿色管道
        ctx.strokeStyle = "#27ae60";
        
        // 上管道
        ctx.fillRect(pipe.x, 0, pipeWidth, pipe.top);
        ctx.strokeRect(pipe.x, 0, pipeWidth, pipe.top);
        
        // 下管道
        ctx.fillRect(pipe.x, canvas.height - pipe.bottom, pipeWidth, pipe.bottom);
        ctx.strokeRect(pipe.x, canvas.height - pipe.bottom, pipeWidth, pipe.bottom);
    });
}

function gameLoop() {
    if (isGameRunning) {
        update();
        draw();
        animationFrameId = requestAnimationFrame(gameLoop);
    }
}

// 输入控制
function jump() {
    if (isGameRunning && !isGameOver) {
        bird.velocity = -bird.jump;
    }
}

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        if (!isGameRunning && titleScreen.classList.contains('hidden') === false) {
            startGame(); // 如果在标题画面按空格，开始游戏
        } else {
            jump();
        }
    }
});

canvas.addEventListener('mousedown', (e) => {
    if (isGameRunning) jump();
});

// 防止空格键滚动页面
window.addEventListener('keydown', function(e) {
    if(e.code == "Space" && e.target == document.body) {
        e.preventDefault();
    }
});