// ============================================================
// BEAN BUDDY - Game Engine
// ============================================================

// ---- CONSTANTS ----
const TICK_INTERVAL = 1000; // 1 second game ticks
const STAT_DECAY_PER_MIN = 0.5; // each stat loses 0.5 per minute
const HUNGOVER_DECAY_MULT = 2.5; // stats drain 2.5x faster when hungover
const COINS_PER_HOUR = 1;
const HUNGOVER_DURATION = 5 * 60 * 1000; // 5 minutes
const BEER_HANGOVER_THRESHOLD = 3; // 3 beers in 10 min = hungover
const BEER_WINDOW = 10 * 60 * 1000; // 10 minute window for beer count
const RANDOM_EVENT_CHANCE = 0.005; // ~0.5% per tick (roughly every 3-4 min)

// ---- FURNITURE CATALOG ----
const STARTER_FURNITURE = ['bed', 'desk']; // free items every bean starts with

const FURNITURE = [
    { id: 'bed',       name: 'Bed',            icon: '🛏️', price: 0,   desc: 'Every bean needs sleep', starter: true },
    { id: 'desk',      name: 'Desk',           icon: '🖥️', price: 0,   desc: 'A trusty workspace', starter: true },
    { id: 'rug',       name: 'Cozy Rug',      icon: '🟫', price: 5,   desc: 'A warm woven rug' },
    { id: 'plant',     name: 'Potted Plant',   icon: '🪴', price: 3,   desc: 'A little green friend' },
    { id: 'poster',    name: 'Disc Golf Poster', icon: '🖼️', price: 4, desc: 'Send it!' },
    { id: 'lamp',      name: 'Lava Lamp',      icon: '🪔', price: 8,   desc: 'Groovy vibes' },
    { id: 'shelf',     name: 'Trophy Shelf',   icon: '🏆', price: 10,  desc: 'Show off your aces' },
    { id: 'fridge',    name: 'Mini Fridge',    icon: '🧊', price: 12,  desc: 'Keep the beers cold' },
    { id: 'couch',     name: 'Bean Bag Chair', icon: '🛋️', price: 15,  desc: 'Ironic? Maybe.' },
    { id: 'tv',        name: 'Retro TV',       icon: '📺', price: 20,  desc: 'Watches disc golf highlights' },
    { id: 'stereo',    name: 'Stereo System',  icon: '🔊', price: 18,  desc: 'Bumpin\' tunes' },
    { id: 'aquarium',  name: 'Fish Tank',      icon: '🐠', price: 25,  desc: 'Lil fishies!' },
    { id: 'neon',      name: 'Neon Sign',      icon: '💡', price: 30,  desc: '"BEANS" in neon' },
    { id: 'arcade',    name: 'Arcade Machine',  icon: '🕹️', price: 50,  desc: 'The ultimate flex' },
];

// ---- RANDOM EVENTS ----
const RANDOM_EVENTS = [
    { text: 'Your bean found a lost disc on the course!', coins: 2 },
    { text: 'A friend brought over pizza!', stat: 'hunger', amount: 15 },
    { text: 'Someone left a beer on your porch!', stat: 'thirst', amount: 10 },
    { text: 'Your bean\'s buddy stopped by!', stat: 'social', amount: 15 },
    { text: 'Your bean found $5 in the couch!', coins: 5 },
    { text: 'A squirrel stole your bean\'s snack!', stat: 'hunger', amount: -10 },
    { text: 'Your bean binged a funny show!', stat: 'fun', amount: 10 },
    { text: 'Your bean got a hole-in-one in a dream!', stat: 'fun', amount: 20 },
    { text: 'The neighbor\'s dog visited!', stat: 'social', amount: 10 },
    { text: 'Your bean won a raffle at the course!', coins: 8 },
    { text: 'Rain cancelled outdoor plans...', stat: 'fun', amount: -8 },
    { text: 'Your bean got invited to a cookout!', stat: 'social', amount: 20, stat2: 'hunger', amount2: 10 },
];

// ---- DISC GOLF ----
const DISC_TYPES = {
    putter:  { name: 'Putter',    accuracy: 0.85, power: 0.5, icon: '🥏' },
    mid:     { name: 'Mid-Range', accuracy: 0.65, power: 0.75, icon: '🥏' },
    driver:  { name: 'Driver',    accuracy: 0.45, power: 1.0, icon: '🥏' },
};

const DISC_OUTCOMES = [
    { minScore: 90, text: '🎯 ACE! Straight in the basket!', funBoost: 30, coins: 5 },
    { minScore: 75, text: '🔥 Birdie! Great throw!', funBoost: 20, coins: 2 },
    { minScore: 55, text: '👍 Par - solid shot!', funBoost: 12, coins: 1 },
    { minScore: 35, text: '😅 Bogey... hit a tree.', funBoost: 5, coins: 0 },
    { minScore: 15, text: '🌲 Double bogey - deep in the woods!', funBoost: 2, coins: 0 },
    { minScore: 0,  text: '💀 Lost the disc in the pond...', funBoost: 0, coins: 0 },
];

// Default placements for starter furniture
const DEFAULT_PLACEMENTS = {
    bed:  { x: 290, y: 155, scale: 1, rotation: 0, flip: false },
    desk: { x: 100, y: 155, scale: 1, rotation: 0, flip: false },
};

// ---- GAME STATE ----
let state = {
    beanName: '',
    hunger: 100,
    thirst: 100,
    social: 100,
    fun: 100,
    coins: 0,
    alive: true,
    hungover: false,
    hungoverUntil: 0,
    beerTimestamps: [],
    furniture: [...STARTER_FURNITURE],
    // placement data: { itemId: { x, y, scale, rotation } }
    furniturePlacement: { ...DEFAULT_PLACEMENTS },
    totalAliveTime: 0,
    lastUpdate: Date.now(),
    created: Date.now(),
};

// ---- DOM REFS ----
const $ = id => document.getElementById(id);
const canvas = $('room-canvas');
let ctx = canvas.getContext('2d');
const discCanvas = $('disc-canvas');
let discCtx = discCanvas.getContext('2d');

// ---- PIXEL ART RENDERING ----
// Draws to a half-res offscreen canvas, then blits scaled up for chunky pixels
const PIXEL_SCALE = 2;
const pixelBuffers = {};

function initPixelBuffer(name, realCanvas) {
    const off = document.createElement('canvas');
    off.width = Math.floor(realCanvas.width / PIXEL_SCALE);
    off.height = Math.floor(realCanvas.height / PIXEL_SCALE);
    const offCtx = off.getContext('2d');
    offCtx.imageSmoothingEnabled = false;
    pixelBuffers[name] = { off, offCtx, realCanvas };
}

function pixelBegin(name) {
    const buf = pixelBuffers[name];
    buf.offCtx.clearRect(0, 0, buf.off.width, buf.off.height);
    buf.offCtx.save();
    buf.offCtx.scale(1 / PIXEL_SCALE, 1 / PIXEL_SCALE);
    return buf.offCtx;
}

function pixelEnd(name) {
    const buf = pixelBuffers[name];
    buf.offCtx.restore();
    const realCtx = buf.realCanvas.getContext('2d');
    realCtx.imageSmoothingEnabled = false;
    realCtx.clearRect(0, 0, buf.realCanvas.width, buf.realCanvas.height);
    realCtx.drawImage(buf.off, 0, 0, buf.realCanvas.width, buf.realCanvas.height);
}

// ---- SAVE / LOAD ----
function saveGame() {
    state.lastUpdate = Date.now();
    localStorage.setItem('beanBuddy', JSON.stringify(state));
}

function loadGame() {
    const saved = localStorage.getItem('beanBuddy');
    if (saved) {
        const parsed = JSON.parse(saved);
        state = { ...state, ...parsed };
        // Ensure starter furniture is always present
        STARTER_FURNITURE.forEach(id => {
            if (!state.furniture.includes(id)) state.furniture.push(id);
        });
        // Ensure placement data exists
        if (!state.furniturePlacement) state.furniturePlacement = {};
        state.furniture.forEach(id => {
            if (!state.furniturePlacement[id]) {
                state.furniturePlacement[id] = DEFAULT_PLACEMENTS[id] || { x: 200, y: 180, scale: 1, rotation: 0, flip: false };
            }
        });
        // Process offline time
        const now = Date.now();
        const elapsed = now - state.lastUpdate;
        if (elapsed > 0 && state.alive) {
            const minutes = elapsed / 60000;
            const decay = STAT_DECAY_PER_MIN * minutes;
            state.hunger = Math.max(0, state.hunger - decay);
            state.thirst = Math.max(0, state.thirst - decay);
            state.social = Math.max(0, state.social - decay);
            state.fun = Math.max(0, state.fun - decay);
            // Earn coins for offline time
            const hours = elapsed / 3600000;
            state.coins += Math.floor(hours * COINS_PER_HOUR);
            state.totalAliveTime += elapsed;
            // Check if bean died offline
            if (state.hunger <= 0 && state.thirst <= 0 && state.social <= 0 && state.fun <= 0) {
                state.alive = false;
            }
        }
        // Clear expired hungover
        if (state.hungover && now > state.hungoverUntil) {
            state.hungover = false;
        }
        state.lastUpdate = now;
    }
}

// ---- GAME LOOP ----
let lastTick = Date.now();
let coinAccumulator = 0;
let animFrame = 0;

function gameTick() {
    if (!state.alive) {
        $('passed-out-overlay').classList.remove('hidden');
        return;
    }

    const now = Date.now();
    const dt = (now - lastTick) / 1000; // seconds since last tick
    lastTick = now;

    // Stat decay
    const decayMult = state.hungover ? HUNGOVER_DECAY_MULT : 1;
    const decay = (STAT_DECAY_PER_MIN / 60) * dt * decayMult;
    state.hunger = Math.max(0, state.hunger - decay);
    state.thirst = Math.max(0, state.thirst - decay);
    state.social = Math.max(0, state.social - decay);
    state.fun = Math.max(0, state.fun - decay);

    // Coin earning
    coinAccumulator += dt;
    if (coinAccumulator >= 3600 / COINS_PER_HOUR) {
        state.coins += 1;
        coinAccumulator -= 3600 / COINS_PER_HOUR;
    }

    state.totalAliveTime += dt * 1000;

    // Check hungover expiry
    if (state.hungover && now > state.hungoverUntil) {
        state.hungover = false;
        showNotification('Your bean sobered up! Feeling better now.');
    }

    // Clean old beer timestamps
    state.beerTimestamps = state.beerTimestamps.filter(t => now - t < BEER_WINDOW);

    // Check passed out
    if (state.hunger <= 0 && state.thirst <= 0 && state.social <= 0 && state.fun <= 0) {
        state.alive = false;
        $('passed-out-overlay').classList.remove('hidden');
        saveGame();
        return;
    }

    // Random events
    if (Math.random() < RANDOM_EVENT_CHANCE) {
        triggerRandomEvent();
    }

    // Update UI
    updateStatBars();
    updateStatusText();
    updateCoinDisplay();

    // Save periodically (every 30s)
    if (Math.floor(now / 30000) !== Math.floor((now - dt * 1000) / 30000)) {
        saveGame();
    }
}

// ---- RENDERING ----
const COLORS = {
    floorLight: '#C89858',
    floorDark: '#B08048',
    wallLeft: '#A87840',
    wallRight: '#987038',
    wallTrim: '#786030',
    windowFrame: '#E8D8C0',
    windowGlass: '#70A8C8',
    sky: '#88A898',
};

function drawRoom() {
    ctx = pixelBegin('room');
    const w = canvas.width;
    const h = canvas.height;

    // Background (sage green like reference)
    ctx.fillStyle = COLORS.sky;
    ctx.fillRect(0, 0, w, h);

    // --- Isometric room ---
    const cx = w / 2;      // center x
    const floorY = h * 0.72; // floor level
    const roomW = w * 0.8;
    const wallH = h * 0.5;
    const depth = roomW * 0.35;

    // Floor (diamond shape)
    ctx.fillStyle = COLORS.floorLight;
    ctx.beginPath();
    ctx.moveTo(cx, floorY);
    ctx.lineTo(cx + roomW / 2, floorY - depth / 2);
    ctx.lineTo(cx, floorY - depth);
    ctx.lineTo(cx - roomW / 2, floorY - depth / 2);
    ctx.closePath();
    ctx.fill();

    // Floor planks
    ctx.strokeStyle = COLORS.floorDark;
    ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
        const t = i / 8;
        const x1 = cx - roomW / 2 + (roomW / 2) * t;
        const y1 = floorY - depth / 2 - (depth / 2) * t;
        const x2 = cx + (roomW / 2) * t;
        const y2 = floorY - (depth / 2) * t;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    // Left wall
    ctx.fillStyle = COLORS.wallLeft;
    ctx.beginPath();
    ctx.moveTo(cx - roomW / 2, floorY - depth / 2);
    ctx.lineTo(cx, floorY - depth);
    ctx.lineTo(cx, floorY - depth - wallH);
    ctx.lineTo(cx - roomW / 2, floorY - depth / 2 - wallH);
    ctx.closePath();
    ctx.fill();

    // Left wall planks
    ctx.strokeStyle = '#A07840';
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
        const t = i / 6;
        const baseY = floorY - depth / 2 - wallH;
        const yOff = wallH * t;
        ctx.beginPath();
        ctx.moveTo(cx - roomW / 2, baseY + yOff);
        ctx.lineTo(cx, floorY - depth - wallH + yOff);
        ctx.stroke();
    }

    // Right wall
    ctx.fillStyle = COLORS.wallRight;
    ctx.beginPath();
    ctx.moveTo(cx, floorY - depth);
    ctx.lineTo(cx + roomW / 2, floorY - depth / 2);
    ctx.lineTo(cx + roomW / 2, floorY - depth / 2 - wallH);
    ctx.lineTo(cx, floorY - depth - wallH);
    ctx.closePath();
    ctx.fill();

    // Right wall planks
    ctx.strokeStyle = '#946E3C';
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
        const t = i / 6;
        const baseY = floorY - depth - wallH;
        const yOff = wallH * t;
        ctx.beginPath();
        ctx.moveTo(cx, baseY + yOff);
        ctx.lineTo(cx + roomW / 2, floorY - depth / 2 - wallH + yOff);
        ctx.stroke();
    }

    // Wall edges/trim
    ctx.strokeStyle = COLORS.wallTrim;
    ctx.lineWidth = 2;
    // Left wall edge
    ctx.beginPath();
    ctx.moveTo(cx - roomW / 2, floorY - depth / 2);
    ctx.lineTo(cx - roomW / 2, floorY - depth / 2 - wallH);
    ctx.stroke();
    // Right wall edge
    ctx.beginPath();
    ctx.moveTo(cx + roomW / 2, floorY - depth / 2);
    ctx.lineTo(cx + roomW / 2, floorY - depth / 2 - wallH);
    ctx.stroke();
    // Top edges
    ctx.beginPath();
    ctx.moveTo(cx - roomW / 2, floorY - depth / 2 - wallH);
    ctx.lineTo(cx, floorY - depth - wallH);
    ctx.lineTo(cx + roomW / 2, floorY - depth / 2 - wallH);
    ctx.stroke();
    // Corner
    ctx.beginPath();
    ctx.moveTo(cx, floorY - depth);
    ctx.lineTo(cx, floorY - depth - wallH);
    ctx.stroke();

    // Window on right wall
    const winCx = cx + roomW * 0.25;
    const winCy = floorY - depth * 0.75 - wallH * 0.55;
    const winW = roomW * 0.15;
    const winH = wallH * 0.35;
    // Window frame
    ctx.fillStyle = COLORS.windowFrame;
    ctx.fillRect(winCx - winW / 2, winCy - winH / 2, winW, winH);
    // Window glass
    ctx.fillStyle = COLORS.windowGlass;
    ctx.fillRect(winCx - winW / 2 + 3, winCy - winH / 2 + 3, winW - 6, winH - 6);
    // Window cross
    ctx.strokeStyle = COLORS.windowFrame;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(winCx, winCy - winH / 2 + 3);
    ctx.lineTo(winCx, winCy + winH / 2 - 3);
    ctx.moveTo(winCx - winW / 2 + 3, winCy);
    ctx.lineTo(winCx + winW / 2 - 3, winCy);
    ctx.stroke();

    // Draw furniture
    drawFurniture();

    // Draw the bean!
    drawBean(cx, floorY, depth);

    pixelEnd('room');
}

function drawFurniture() {
    // Sort by y position so items further back render first
    const sorted = [...state.furniture].sort((a, b) => {
        const pa = state.furniturePlacement[a] || { y: 0 };
        const pb = state.furniturePlacement[b] || { y: 0 };
        return pa.y - pb.y;
    });

    sorted.forEach(id => {
        const item = FURNITURE.find(f => f.id === id);
        const placement = state.furniturePlacement[id];
        if (!item || !placement) return;

        const { x, y, scale, rotation, flip } = placement;

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(flip ? -scale : scale, scale);
        ctx.rotate(rotation * Math.PI / 2); // rotation is 0-3 (quarter turns)

        if (id === 'bed') {
            drawBed(0, 0);
        } else if (id === 'desk') {
            drawDesk(0, 0);
        } else {
            // Emoji items - scale the font size
            const fontSize = Math.round(28);
            ctx.font = fontSize + 'px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(item.icon, 0, 0);
        }

        // In decorate mode, draw selection ring
        if (decorateMode && decoSelectedItem === id) {
            ctx.strokeStyle = '#F0C674';
            ctx.lineWidth = 2 / scale;
            ctx.setLineDash([4 / scale, 4 / scale]);
            ctx.beginPath();
            ctx.arc(0, 0, 30, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.restore();
    });
}

// Isometric helper: draw a parallelogram (iso box face)
function isoQuad(x, y, points, color, strokeColor) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + points[0][0], y + points[0][1]);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(x + points[i][0], y + points[i][1]);
    }
    ctx.closePath();
    ctx.fill();
    if (strokeColor) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
}

function drawBed(x, y) {
    // Isometric bed matching the room perspective
    // Bed runs along the right wall direction

    // === Bed frame (wooden base) ===
    // Top face of frame
    isoQuad(x, y, [
        [0, 0], [40, -16], [40 + 20, -16 + 8], [20, 8]
    ], '#8B6538', '#6B4F2E');
    // Front face of frame
    isoQuad(x, y, [
        [20, 8], [40 + 20, -16 + 8], [40 + 20, -16 + 8 + 10], [20, 18]
    ], '#6B4F2E', '#5C4025');
    // Left face of frame
    isoQuad(x, y, [
        [0, 0], [20, 8], [20, 18], [0, 10]
    ], '#7A5830', '#5C4025');

    // === Mattress ===
    // Top face
    isoQuad(x, y, [
        [2, -1], [38, -15.5], [56, -7.5], [20, 7]
    ], '#F0E4D0', '#D4C8B0');

    // === Blanket (blue, covers most of mattress) ===
    isoQuad(x, y, [
        [12, 3], [38, -15.5], [56, -7.5], [30, 3]
    ], '#6B8EC4', '#5A7DB3');
    // Blanket fold highlight
    isoQuad(x, y, [
        [12, 3], [38, -9], [56, -7.5], [30, 3]
    ], '#7B9ED4');

    // === Pillow ===
    isoQuad(x, y, [
        [3, 0], [16, -5], [26, -1], [13, 4]
    ], '#E8DCC8', '#C4B8A0');
    // Pillow puff (slight highlight)
    isoQuad(x, y, [
        [5, -0.5], [14, -4], [22, -1.5], [13, 2.5]
    ], '#F0E8DA');

    // === Headboard ===
    // Front face
    isoQuad(x, y, [
        [-2, -2], [0, -18], [20, -10], [18, 6]
    ], '#6B4F2E', '#5C4025');
    // Top edge
    isoQuad(x, y, [
        [0, -18], [4, -20], [24, -12], [20, -10]
    ], '#8B6538', '#6B4F2E');
}

function drawDesk(x, y) {
    // Isometric desk with monitor, matching room perspective

    // === Desk legs ===
    // Back-left leg
    isoQuad(x, y, [
        [0, -2], [3, -3.5], [3, 14.5], [0, 16]
    ], '#7A5830', '#5C4025');
    // Back-right leg
    isoQuad(x, y, [
        [44, -20], [47, -21.5], [47, -3.5], [44, -2]
    ], '#7A5830', '#5C4025');
    // Front-right leg
    isoQuad(x, y, [
        [54, -14], [57, -15.5], [57, 2.5], [54, 4]
    ], '#6B4F2E', '#5C4025');
    // Front-left leg
    isoQuad(x, y, [
        [10, 4], [13, 2.5], [13, 20.5], [10, 22]
    ], '#6B4F2E', '#5C4025');

    // === Desktop surface ===
    // Top face
    isoQuad(x, y, [
        [0, -2], [44, -20], [58, -13], [14, 5]
    ], '#B08850', '#8B6538');
    // Front face (thickness)
    isoQuad(x, y, [
        [14, 5], [58, -13], [58, -10], [14, 8]
    ], '#9A7642', '#7A5830');
    // Left face (thickness)
    isoQuad(x, y, [
        [0, -2], [14, 5], [14, 8], [0, 1]
    ], '#8B6538', '#7A5830');

    // === Monitor ===
    // Monitor back/body
    isoQuad(x, y, [
        [18, -22], [38, -30], [38, -12], [18, -4]
    ], '#B0AAC0', '#8888A0');
    // Screen bezel (dark)
    isoQuad(x, y, [
        [19, -21], [37, -29], [37, -13], [19, -5]
    ], '#444460');
    // Screen (glowing)
    isoQuad(x, y, [
        [20, -20], [36, -28], [36, -14], [20, -6]
    ], '#6BAADD');
    // Rainbow bar on screen (like reference CRT)
    isoQuad(x, y, [
        [20, -14], [36, -22], [36, -20], [20, -12]
    ], '#FF6B6B');
    isoQuad(x, y, [
        [20, -12], [36, -20], [36, -18], [20, -10]
    ], '#F0C674');
    isoQuad(x, y, [
        [20, -10], [36, -18], [36, -16], [20, -8]
    ], '#6FCF97');
    isoQuad(x, y, [
        [20, -8], [36, -16], [36, -14], [20, -6]
    ], '#5BA4E8');
    // Monitor stand
    isoQuad(x, y, [
        [25, -4], [30, -6.5], [30, -3], [25, -0.5]
    ], '#8888A0', '#666680');

    // === Keyboard on desk ===
    isoQuad(x, y, [
        [22, 0], [36, -5.5], [42, -2.5], [28, 3]
    ], '#555270', '#444460');
    // Key rows
    isoQuad(x, y, [
        [24, 0.5], [34, -4.5], [38, -2.5], [28, 2.5]
    ], '#666680');

    // === Chair (in front of desk) ===
    // Seat (isometric)
    isoQuad(x, y, [
        [18, 16], [28, 11], [38, 16], [28, 21]
    ], '#CC6666', '#AA4444');
    // Back rest
    isoQuad(x, y, [
        [18, 8], [28, 3], [28, 11], [18, 16]
    ], '#BB5555', '#993333');
    // Chair leg/pole
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 28, y + 16);
    ctx.lineTo(x + 28, y + 24);
    ctx.stroke();
    // Chair base
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 22, y + 25);
    ctx.lineTo(x + 34, y + 25);
    ctx.moveTo(x + 25, y + 24);
    ctx.lineTo(x + 31, y + 26);
    ctx.stroke();
}

// ---- BEAN CHARACTER ----
let beanBob = 0;
let beanBobDir = 1;
let beanBlinkTimer = 0;
let beanIsBlinking = false;
let beanAction = null; // current action animation
let beanActionTimer = 0;

function drawBean(cx, floorY, depth) {
    // Bean position (center of floor)
    const bx = cx;
    const by = floorY - depth * 0.45;

    // Bobbing animation
    beanBob += 0.06 * beanBobDir;
    if (beanBob > 3) beanBobDir = -1;
    if (beanBob < -1) beanBobDir = 1;

    // Blinking
    beanBlinkTimer++;
    if (beanBlinkTimer > 150) {
        beanIsBlinking = true;
        if (beanBlinkTimer > 158) {
            beanIsBlinking = false;
            beanBlinkTimer = 0;
        }
    }

    const bob = beanBob;
    const avgStat = (state.hunger + state.thirst + state.social + state.fun) / 4;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(bx, by + 2, 22, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bean body (kidney bean shape)
    ctx.save();
    ctx.translate(bx, by - 20 + bob);

    // Action animation offsets
    if (beanAction === 'eat') {
        ctx.rotate(Math.sin(beanActionTimer * 0.3) * 0.1);
    } else if (beanAction === 'drink') {
        ctx.rotate(-0.15);
    } else if (beanAction === 'friends') {
        ctx.translate(Math.sin(beanActionTimer * 0.2) * 3, 0);
    }

    // Body color based on health
    let bodyColor;
    if (avgStat > 70) bodyColor = '#8B6B4A';
    else if (avgStat > 40) bodyColor = '#A0825E';
    else if (avgStat > 15) bodyColor = '#B89878';
    else bodyColor = '#C8A888';

    // Main body
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 24, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.ellipse(-5, -6, 8, 14, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Body outline
    ctx.strokeStyle = '#5C4530';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 24, 0, 0, Math.PI * 2);
    ctx.stroke();

    // --- Face ---
    // Eyes
    if (beanIsBlinking) {
        // Closed eyes (lines)
        ctx.strokeStyle = '#3D2B1A';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-7, -6);
        ctx.lineTo(-3, -6);
        ctx.moveTo(3, -6);
        ctx.lineTo(7, -6);
        ctx.stroke();
    } else if (avgStat < 15) {
        // X eyes (very unhappy)
        ctx.strokeStyle = '#3D2B1A';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-8, -9); ctx.lineTo(-3, -4);
        ctx.moveTo(-3, -9); ctx.lineTo(-8, -4);
        ctx.moveTo(3, -9); ctx.lineTo(8, -4);
        ctx.moveTo(8, -9); ctx.lineTo(3, -4);
        ctx.stroke();
    } else if (state.hungover) {
        // Dizzy eyes (spirals represented as circles)
        ctx.strokeStyle = '#3D2B1A';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(-5, -6, 4, 0, Math.PI * 1.5);
        ctx.moveTo(9, -6);
        ctx.arc(5, -6, 4, 0, Math.PI * 1.5);
        ctx.stroke();
    } else {
        // Normal eyes
        ctx.fillStyle = '#3D2B1A';
        const eyeSize = avgStat > 50 ? 3 : 2.5;
        ctx.beginPath();
        ctx.arc(-5, -6, eyeSize, 0, Math.PI * 2);
        ctx.arc(5, -6, eyeSize, 0, Math.PI * 2);
        ctx.fill();

        // Eye shine
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(-4, -7.5, 1.2, 0, Math.PI * 2);
        ctx.arc(6, -7.5, 1.2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Cheeks (blush when happy)
    if (avgStat > 60) {
        ctx.fillStyle = 'rgba(230, 130, 100, 0.3)';
        ctx.beginPath();
        ctx.ellipse(-9, -1, 4, 3, 0, 0, Math.PI * 2);
        ctx.ellipse(9, -1, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Mouth
    ctx.strokeStyle = '#3D2B1A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (avgStat > 70) {
        // Big smile
        ctx.arc(0, 0, 7, 0.1, Math.PI - 0.1);
    } else if (avgStat > 40) {
        // Small smile
        ctx.arc(0, 1, 4, 0.2, Math.PI - 0.2);
    } else if (avgStat > 15) {
        // Neutral
        ctx.moveTo(-4, 4);
        ctx.lineTo(4, 4);
    } else {
        // Frown
        ctx.arc(0, 8, 5, Math.PI + 0.3, -0.3);
    }
    ctx.stroke();

    // Action-specific overlays
    if (beanAction === 'eat') {
        ctx.font = '14px sans-serif';
        ctx.fillText('🍔', 14, 2);
    } else if (beanAction === 'drink') {
        ctx.font = '14px sans-serif';
        ctx.fillText('🍺', 15, -2);
    } else if (beanAction === 'friends') {
        ctx.font = '12px sans-serif';
        ctx.fillText('💬', 16, -14);
    }

    // Little arms
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    // Left arm
    ctx.beginPath();
    ctx.moveTo(-16, 2);
    ctx.lineTo(-22, 10 + Math.sin(animFrame * 0.05) * 2);
    ctx.stroke();
    // Right arm
    ctx.beginPath();
    ctx.moveTo(16, 2);
    ctx.lineTo(22, 10 + Math.cos(animFrame * 0.05) * 2);
    ctx.stroke();
    // Arm outlines
    ctx.strokeStyle = '#5C4530';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-16, 2);
    ctx.lineTo(-22, 10 + Math.sin(animFrame * 0.05) * 2);
    ctx.moveTo(16, 2);
    ctx.lineTo(22, 10 + Math.cos(animFrame * 0.05) * 2);
    ctx.stroke();

    // Little feet
    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = '#5C4530';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(-7, 23, 6, 4, -0.2, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(7, 23, 6, 4, 0.2, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    ctx.restore();

    // Hungover indicator
    if (state.hungover) {
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        const spinAngle = animFrame * 0.03;
        const starDist = 18;
        for (let i = 0; i < 3; i++) {
            const a = spinAngle + (i * Math.PI * 2 / 3);
            const sx = bx + Math.cos(a) * starDist;
            const sy = by - 46 + bob + Math.sin(a) * 8;
            ctx.fillText('⭐', sx - 8, sy);
        }
    }

    // Action timer
    if (beanAction) {
        beanActionTimer++;
        if (beanActionTimer > 60) {
            beanAction = null;
            beanActionTimer = 0;
        }
    }
}

// ---- RENDER LOOP ----
function renderLoop() {
    animFrame++;
    if (currentScreen === 'room') {
        drawRoom();
    }
    requestAnimationFrame(renderLoop);
}

// ---- UI UPDATES ----
function updateStatBars() {
    const stats = ['hunger', 'thirst', 'social', 'fun'];
    stats.forEach(stat => {
        const val = Math.round(state[stat]);
        const bar = $(stat + '-bar');
        const valEl = $(stat + '-val');
        bar.style.width = val + '%';
        valEl.textContent = val;

        // Color classes
        bar.classList.remove('low', 'medium');
        if (val < 20) bar.classList.add('low');
        else if (val < 40) bar.classList.add('medium');
    });
}

function updateCoinDisplay() {
    $('coin-count').textContent = Math.floor(state.coins);
}

function updateBeanName() {
    const name = state.beanName || 'Your bean';
    $('title-text').textContent = state.beanName || 'Bean Buddy';
}

function bn() {
    return state.beanName || 'Your bean';
}

function updateStatusText() {
    const avg = (state.hunger + state.thirst + state.social + state.fun) / 4;
    let text;
    if (!state.alive) {
        text = bn() + ' has passed out... 💀';
    } else if (state.hungover) {
        text = bn() + ' is hungover... 🤢';
    } else if (avg > 80) {
        text = bn() + ' is vibing! 😎';
    } else if (avg > 60) {
        text = bn() + ' is chillin\' 😊';
    } else if (avg > 40) {
        text = bn() + ' could use some attention 😐';
    } else if (avg > 20) {
        text = bn() + ' is not doing great... 😟';
    } else {
        text = bn() + ' is in trouble! Help it! 😰';
    }
    $('status-text').textContent = text;
}

// ---- ACTIONS ----
let actionCooldowns = { feed: 0, beer: 0, friends: 0, disc: 0 };

function doAction(action) {
    if (!state.alive) return;
    const now = Date.now();
    if (actionCooldowns[action] && now < actionCooldowns[action]) return;

    switch (action) {
        case 'feed':
            state.hunger = Math.min(100, state.hunger + 25);
            beanAction = 'eat';
            beanActionTimer = 0;
            actionCooldowns.feed = now + 3000;
            showStatus('Nom nom nom! 🍔');
            break;

        case 'beer':
            state.thirst = Math.min(100, state.thirst + 20);
            state.fun = Math.min(100, state.fun + 8);
            state.beerTimestamps.push(now);
            beanAction = 'drink';
            beanActionTimer = 0;
            actionCooldowns.beer = now + 3000;

            // Check hangover
            const recentBeers = state.beerTimestamps.filter(t => now - t < BEER_WINDOW).length;
            if (recentBeers >= BEER_HANGOVER_THRESHOLD && !state.hungover) {
                state.hungover = true;
                state.hungoverUntil = now + HUNGOVER_DURATION;
                showNotification('🤢 Too many beers! Your bean is hungover! Stats will drain faster for 5 minutes.');
            } else {
                showStatus('Crack open a cold one! 🍺');
            }
            break;

        case 'friends':
            switchScreen('bar');
            enterBar();
            return;

        case 'disc':
            switchScreen('discgolf');
            startDiscGolf();
            return;
    }

    // Button cooldown visual
    const btn = $('btn-' + action);
    btn.classList.add('cooldown');
    btn.disabled = true;
    const cd = action === 'friends' ? 5000 : 3000;
    setTimeout(() => {
        btn.classList.remove('cooldown');
        btn.disabled = false;
    }, cd);

    saveGame();
}

function showStatus(text) {
    $('status-text').textContent = text;
    setTimeout(updateStatusText, 2500);
}

// ---- NOTIFICATIONS ----
function showNotification(text) {
    $('notification-text').textContent = text;
    $('notification').classList.remove('hidden');
}

// ---- RANDOM EVENTS ----
function triggerRandomEvent() {
    const event = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
    let text = event.text;

    if (event.coins) {
        state.coins += event.coins;
        text += ` (+${event.coins} coins!)`;
    }
    if (event.stat) {
        state[event.stat] = Math.max(0, Math.min(100, state[event.stat] + event.amount));
    }
    if (event.stat2) {
        state[event.stat2] = Math.max(0, Math.min(100, state[event.stat2] + event.amount2));
    }

    showNotification(text);
    saveGame();
}

// ---- SHOP ----
function renderShop() {
    const container = $('shop-items');
    container.innerHTML = '';

    FURNITURE.filter(item => !item.starter).forEach(item => {
        const owned = state.furniture.includes(item.id);
        const canAfford = state.coins >= item.price;
        const div = document.createElement('div');
        div.className = 'shop-item' + (owned ? ' owned' : '');
        div.innerHTML = `
            <div class="shop-item-icon">${item.icon}</div>
            <div class="shop-item-name">${item.name}</div>
            <div class="shop-item-price">${owned ? 'OWNED' : '⭐ ' + item.price}</div>
        `;
        if (!owned && canAfford) {
            div.addEventListener('click', () => buyFurniture(item));
        }
        container.appendChild(div);
    });

    // Owned list
    const ownedList = $('owned-list');
    ownedList.innerHTML = '';
    if (state.furniture.length === 0) {
        ownedList.innerHTML = '<span style="font-size:7px;color:#B8B0CC;">No furniture yet!</span>';
    } else {
        state.furniture.forEach(id => {
            const item = FURNITURE.find(f => f.id === id);
            if (item) {
                const tag = document.createElement('span');
                tag.className = 'owned-tag';
                tag.textContent = item.icon + ' ' + item.name;
                ownedList.appendChild(tag);
            }
        });
    }
}

function buyFurniture(item) {
    if (state.coins < item.price || state.furniture.includes(item.id)) return;
    state.coins -= item.price;
    state.furniture.push(item.id);
    // Give it a default placement in the center of the room
    state.furniturePlacement[item.id] = { x: 200, y: 180, scale: 1, rotation: 0, flip: false };
    showNotification(`You bought a ${item.name}! Go to Decorate to place it! 🎉`);
    renderShop();
    updateCoinDisplay();
    saveGame();
}

// ---- DISC GOLF MINI-GAME ----

// Hole layouts - each hole has unique character
const HOLES = [
    {
        name: 'The Meadow', par: 3, distance: 'short',
        basketX: 300, basketY: 100,
        teeX: 50, teeY: 300,
        trees: [{ x: 180, y: 160, s: 30 }],
        water: null, ob: null,
        fairwayCurve: 0,
    },
    {
        name: 'Tunnel Shot', par: 3, distance: 'short',
        basketX: 340, basketY: 90,
        teeX: 40, teeY: 310,
        trees: [
            { x: 140, y: 120, s: 35 }, { x: 150, y: 200, s: 32 },
            { x: 220, y: 100, s: 28 }, { x: 210, y: 210, s: 30 },
        ],
        water: null, ob: null,
        fairwayCurve: 0,
    },
    {
        name: 'Lakeside', par: 3, distance: 'medium',
        basketX: 330, basketY: 80,
        teeX: 50, teeY: 310,
        trees: [{ x: 120, y: 130, s: 25 }, { x: 350, y: 140, s: 28 }],
        water: { x: 200, y: 180, w: 100, h: 50 },
        ob: null,
        fairwayCurve: 0.3,
    },
    {
        name: 'The Dogleg', par: 4, distance: 'long',
        basketX: 360, basketY: 130,
        teeX: 40, teeY: 320,
        trees: [
            { x: 200, y: 80, s: 40 }, { x: 220, y: 110, s: 35 },
            { x: 180, y: 140, s: 30 },
        ],
        water: null, ob: null,
        fairwayCurve: -0.5,
    },
    {
        name: 'The Bomber', par: 4, distance: 'long',
        basketX: 360, basketY: 60,
        teeX: 30, teeY: 320,
        trees: [
            { x: 100, y: 150, s: 32 }, { x: 250, y: 100, s: 38 },
            { x: 300, y: 170, s: 26 }, { x: 160, y: 90, s: 28 },
        ],
        water: { x: 280, y: 110, w: 60, h: 40 },
        ob: null,
        fairwayCurve: 0.2,
    },
    {
        name: 'Island Green', par: 3, distance: 'medium',
        basketX: 280, basketY: 90,
        teeX: 60, teeY: 290,
        trees: [{ x: 140, y: 180, s: 22 }],
        water: { x: 220, y: 70, w: 130, h: 70 },
        ob: null,
        fairwayCurve: 0,
    },
    {
        name: 'Tight Fairway', par: 3, distance: 'short',
        basketX: 350, basketY: 110,
        teeX: 40, teeY: 300,
        trees: [
            { x: 120, y: 140, s: 26 }, { x: 130, y: 230, s: 30 },
            { x: 250, y: 130, s: 28 }, { x: 260, y: 220, s: 26 },
            { x: 320, y: 170, s: 24 },
        ],
        water: null, ob: null,
        fairwayCurve: 0,
    },
    {
        name: 'Downhill', par: 3, distance: 'medium',
        basketX: 320, basketY: 60,
        teeX: 60, teeY: 310,
        trees: [{ x: 200, y: 120, s: 34 }, { x: 280, y: 160, s: 26 }],
        water: null, ob: null,
        fairwayCurve: -0.2,
    },
    {
        name: 'The Ace Run', par: 2, distance: 'short',
        basketX: 260, basketY: 140,
        teeX: 60, teeY: 280,
        trees: [{ x: 160, y: 170, s: 20 }],
        water: null, ob: null,
        fairwayCurve: 0,
    },
];

const WIND_LABELS = [
    'Calm', 'Light breeze', 'Breezy', 'Windy', 'Gusty!'
];

const ROUND_LENGTH = 5; // holes per round

let discState = {
    phase: 'ready',
    disc: 'putter',
    power: 0,
    powerDir: 1,
    aim: 50,
    aimDir: 1,
    aimLocked: false,
    discX: 0, discY: 0,
    discVX: 0, discVY: 0,
    trail: [],
    // Round tracking
    holeIndex: 0,
    holes: [],
    scores: [],
    wind: 0,       // -1 to 1 (left to right)
    windStrength: 0, // 0-4
    hitTree: false,
    hitWater: false,
};

let discPowerInterval = null;
let discAimInterval = null;

function startDiscGolf() {
    // Pick random holes for a round
    const shuffled = [...HOLES].sort(() => Math.random() - 0.5);
    discState.holes = shuffled.slice(0, ROUND_LENGTH);
    discState.scores = [];
    discState.holeIndex = 0;
    $('disc-round-result').classList.add('hidden');
    startHole();
}

function startHole() {
    const hole = discState.holes[discState.holeIndex];
    // Random wind per hole
    discState.windStrength = Math.floor(Math.random() * 5);
    discState.wind = (Math.random() - 0.5) * 2 * (discState.windStrength / 4);

    discState.phase = 'aiming';
    discState.disc = 'mid';
    discState.power = 0;
    discState.powerDir = 1;
    discState.aim = 50;
    discState.aimDir = 1;
    discState.aimLocked = false;
    discState.discX = hole.teeX;
    discState.discY = hole.teeY;
    discState.trail = [];
    discState.hitTree = false;
    discState.hitWater = false;

    // Update HUD
    $('disc-hole-label').textContent = `Hole ${discState.holeIndex + 1}/${ROUND_LENGTH}`;
    const windDir = discState.wind > 0.1 ? '→' : discState.wind < -0.1 ? '←' : '';
    $('disc-wind-label').textContent = `Wind: ${WIND_LABELS[discState.windStrength]} ${windDir}`;
    updateScoreLabel();

    // Reset disc type buttons
    document.querySelectorAll('.disc-type').forEach(b => {
        b.classList.toggle('selected', b.dataset.disc === 'mid');
    });

    $('disc-controls').classList.remove('hidden');
    $('disc-result').classList.add('hidden');
    $('disc-round-result').classList.add('hidden');
    $('power-bar-fill').style.width = '0%';
    $('aim-marker').style.left = '50%';

    discCtx = pixelBegin('disc');
    drawDiscCourse();
    pixelEnd('disc');
    startAimLoop();
}

function updateScoreLabel() {
    const totalPar = discState.scores.reduce((sum, s, i) => sum + discState.holes[i].par, 0);
    const totalStrokes = discState.scores.reduce((sum, s) => sum + s, 0);
    const diff = totalStrokes - totalPar;
    let label;
    if (discState.scores.length === 0) label = 'Score: E';
    else if (diff === 0) label = 'Score: E';
    else if (diff > 0) label = `Score: +${diff}`;
    else label = `Score: ${diff}`;
    $('disc-score-label').textContent = label;
}

function startAimLoop() {
    if (discAimInterval) clearInterval(discAimInterval);
    discState.aimLocked = false;
    const speed = 1.5 + discState.windStrength * 0.3; // aim harder in wind
    discAimInterval = setInterval(() => {
        if (discState.phase !== 'aiming' || discState.aimLocked) return;
        discState.aim += discState.aimDir * speed;
        if (discState.aim >= 100) { discState.aim = 100; discState.aimDir = -1; }
        if (discState.aim <= 0) { discState.aim = 0; discState.aimDir = 1; }
        $('aim-marker').style.left = discState.aim + '%';
    }, 30);
}

function startPowerLoop() {
    if (discPowerInterval) clearInterval(discPowerInterval);
    discState.phase = 'power';
    discState.power = 0;
    discState.powerDir = 1;
    discPowerInterval = setInterval(() => {
        if (discState.phase !== 'power') { clearInterval(discPowerInterval); return; }
        discState.power += discState.powerDir * 2.5;
        if (discState.power >= 100) discState.powerDir = -1;
        if (discState.power <= 0) discState.powerDir = 1;
        $('power-bar-fill').style.width = discState.power + '%';
    }, 30);
}

function throwDisc() {
    // First press locks aim, second press locks power
    if (discState.phase === 'aiming') {
        discState.aimLocked = true;
        clearInterval(discAimInterval);
        startPowerLoop();
        return;
    }
    if (discState.phase !== 'power') return;

    clearInterval(discPowerInterval);
    discState.phase = 'throwing';
    $('disc-controls').classList.add('hidden');

    const hole = discState.holes[discState.holeIndex];
    const disc = DISC_TYPES[discState.disc];
    const power = discState.power / 100;
    const aimOffset = (discState.aim - 50) / 50; // -1 to 1

    // Target with aim offset applied
    const aimSpread = 80;
    const targetX = hole.basketX + aimOffset * aimSpread;
    const targetY = hole.basketY + Math.abs(aimOffset) * 20;

    // Wind push
    const windPush = discState.wind * 40;

    // Disc type affects trajectory
    const powerMult = disc.power;
    const accuracyBase = disc.accuracy;

    // Random accuracy jitter (less for putter, more for driver)
    const jitter = (1 - accuracyBase) * 50;
    const jitterX = (Math.random() - 0.5) * jitter;
    const jitterY = (Math.random() - 0.5) * jitter * 0.5;

    // Under/over power: sweet spot is 60-80%
    const powerPenalty = Math.abs(power - 0.7) * 30;
    const effectivePower = power * powerMult;

    // Final landing spot
    const landX = targetX + windPush + jitterX + (1 - effectivePower) * (hole.teeX - hole.basketX) * 0.3;
    const landY = targetY + jitterY + (1 - effectivePower) * (hole.teeY - hole.basketY) * 0.3;

    // Animate flight
    const startX = hole.teeX + 10;
    const startY = hole.teeY - 20;
    discState.discX = startX;
    discState.discY = startY;
    discState.trail = [];

    const totalFrames = 50;
    let frame = 0;

    const throwAnim = setInterval(() => {
        frame++;
        const t = frame / totalFrames;
        discState.trail.push({ x: discState.discX, y: discState.discY });
        if (discState.trail.length > 25) discState.trail.shift();

        // Bezier curve flight path with wind curve
        const curve = hole.fairwayCurve * 80 + windPush * 0.5;
        const midX = (startX + landX) / 2 + curve;
        const midY = (startY + landY) / 2 - 60 * effectivePower;
        discState.discX = (1-t)*(1-t)*startX + 2*(1-t)*t*midX + t*t*landX;
        discState.discY = (1-t)*(1-t)*startY + 2*(1-t)*t*midY + t*t*landY;

        // Check tree collision
        if (!discState.hitTree) {
            for (const tree of hole.trees) {
                const dx = discState.discX - tree.x;
                const dy = discState.discY - tree.y;
                if (Math.sqrt(dx*dx + dy*dy) < tree.s * 0.4) {
                    discState.hitTree = true;
                    // Deflect
                    discState.discVX = (Math.random() - 0.5) * 3;
                    discState.discVY = Math.random() * 2;
                }
            }
        }

        if (discState.hitTree) {
            discState.discX += (discState.discVX || 0);
            discState.discY += (discState.discVY || 0);
            if (discState.discVX) discState.discVX *= 0.92;
            if (discState.discVY) discState.discVY *= 0.92;
        }

        discCtx = pixelBegin('disc');
        drawDiscCourse();
        drawDiscFlying();
        pixelEnd('disc');

        if (frame >= totalFrames) {
            clearInterval(throwAnim);

            // Check water hazard
            if (hole.water) {
                const wx = hole.water.x, wy = hole.water.y;
                const ww = hole.water.w, wh = hole.water.h;
                if (discState.discX > wx - ww/2 && discState.discX < wx + ww/2 &&
                    discState.discY > wy - wh/2 && discState.discY < wy + wh/2) {
                    discState.hitWater = true;
                }
            }

            showHoleResult(landX, landY, hole);
        }
    }, 28);
}

function showHoleResult(landX, landY, hole) {
    discState.phase = 'result';
    const dx = landX - hole.basketX;
    const dy = landY - hole.basketY;
    const dist = Math.sqrt(dx*dx + dy*dy);

    let strokes;
    let resultEmoji;
    let resultLabel;

    if (discState.hitWater) {
        strokes = hole.par + 2;
        resultEmoji = '💦';
        resultLabel = 'In the water! +2 penalty';
    } else if (discState.hitTree) {
        if (dist < 50) { strokes = hole.par; resultEmoji = '🌲'; resultLabel = 'Hit a tree but saved par!'; }
        else { strokes = hole.par + 1; resultEmoji = '🌲'; resultLabel = 'Kicked off a tree - bogey'; }
    } else if (dist < 12) {
        strokes = 1;
        resultEmoji = '🎯';
        resultLabel = 'ACE!!!';
    } else if (dist < 25) {
        strokes = Math.max(1, hole.par - 2);
        resultEmoji = '🦅';
        resultLabel = hole.par >= 4 ? 'Eagle!' : 'Birdie!';
    } else if (dist < 45) {
        strokes = Math.max(1, hole.par - 1);
        resultEmoji = '🔥';
        resultLabel = 'Birdie!';
    } else if (dist < 70) {
        strokes = hole.par;
        resultEmoji = '👍';
        resultLabel = 'Par - solid!';
    } else if (dist < 110) {
        strokes = hole.par + 1;
        resultEmoji = '😅';
        resultLabel = 'Bogey';
    } else {
        strokes = hole.par + 2;
        resultEmoji = '😬';
        resultLabel = 'Double bogey';
    }

    discState.scores.push(strokes);

    const diff = strokes - hole.par;
    const diffStr = diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`;

    let text = `${resultEmoji} ${resultLabel}\n`;
    text += `${hole.name} - Par ${hole.par}\n`;
    text += `Score: ${strokes} (${diffStr})`;

    $('disc-result-text').textContent = text;
    $('disc-result').classList.remove('hidden');

    // Change button text based on round progress
    const nextBtn = $('disc-next');
    if (discState.holeIndex >= ROUND_LENGTH - 1) {
        nextBtn.textContent = 'See Results';
    } else {
        nextBtn.textContent = 'Next Hole';
    }

    updateScoreLabel();
}

function nextHole() {
    discState.holeIndex++;
    if (discState.holeIndex >= ROUND_LENGTH) {
        showRoundResult();
    } else {
        startHole();
    }
}

function showRoundResult() {
    $('disc-result').classList.add('hidden');
    $('disc-controls').classList.add('hidden');

    const totalPar = discState.holes.reduce((sum, h) => sum + h.par, 0);
    const totalStrokes = discState.scores.reduce((sum, s) => sum + s, 0);
    const diff = totalStrokes - totalPar;
    const diffStr = diff === 0 ? 'Even' : diff > 0 ? `+${diff}` : `${diff}`;

    // Calculate rewards
    let bonusCoins = 0;
    let funBoost = 0;
    if (diff <= -3) { bonusCoins = 10; funBoost = 35; }
    else if (diff <= -1) { bonusCoins = 6; funBoost = 28; }
    else if (diff <= 0) { bonusCoins = 4; funBoost = 22; }
    else if (diff <= 2) { bonusCoins = 2; funBoost = 15; }
    else { bonusCoins = 1; funBoost = 8; }

    // Check for any aces
    const aces = discState.scores.filter((s, i) => s === 1).length;
    if (aces > 0) { bonusCoins += aces * 5; }

    state.fun = Math.min(100, state.fun + funBoost);
    state.social = Math.min(100, state.social + 8);
    state.coins += bonusCoins;

    let text = `Round Complete!\n`;
    text += `${totalStrokes} strokes (${diffStr})\n\n`;

    // Hole-by-hole
    discState.holes.forEach((h, i) => {
        const s = discState.scores[i];
        const d = s - h.par;
        const ds = d === 0 ? 'E' : d > 0 ? `+${d}` : `${d}`;
        text += `${h.name}: ${s} (${ds})\n`;
    });

    text += `\n+${bonusCoins} coins, +${funBoost} fun`;
    if (aces > 0) text += `\n🎯 ${aces} ACE${aces > 1 ? 'S' : ''}! (+${aces * 5} bonus coins)`;

    $('disc-round-text').textContent = text;
    $('disc-round-result').classList.remove('hidden');

    updateStatBars();
    updateCoinDisplay();
    saveGame();
}

function drawDiscCourse() {
    const w = discCanvas.width;
    const h = discCanvas.height;
    const hole = discState.holes[discState.holeIndex];

    // Sky gradient - varies by hole index for visual variety
    const skyColors = ['#87CEEB', '#A0C4E8', '#E8C4A0', '#C4D8E8', '#B8D8B8'];
    const skyTop = skyColors[discState.holeIndex % skyColors.length];
    const skyGrad = discCtx.createLinearGradient(0, 0, 0, h * 0.55);
    skyGrad.addColorStop(0, skyTop);
    skyGrad.addColorStop(1, '#B8E6B8');
    discCtx.fillStyle = skyGrad;
    discCtx.fillRect(0, 0, w, h * 0.55);

    // Distant hills
    discCtx.fillStyle = '#6DAF6D';
    discCtx.beginPath();
    discCtx.moveTo(0, h * 0.5);
    discCtx.quadraticCurveTo(w * 0.25, h * 0.38, w * 0.5, h * 0.48);
    discCtx.quadraticCurveTo(w * 0.75, h * 0.40, w, h * 0.5);
    discCtx.lineTo(w, h * 0.55);
    discCtx.lineTo(0, h * 0.55);
    discCtx.fill();

    // Ground
    discCtx.fillStyle = '#4A8F4A';
    discCtx.fillRect(0, h * 0.52, w, h * 0.48);

    // Rough (slightly darker patches)
    discCtx.fillStyle = '#3D7D3D';
    discCtx.beginPath();
    discCtx.ellipse(80, h * 0.7, 50, 20, 0.3, 0, Math.PI * 2);
    discCtx.fill();
    discCtx.beginPath();
    discCtx.ellipse(340, h * 0.65, 40, 15, -0.2, 0, Math.PI * 2);
    discCtx.fill();

    // Fairway
    discCtx.fillStyle = '#5CAF5C';
    discCtx.beginPath();
    const fCurve = hole.fairwayCurve * 80;
    discCtx.moveTo(hole.teeX - 10, h);
    discCtx.bezierCurveTo(
        hole.teeX + 40 + fCurve, h * 0.6,
        hole.basketX - 30 + fCurve, h * 0.4,
        hole.basketX, hole.basketY + 30
    );
    discCtx.bezierCurveTo(
        hole.basketX + 30 - fCurve, h * 0.4,
        hole.teeX + 80 - fCurve, h * 0.6,
        hole.teeX + 50, h
    );
    discCtx.fill();

    // Water hazard
    if (hole.water) {
        const wtr = hole.water;
        discCtx.fillStyle = '#4A90C4';
        discCtx.beginPath();
        discCtx.ellipse(wtr.x, wtr.y, wtr.w / 2, wtr.h / 2, 0, 0, Math.PI * 2);
        discCtx.fill();
        // Water shine
        discCtx.fillStyle = 'rgba(255,255,255,0.2)';
        discCtx.beginPath();
        discCtx.ellipse(wtr.x - wtr.w * 0.15, wtr.y - wtr.h * 0.15, wtr.w * 0.25, wtr.h * 0.2, -0.3, 0, Math.PI * 2);
        discCtx.fill();
    }

    // Trees (sorted by Y so further ones render first)
    const sortedTrees = [...hole.trees].sort((a, b) => a.y - b.y);
    sortedTrees.forEach(t => drawTree(discCtx, t.x, t.y, t.s));

    // Basket
    const bx = hole.basketX, by = hole.basketY;
    discCtx.strokeStyle = '#888';
    discCtx.lineWidth = 3;
    discCtx.beginPath();
    discCtx.moveTo(bx, by + 30);
    discCtx.lineTo(bx, by - 5);
    discCtx.stroke();
    discCtx.fillStyle = '#CCC';
    discCtx.beginPath();
    discCtx.ellipse(bx, by - 5, 12, 4, 0, 0, Math.PI * 2);
    discCtx.fill();
    discCtx.strokeStyle = '#AAA';
    discCtx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
        discCtx.beginPath();
        discCtx.moveTo(bx + i * 4, by - 5);
        discCtx.lineTo(bx + i * 5, by + 12);
        discCtx.stroke();
    }
    discCtx.strokeStyle = '#888';
    discCtx.lineWidth = 2;
    discCtx.beginPath();
    discCtx.ellipse(bx, by + 12, 14, 5, 0, 0, Math.PI * 2);
    discCtx.stroke();

    // Tee pad
    discCtx.fillStyle = '#777';
    discCtx.fillRect(hole.teeX - 10, hole.teeY, 30, 14);

    // Wind arrow on the course
    if (discState.windStrength > 0) {
        const wx = w / 2;
        const wy = 20;
        discCtx.fillStyle = 'rgba(255,255,255,0.6)';
        discCtx.font = '10px "Press Start 2P", monospace';
        discCtx.textAlign = 'center';
        const arrows = discState.wind > 0 ? '→'.repeat(discState.windStrength) : '←'.repeat(discState.windStrength);
        discCtx.fillText(arrows, wx, wy);
    }

    // Bean on tee pad
    if (discState.phase !== 'result') {
        discCtx.fillStyle = '#8B6B4A';
        discCtx.beginPath();
        discCtx.ellipse(hole.teeX + 5, hole.teeY - 10, 8, 12, 0, 0, Math.PI * 2);
        discCtx.fill();
        discCtx.strokeStyle = '#5C4530';
        discCtx.lineWidth = 1.5;
        discCtx.stroke();
        discCtx.fillStyle = '#3D2B1A';
        discCtx.beginPath();
        discCtx.arc(hole.teeX + 2, hole.teeY - 14, 1.5, 0, Math.PI * 2);
        discCtx.arc(hole.teeX + 8, hole.teeY - 14, 1.5, 0, Math.PI * 2);
        discCtx.fill();
    }

    // Hole name label
    discCtx.fillStyle = 'rgba(0,0,0,0.4)';
    discCtx.fillRect(0, h - 22, w, 22);
    discCtx.fillStyle = '#F5E6D0';
    discCtx.font = '8px "Press Start 2P", monospace';
    discCtx.textAlign = 'center';
    discCtx.fillText(`${hole.name} - Par ${hole.par}`, w / 2, h - 8);
}

function drawTree(c, x, y, size) {
    c.fillStyle = '#6B4226';
    c.fillRect(x - 3, y, 6, size * 0.6);
    c.fillStyle = '#2D7D2D';
    c.beginPath();
    c.arc(x, y - size * 0.1, size * 0.5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#3D9D3D';
    c.beginPath();
    c.arc(x - 4, y - size * 0.2, size * 0.35, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#4DAD4D';
    c.beginPath();
    c.arc(x + 3, y - size * 0.05, size * 0.3, 0, Math.PI * 2);
    c.fill();
}

function drawDiscFlying() {
    // Trail
    discState.trail.forEach((p, i) => {
        const alpha = i / discState.trail.length * 0.5;
        discCtx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        discCtx.beginPath();
        discCtx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        discCtx.fill();
    });

    // Shadow on ground
    discCtx.fillStyle = 'rgba(0,0,0,0.15)';
    discCtx.beginPath();
    discCtx.ellipse(discState.discX, discState.discY + 15, 6, 3, 0, 0, Math.PI * 2);
    discCtx.fill();

    // Disc (color varies by type)
    const discColors = { putter: '#5BA4E8', mid: '#F0C674', driver: '#FF6B6B' };
    const discStrokes = { putter: '#3D7AB8', mid: '#C4A043', driver: '#CC4444' };
    discCtx.fillStyle = discColors[discState.disc] || '#FF6B6B';
    discCtx.strokeStyle = discStrokes[discState.disc] || '#CC4444';
    discCtx.lineWidth = 2;
    discCtx.beginPath();
    discCtx.ellipse(discState.discX, discState.discY, 8, 4, 0.3, 0, Math.PI * 2);
    discCtx.fill();
    discCtx.stroke();
}

// ---- FLAPPY BEAN ----
const flapCanvas = $('flappy-canvas');
let flapCtx = flapCanvas.getContext('2d');
let FW = flapCanvas.width;
let FH = flapCanvas.height;

const FLAP = {
    gravity: 0.45,
    jumpForce: -7.5,
    pipeWidth: 52,
    gapRatio: 0.23,           // pipe gap as fraction of canvas height
    pipeSpeed: 2.5,
    pipeSpawnInterval: 90,    // frames between pipes
    groundRatio: 0.1,         // ground height as fraction of canvas height
    beanSize: 18,
    coinSize: 14,
    coinChance: 0.4,          // 40% chance a pipe gap has a coin
};

function flapGround() { return Math.floor(FH * FLAP.groundRatio); }
function flapGap() { return Math.floor(FH * FLAP.gapRatio); }

let flappy = {
    phase: 'idle',  // idle, playing, dead
    beanY: 0,
    beanVY: 0,
    beanRotation: 0,
    pipes: [],
    coins: [],
    frameCount: 0,
    score: 0,
    bestScore: 0,
    coinsCollected: 0,
    groundX: 0,
    flapAnim: 0,
    deathY: 0,
};

let flappyRAF = null;

function resizeFlappyCanvas() {
    // Size canvas to fit available space on any screen
    const screen = $('flappy-screen');
    const navH = $('nav-bar').offsetHeight || 40;
    const titleH = $('title-bar').offsetHeight || 40;
    const availH = window.innerHeight - navH - titleH;
    const availW = Math.min(400, screen.offsetWidth || 400);
    // Maintain 2:3 aspect ratio, but fit within available space
    let cw = availW;
    let ch = Math.floor(cw * 1.4);
    if (ch > availH) {
        ch = availH;
        cw = Math.floor(ch / 1.4);
    }
    flapCanvas.width = cw;
    flapCanvas.height = ch;
    FW = cw;
    FH = ch;
    // Recreate pixel buffer for new size
    initPixelBuffer('flappy', flapCanvas);
}

function startFlappy() {
    stopFlappy(); // clean up any existing loop
    resizeFlappyCanvas();

    // Load best score
    const saved = localStorage.getItem('flappyBest');
    if (saved) flappy.bestScore = parseInt(saved) || 0;

    resetFlappy();
    flappyLoop();
}

function stopFlappy() {
    if (flappyRAF) {
        cancelAnimationFrame(flappyRAF);
        flappyRAF = null;
    }
}

function resetFlappy() {
    flappy.phase = 'idle';
    flappy.beanY = FH * 0.4;
    flappy.beanVY = 0;
    flappy.beanRotation = 0;
    flappy.pipes = [];
    flappy.coins = [];
    flappy.frameCount = 0;
    flappy.score = 0;
    flappy.coinsCollected = 0;
    flappy.groundX = 0;
}

function flapJump() {
    if (flappy.phase === 'idle') {
        flappy.phase = 'playing';
        flappy.beanVY = FLAP.jumpForce;
        flappy.flapAnim = 8;
    } else if (flappy.phase === 'playing') {
        flappy.beanVY = FLAP.jumpForce;
        flappy.flapAnim = 8;
    } else if (flappy.phase === 'dead') {
        // Restart after short delay
        if (flappy.frameCount > 30) {
            resetFlappy();
        }
    }
}

function flappyLoop() {
    try {
        flappyUpdate();
        flappyDraw();
    } catch (e) {
        console.error('Flappy error:', e);
    }
    flappyRAF = requestAnimationFrame(flappyLoop);
}

function flappyUpdate() {
    if (flappy.phase === 'idle') {
        // Bean hovers gently
        flappy.beanY = FH * 0.4 + Math.sin(flappy.frameCount * 0.05) * 12;
        flappy.frameCount++;
        flappy.groundX = (flappy.groundX + 1) % 24;
        return;
    }

    if (flappy.phase === 'dead') {
        flappy.frameCount++;
        // Bean falls to ground
        if (flappy.beanY < FH - flapGround() - FLAP.beanSize) {
            flappy.beanVY += FLAP.gravity;
            flappy.beanY += flappy.beanVY;
            flappy.beanRotation = Math.min(Math.PI / 2, flappy.beanRotation + 0.08);
        }
        return;
    }

    // Playing
    flappy.frameCount++;
    flappy.flapAnim = Math.max(0, flappy.flapAnim - 1);

    // Gravity
    flappy.beanVY += FLAP.gravity;
    flappy.beanY += flappy.beanVY;

    // Rotation based on velocity
    if (flappy.beanVY < 0) {
        flappy.beanRotation = Math.max(-0.5, flappy.beanRotation - 0.08);
    } else {
        flappy.beanRotation = Math.min(Math.PI / 4, flappy.beanRotation + 0.03);
    }

    // Ceiling
    if (flappy.beanY < FLAP.beanSize) {
        flappy.beanY = FLAP.beanSize;
        flappy.beanVY = 0;
    }

    // Ground collision
    if (flappy.beanY > FH - flapGround() - FLAP.beanSize) {
        flappyDie();
        return;
    }

    // Scroll ground
    flappy.groundX = (flappy.groundX + FLAP.pipeSpeed) % 24;

    // Spawn pipes
    if (flappy.frameCount % FLAP.pipeSpawnInterval === 0) {
        const margin = Math.floor(FH * 0.12);
        const minY = margin;
        const maxY = FH - flapGround() - flapGap() - margin;
        const gapY = minY + Math.random() * (maxY - minY);
        flappy.pipes.push({
            x: FW + 10,
            gapY: gapY,
            scored: false,
        });
        // Maybe spawn a coin in the gap
        if (Math.random() < FLAP.coinChance) {
            flappy.coins.push({
                x: FW + 10 + FLAP.pipeWidth / 2,
                y: gapY + flapGap() / 2,
                collected: false,
            });
        }
    }

    // Move pipes
    flappy.pipes.forEach(p => {
        p.x -= FLAP.pipeSpeed;
        // Score when passing
        if (!p.scored && p.x + FLAP.pipeWidth < 70) {
            p.scored = true;
            flappy.score++;
        }
    });

    // Move coins
    flappy.coins.forEach(c => {
        c.x -= FLAP.pipeSpeed;
    });

    // Remove off-screen pipes/coins
    flappy.pipes = flappy.pipes.filter(p => p.x > -FLAP.pipeWidth - 10);
    flappy.coins = flappy.coins.filter(c => c.x > -20 && !c.collected);

    // Collision detection
    const bx = 70;
    const by = flappy.beanY;
    const br = FLAP.beanSize - 3; // slightly forgiving hitbox

    // Pipe collision
    for (const p of flappy.pipes) {
        if (bx + br > p.x && bx - br < p.x + FLAP.pipeWidth) {
            // Inside pipe column - check if in gap
            if (by - br < p.gapY || by + br > p.gapY + flapGap()) {
                flappyDie();
                return;
            }
        }
    }

    // Coin collection
    for (const c of flappy.coins) {
        if (!c.collected) {
            const dx = bx - c.x;
            const dy = by - c.y;
            if (Math.sqrt(dx * dx + dy * dy) < FLAP.beanSize + FLAP.coinSize / 2) {
                c.collected = true;
                flappy.coinsCollected++;
            }
        }
    }
}

function flappyDie() {
    flappy.phase = 'dead';
    flappy.frameCount = 0;
    flappy.beanVY = -4; // little bounce up on death

    // Update best score
    if (flappy.score > flappy.bestScore) {
        flappy.bestScore = flappy.score;
        localStorage.setItem('flappyBest', flappy.bestScore);
    }

    // Award coins and fun to the main game
    state.coins += flappy.coinsCollected;
    const funBoost = Math.min(30, flappy.score * 2);
    state.fun = Math.min(100, state.fun + funBoost);
    if (funBoost > 0 || flappy.coinsCollected > 0) saveGame();
}

function flappyDraw() {
    flapCtx = pixelBegin('flappy');
    // Sky
    const skyGrad = flapCtx.createLinearGradient(0, 0, 0, FH - flapGround());
    skyGrad.addColorStop(0, '#6BC4E8');
    skyGrad.addColorStop(1, '#A8E0A0');
    flapCtx.fillStyle = skyGrad;
    flapCtx.fillRect(0, 0, FW, FH - flapGround());

    // Clouds (parallax-ish)
    flapCtx.fillStyle = 'rgba(255,255,255,0.6)';
    const cloudOffset = flappy.phase === 'idle' ? flappy.frameCount * 0.3 : flappy.frameCount * FLAP.pipeSpeed * 0.3;
    for (let i = 0; i < 5; i++) {
        const cx = ((i * 110 + 30) - cloudOffset * 0.3) % (FW + 80) - 40;
        const cy = 40 + i * 25 + Math.sin(i * 2.5) * 20;
        flapCtx.beginPath();
        flapCtx.ellipse(cx, cy, 30 + i * 5, 10 + i * 2, 0, 0, Math.PI * 2);
        flapCtx.fill();
    }

    // Distant trees (background)
    flapCtx.fillStyle = '#5C9F5C';
    for (let i = 0; i < 12; i++) {
        const tx = ((i * 45) - cloudOffset * 0.5) % (FW + 50) - 25;
        const ty = FH - flapGround() - 10;
        flapCtx.beginPath();
        flapCtx.arc(tx, ty, 20 + (i % 3) * 5, 0, Math.PI * 2);
        flapCtx.fill();
    }

    // Pipes (tree trunks with foliage)
    flappy.pipes.forEach(p => {
        drawFlappyPipe(p);
    });

    // Coins
    flappy.coins.forEach(c => {
        if (c.collected) return;
        const bobble = Math.sin(flappy.frameCount * 0.1 + c.x * 0.05) * 3;
        // Coin glow
        flapCtx.fillStyle = 'rgba(240, 198, 116, 0.3)';
        flapCtx.beginPath();
        flapCtx.arc(c.x, c.y + bobble, FLAP.coinSize, 0, Math.PI * 2);
        flapCtx.fill();
        // Coin body
        flapCtx.fillStyle = '#F0C674';
        flapCtx.beginPath();
        flapCtx.arc(c.x, c.y + bobble, FLAP.coinSize * 0.65, 0, Math.PI * 2);
        flapCtx.fill();
        flapCtx.strokeStyle = '#C4A043';
        flapCtx.lineWidth = 2;
        flapCtx.stroke();
        // Star on coin
        flapCtx.fillStyle = '#C4A043';
        flapCtx.font = '10px sans-serif';
        flapCtx.textAlign = 'center';
        flapCtx.textBaseline = 'middle';
        flapCtx.fillText('★', c.x, c.y + bobble + 1);
    });

    // Ground
    flapCtx.fillStyle = '#8B6538';
    flapCtx.fillRect(0, FH - flapGround(), FW, flapGround());
    // Ground top (grass)
    flapCtx.fillStyle = '#4A8F4A';
    flapCtx.fillRect(0, FH - flapGround(), FW, 12);
    // Ground stripes (scrolling)
    flapCtx.fillStyle = '#7A5830';
    for (let i = -1; i < FW / 24 + 2; i++) {
        const gx = i * 24 - (flappy.groundX % 24);
        flapCtx.fillRect(gx, FH - flapGround() + 14, 12, flapGround() - 14);
    }

    // Bean
    drawFlappyBean();

    // Score display
    flapCtx.fillStyle = 'white';
    flapCtx.strokeStyle = '#3D2B1A';
    flapCtx.lineWidth = 4;
    flapCtx.font = '32px "Press Start 2P", monospace';
    flapCtx.textAlign = 'center';
    flapCtx.textBaseline = 'top';
    flapCtx.strokeText(flappy.score, FW / 2, 30);
    flapCtx.fillText(flappy.score, FW / 2, 30);

    // Coin counter
    flapCtx.font = '12px "Press Start 2P", monospace';
    flapCtx.fillStyle = '#F0C674';
    flapCtx.strokeStyle = '#3D2B1A';
    flapCtx.lineWidth = 3;
    flapCtx.textAlign = 'left';
    flapCtx.strokeText('★ ' + flappy.coinsCollected, 12, 12);
    flapCtx.fillText('★ ' + flappy.coinsCollected, 12, 12);

    // Idle screen
    if (flappy.phase === 'idle') {
        // Title
        flapCtx.fillStyle = '#F0C674';
        flapCtx.strokeStyle = '#5C4530';
        flapCtx.lineWidth = 4;
        flapCtx.font = '20px "Press Start 2P", monospace';
        flapCtx.textAlign = 'center';
        flapCtx.strokeText('FLAPPY BEAN', FW / 2, FH * 0.2);
        flapCtx.fillText('FLAPPY BEAN', FW / 2, FH * 0.2);

        // Tap prompt
        const blink = Math.sin(flappy.frameCount * 0.06) > 0;
        if (blink) {
            flapCtx.fillStyle = '#F5E6D0';
            flapCtx.font = '10px "Press Start 2P", monospace';
            flapCtx.fillText('TAP TO START', FW / 2, FH * 0.6);
        }

        // Best score
        if (flappy.bestScore > 0) {
            flapCtx.fillStyle = '#F5E6D0';
            flapCtx.font = '9px "Press Start 2P", monospace';
            flapCtx.fillText('Best: ' + flappy.bestScore, FW / 2, FH * 0.67);
        }
    }

    // Death screen
    if (flappy.phase === 'dead' && flappy.frameCount > 20) {
        // Overlay
        flapCtx.fillStyle = 'rgba(0,0,0,0.4)';
        flapCtx.fillRect(0, 0, FW, FH);

        // Score card
        const cardX = FW / 2 - 110;
        const cardY = FH * 0.25;
        const cardW = 220;
        const cardH = 180;

        // Card background
        flapCtx.fillStyle = '#3D3A4E';
        flapCtx.fillRect(cardX, cardY, cardW, cardH);
        flapCtx.strokeStyle = '#F0C674';
        flapCtx.lineWidth = 4;
        flapCtx.strokeRect(cardX, cardY, cardW, cardH);

        // Game over
        flapCtx.fillStyle = '#F0C674';
        flapCtx.font = '14px "Press Start 2P", monospace';
        flapCtx.textAlign = 'center';
        flapCtx.fillText('GAME OVER', FW / 2, cardY + 30);

        // Score
        flapCtx.fillStyle = '#F5E6D0';
        flapCtx.font = '10px "Press Start 2P", monospace';
        flapCtx.fillText('Score: ' + flappy.score, FW / 2, cardY + 60);

        // Best
        flapCtx.fillStyle = '#B8B0CC';
        flapCtx.fillText('Best: ' + flappy.bestScore, FW / 2, cardY + 82);

        // Coins earned
        flapCtx.fillStyle = '#F0C674';
        flapCtx.fillText('★ ' + flappy.coinsCollected + ' coins earned', FW / 2, cardY + 108);

        // Fun earned
        const funEarned = Math.min(30, flappy.score * 2);
        flapCtx.fillStyle = '#6FCF97';
        flapCtx.fillText('+' + funEarned + ' fun', FW / 2, cardY + 128);

        // New best indicator
        if (flappy.score === flappy.bestScore && flappy.score > 0) {
            flapCtx.fillStyle = '#FF6B6B';
            flapCtx.font = '8px "Press Start 2P", monospace';
            flapCtx.fillText('NEW BEST!', FW / 2, cardY + 150);
        }

        // Tap to retry
        const blink = Math.sin(flappy.frameCount * 0.08) > 0;
        if (blink) {
            flapCtx.fillStyle = '#B8B0CC';
            flapCtx.font = '8px "Press Start 2P", monospace';
            flapCtx.fillText('TAP TO RETRY', FW / 2, cardY + 168);
        }
    }

    pixelEnd('flappy');
}

function drawFlappyPipe(pipe) {
    const x = pipe.x;
    const gapTop = pipe.gapY;
    const gapBottom = pipe.gapY + flapGap();
    const pw = FLAP.pipeWidth;

    // Top pipe (tree trunk hanging down)
    // Trunk
    flapCtx.fillStyle = '#6B4226';
    flapCtx.fillRect(x, 0, pw, gapTop);
    // Bark texture
    flapCtx.fillStyle = '#5C3820';
    flapCtx.fillRect(x + 4, 0, 6, gapTop);
    flapCtx.fillRect(x + pw - 12, 0, 6, gapTop);
    // Lip at bottom of top pipe
    flapCtx.fillStyle = '#4A8F4A';
    flapCtx.fillRect(x - 6, gapTop - 20, pw + 12, 20);
    // Foliage on lip
    flapCtx.fillStyle = '#3D7D3D';
    for (let i = 0; i < 4; i++) {
        flapCtx.beginPath();
        flapCtx.arc(x + 5 + i * 15, gapTop - 14, 10, 0, Math.PI * 2);
        flapCtx.fill();
    }
    flapCtx.fillStyle = '#5CAF5C';
    for (let i = 0; i < 3; i++) {
        flapCtx.beginPath();
        flapCtx.arc(x + 12 + i * 15, gapTop - 18, 8, 0, Math.PI * 2);
        flapCtx.fill();
    }

    // Bottom pipe (tree trunk going up)
    flapCtx.fillStyle = '#6B4226';
    flapCtx.fillRect(x, gapBottom, pw, FH - flapGround() - gapBottom);
    // Bark texture
    flapCtx.fillStyle = '#5C3820';
    flapCtx.fillRect(x + 4, gapBottom, 6, FH - flapGround() - gapBottom);
    flapCtx.fillRect(x + pw - 12, gapBottom, 6, FH - flapGround() - gapBottom);
    // Lip at top of bottom pipe
    flapCtx.fillStyle = '#4A8F4A';
    flapCtx.fillRect(x - 6, gapBottom, pw + 12, 20);
    // Foliage on lip
    flapCtx.fillStyle = '#3D7D3D';
    for (let i = 0; i < 4; i++) {
        flapCtx.beginPath();
        flapCtx.arc(x + 5 + i * 15, gapBottom + 14, 10, 0, Math.PI * 2);
        flapCtx.fill();
    }
    flapCtx.fillStyle = '#5CAF5C';
    for (let i = 0; i < 3; i++) {
        flapCtx.beginPath();
        flapCtx.arc(x + 12 + i * 15, gapBottom + 18, 8, 0, Math.PI * 2);
        flapCtx.fill();
    }

    // Outline
    flapCtx.strokeStyle = '#3D2815';
    flapCtx.lineWidth = 2;
    flapCtx.strokeRect(x, 0, pw, gapTop);
    flapCtx.strokeRect(x, gapBottom, pw, FH - flapGround() - gapBottom);
}

function drawFlappyBean() {
    const bx = 70;
    const by = flappy.beanY;

    flapCtx.save();
    flapCtx.translate(bx, by);
    flapCtx.rotate(flappy.beanRotation);

    // Shadow (subtle)
    flapCtx.fillStyle = 'rgba(0,0,0,0.1)';
    flapCtx.beginPath();
    flapCtx.ellipse(2, 2, FLAP.beanSize, FLAP.beanSize * 0.8, 0, 0, Math.PI * 2);
    flapCtx.fill();

    // Body
    const avgStat = (state.hunger + state.thirst + state.social + state.fun) / 4;
    let bodyColor = avgStat > 50 ? '#8B6B4A' : '#A0825E';
    if (flappy.phase === 'dead') bodyColor = '#B89878';

    flapCtx.fillStyle = bodyColor;
    flapCtx.beginPath();
    flapCtx.ellipse(0, 0, FLAP.beanSize, FLAP.beanSize * 0.85, 0, 0, Math.PI * 2);
    flapCtx.fill();

    // Highlight
    flapCtx.fillStyle = 'rgba(255,255,255,0.15)';
    flapCtx.beginPath();
    flapCtx.ellipse(-4, -5, FLAP.beanSize * 0.4, FLAP.beanSize * 0.55, -0.3, 0, Math.PI * 2);
    flapCtx.fill();

    // Outline
    flapCtx.strokeStyle = '#5C4530';
    flapCtx.lineWidth = 2;
    flapCtx.beginPath();
    flapCtx.ellipse(0, 0, FLAP.beanSize, FLAP.beanSize * 0.85, 0, 0, Math.PI * 2);
    flapCtx.stroke();

    // Wing
    const wingFlap = flappy.flapAnim > 0 ? -0.6 : 0.2;
    flapCtx.fillStyle = bodyColor;
    flapCtx.strokeStyle = '#5C4530';
    flapCtx.lineWidth = 1.5;
    flapCtx.save();
    flapCtx.translate(-6, 4);
    flapCtx.rotate(wingFlap);
    flapCtx.beginPath();
    flapCtx.ellipse(0, 0, 12, 6, -0.4, 0, Math.PI * 2);
    flapCtx.fill();
    flapCtx.stroke();
    flapCtx.restore();

    if (flappy.phase === 'dead') {
        // X eyes
        flapCtx.strokeStyle = '#3D2B1A';
        flapCtx.lineWidth = 2;
        flapCtx.beginPath();
        flapCtx.moveTo(-7, -7); flapCtx.lineTo(-2, -2);
        flapCtx.moveTo(-2, -7); flapCtx.lineTo(-7, -2);
        flapCtx.moveTo(3, -7); flapCtx.lineTo(8, -2);
        flapCtx.moveTo(8, -7); flapCtx.lineTo(3, -2);
        flapCtx.stroke();
    } else {
        // Eyes
        flapCtx.fillStyle = 'white';
        flapCtx.beginPath();
        flapCtx.ellipse(-5, -4, 5, 5.5, 0, 0, Math.PI * 2);
        flapCtx.ellipse(5, -4, 5, 5.5, 0, 0, Math.PI * 2);
        flapCtx.fill();
        // Pupils (look forward/up when flapping)
        const pupilOff = flappy.beanVY < -2 ? -1.5 : 1;
        flapCtx.fillStyle = '#3D2B1A';
        flapCtx.beginPath();
        flapCtx.arc(-4 + 1.5, -4 + pupilOff, 2.5, 0, Math.PI * 2);
        flapCtx.arc(6 + 1.5, -4 + pupilOff, 2.5, 0, Math.PI * 2);
        flapCtx.fill();
    }

    // Beak
    flapCtx.fillStyle = '#E8A43B';
    flapCtx.beginPath();
    flapCtx.moveTo(FLAP.beanSize - 4, -2);
    flapCtx.lineTo(FLAP.beanSize + 8, 1);
    flapCtx.lineTo(FLAP.beanSize - 4, 4);
    flapCtx.closePath();
    flapCtx.fill();
    flapCtx.strokeStyle = '#C4882A';
    flapCtx.lineWidth = 1;
    flapCtx.stroke();

    flapCtx.restore();
}

// Flappy input handlers
function onFlappyInput(e) {
    if (currentScreen !== 'flappy') return;
    e.preventDefault();
    flapJump();
}

// ---- BEAN BEATS (Rhythm Game) ----
const beatsCanvas = $('beats-canvas');
let beatsCtx = beatsCanvas.getContext('2d');
let BW = beatsCanvas.width;
let BH = beatsCanvas.height;

const LANE_COLORS = ['#E85B7A', '#5BE8B8', '#E8C85B', '#5B8BE8'];
const LANE_KEYS = ['d', 'f', 'j', 'k'];
const LANE_LABELS = ['D', 'F', 'J', 'K'];
const NUM_LANES = 4;
const HIT_ZONE_Y_RATIO = 0.85; // where the hit zone sits
const NOTE_SPEED = 3.5;
const HIT_WINDOW_PERFECT = 18;
const HIT_WINDOW_GOOD = 40;
const HIT_WINDOW_OK = 65;

// Song patterns: each song is a name + BPM + array of [beat, lane] pairs
// beat = which beat number the note falls on (can be fractional)
const SONGS = [
    {
        name: 'Chill Vibes',
        bpm: 100,
        difficulty: 'Easy',
        notes: (() => {
            const n = [];
            for (let b = 0; b < 32; b++) {
                n.push([b, b % NUM_LANES]);
            }
            return n;
        })(),
    },
    {
        name: 'Disc Golf Funk',
        bpm: 120,
        difficulty: 'Medium',
        notes: (() => {
            const n = [];
            for (let b = 0; b < 40; b += 0.5) {
                if (Math.sin(b * 1.3) > -0.2) {
                    n.push([b, Math.floor((Math.sin(b * 0.7) * 0.5 + 0.5) * NUM_LANES) % NUM_LANES]);
                }
            }
            return n;
        })(),
    },
    {
        name: 'Bar Fight',
        bpm: 140,
        difficulty: 'Hard',
        notes: (() => {
            const n = [];
            for (let b = 0; b < 48; b += 0.5) {
                const lane = Math.floor(Math.abs(Math.sin(b * 0.9) * Math.cos(b * 0.4)) * NUM_LANES) % NUM_LANES;
                n.push([b, lane]);
                // Add doubles on every 4th beat
                if (b % 4 === 0) {
                    n.push([b, (lane + 2) % NUM_LANES]);
                }
            }
            return n;
        })(),
    },
    {
        name: 'Bean Bop',
        bpm: 110,
        difficulty: 'Easy',
        notes: (() => {
            const n = [];
            // Simple alternating pattern
            for (let b = 0; b < 32; b++) {
                n.push([b, b % 2 === 0 ? 0 : 3]);
                if (b % 4 === 2) n.push([b, 1]);
                if (b % 4 === 3) n.push([b, 2]);
            }
            return n;
        })(),
    },
    {
        name: 'Ace Run',
        bpm: 150,
        difficulty: 'Hard',
        notes: (() => {
            const n = [];
            for (let b = 0; b < 56; b += 0.25) {
                if (Math.random() < 0.35) {
                    n.push([b, Math.floor(Math.random() * NUM_LANES)]);
                }
            }
            // Sort by beat time
            n.sort((a, b) => a[0] - b[0]);
            return n;
        })(),
    },
    {
        name: 'Sunset Session',
        bpm: 95,
        difficulty: 'Medium',
        notes: (() => {
            const n = [];
            for (let b = 0; b < 36; b++) {
                // Cascading pattern
                const base = b % 8;
                if (base < 4) n.push([b, base]);
                else n.push([b, 7 - base]);
                // Add half-beat notes occasionally
                if (b % 3 === 0) n.push([b + 0.5, (base + 2) % NUM_LANES]);
            }
            return n;
        })(),
    },
];

let beats = {
    phase: 'menu',  // menu, playing, results
    song: null,
    songIndex: 0,
    notes: [],      // active notes: { lane, y, hit, missed }
    startTime: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfects: 0,
    goods: 0,
    oks: 0,
    misses: 0,
    laneFlash: [0, 0, 0, 0],  // flash timers per lane
    lanePress: [false, false, false, false],
    hitEffects: [],  // { x, y, text, timer, color }
    totalNotes: 0,
    coinsEarned: 0,
    menuScroll: 0,
};

let beatsRAF = null;

function resizeBeatsCanvas() {
    const screen = $('beats-screen');
    const navH = $('nav-bar').offsetHeight || 40;
    const titleH = $('title-bar').offsetHeight || 40;
    const availH = window.innerHeight - navH - titleH;
    const availW = Math.min(400, screen.offsetWidth || 400);
    let cw = availW;
    let ch = Math.min(Math.floor(cw * 1.3), availH);
    beatsCanvas.width = cw;
    beatsCanvas.height = ch;
    BW = cw;
    BH = ch;
    initPixelBuffer('beats', beatsCanvas);
}

function startBeats() {
    stopBeats();
    resizeBeatsCanvas();
    beats.phase = 'menu';
    beatsLoop();
}

function stopBeats() {
    if (beatsRAF) {
        cancelAnimationFrame(beatsRAF);
        beatsRAF = null;
    }
}

function beatsLoop() {
    try {
        beatsDraw();
    } catch (e) {
        console.error('Beats error:', e);
    }
    beatsRAF = requestAnimationFrame(beatsLoop);
}

function startSong(index) {
    const song = SONGS[index];
    beats.phase = 'playing';
    beats.song = song;
    beats.songIndex = index;
    beats.score = 0;
    beats.combo = 0;
    beats.maxCombo = 0;
    beats.perfects = 0;
    beats.goods = 0;
    beats.oks = 0;
    beats.misses = 0;
    beats.laneFlash = [0, 0, 0, 0];
    beats.lanePress = [false, false, false, false];
    beats.hitEffects = [];
    beats.coinsEarned = 0;

    // Convert song notes to game notes with Y positions based on timing
    const hitY = BH * HIT_ZONE_Y_RATIO;
    const secPerBeat = 60 / song.bpm;
    beats.notes = song.notes.map(([beat, lane]) => ({
        lane,
        time: beat * secPerBeat,
        hit: false,
        missed: false,
    }));
    beats.totalNotes = beats.notes.length;
    beats.startTime = performance.now() / 1000 + 2; // 2 sec lead-in
}

function beatsHitLane(lane) {
    if (beats.phase !== 'playing') return;

    beats.lanePress[lane] = true;
    setTimeout(() => { beats.lanePress[lane] = false; }, 80);

    const now = performance.now() / 1000;
    const elapsed = now - beats.startTime;
    const hitY = BH * HIT_ZONE_Y_RATIO;

    // Find closest unhit note in this lane
    let closest = null;
    let closestDist = Infinity;
    for (const note of beats.notes) {
        if (note.lane !== lane || note.hit || note.missed) continue;
        const noteY = hitY - (note.time - elapsed) * NOTE_SPEED * 60;
        const dist = Math.abs(noteY - hitY);
        if (dist < closestDist) {
            closestDist = dist;
            closest = note;
        }
    }

    if (!closest) return;

    const laneW = BW / NUM_LANES;
    const cx = lane * laneW + laneW / 2;

    if (closestDist < HIT_WINDOW_PERFECT) {
        closest.hit = true;
        beats.perfects++;
        beats.score += 100 * (1 + Math.floor(beats.combo / 10) * 0.5);
        beats.combo++;
        beats.laneFlash[lane] = 12;
        beats.hitEffects.push({ x: cx, y: hitY, text: 'PERFECT', timer: 30, color: '#F0C674' });
    } else if (closestDist < HIT_WINDOW_GOOD) {
        closest.hit = true;
        beats.goods++;
        beats.score += 60 * (1 + Math.floor(beats.combo / 10) * 0.5);
        beats.combo++;
        beats.laneFlash[lane] = 8;
        beats.hitEffects.push({ x: cx, y: hitY, text: 'GOOD', timer: 25, color: '#6FCF97' });
    } else if (closestDist < HIT_WINDOW_OK) {
        closest.hit = true;
        beats.oks++;
        beats.score += 30;
        beats.combo++;
        beats.laneFlash[lane] = 5;
        beats.hitEffects.push({ x: cx, y: hitY, text: 'OK', timer: 20, color: '#5BA4E8' });
    } else {
        // Too far - miss
        beats.combo = 0;
    }

    beats.maxCombo = Math.max(beats.maxCombo, beats.combo);
}

function beatsDraw() {
    beatsCtx = pixelBegin('beats');
    const now = performance.now() / 1000;

    if (beats.phase === 'menu') {
        drawBeatsMenu();
        pixelEnd('beats');
        return;
    }

    if (beats.phase === 'results') {
        drawBeatsResults();
        pixelEnd('beats');
        return;
    }

    // Playing
    const elapsed = now - beats.startTime;
    const hitY = BH * HIT_ZONE_Y_RATIO;
    const laneW = BW / NUM_LANES;

    // Background
    beatsCtx.fillStyle = '#0D0C14';
    beatsCtx.fillRect(0, 0, BW, BH);

    // Lane backgrounds
    for (let i = 0; i < NUM_LANES; i++) {
        const x = i * laneW;
        beatsCtx.fillStyle = i % 2 === 0 ? '#151320' : '#1A1828';
        beatsCtx.fillRect(x, 0, laneW, BH);

        // Lane dividers
        beatsCtx.fillStyle = '#2A2840';
        beatsCtx.fillRect(x, 0, 2, BH);

        // Flash effect
        if (beats.laneFlash[i] > 0) {
            const alpha = beats.laneFlash[i] / 12;
            beatsCtx.fillStyle = `rgba(${hexToRgb(LANE_COLORS[i])}, ${alpha * 0.3})`;
            beatsCtx.fillRect(x, 0, laneW, BH);
            beats.laneFlash[i]--;
        }

        // Press effect
        if (beats.lanePress[i]) {
            beatsCtx.fillStyle = `rgba(${hexToRgb(LANE_COLORS[i])}, 0.15)`;
            beatsCtx.fillRect(x, hitY - 30, laneW, 60);
        }
    }

    // Hit zone line
    beatsCtx.fillStyle = '#444460';
    beatsCtx.fillRect(0, hitY - 2, BW, 4);

    // Hit zone targets
    for (let i = 0; i < NUM_LANES; i++) {
        const cx = i * laneW + laneW / 2;
        beatsCtx.strokeStyle = LANE_COLORS[i];
        beatsCtx.lineWidth = 3;
        beatsCtx.beginPath();
        beatsCtx.arc(cx, hitY, laneW * 0.3, 0, Math.PI * 2);
        beatsCtx.stroke();

        // Inner glow if pressed
        if (beats.lanePress[i]) {
            beatsCtx.fillStyle = LANE_COLORS[i];
            beatsCtx.beginPath();
            beatsCtx.arc(cx, hitY, laneW * 0.25, 0, Math.PI * 2);
            beatsCtx.fill();
        }
    }

    // Draw notes
    let allDone = true;
    for (const note of beats.notes) {
        if (note.hit) continue;

        const noteY = hitY - (note.time - elapsed) * NOTE_SPEED * 60;

        // Check for miss (note passed the hit zone)
        if (noteY > hitY + HIT_WINDOW_OK && !note.missed) {
            note.missed = true;
            beats.misses++;
            beats.combo = 0;
            const cx = note.lane * laneW + laneW / 2;
            beats.hitEffects.push({ x: cx, y: hitY, text: 'MISS', timer: 20, color: '#CC3333' });
        }

        if (note.missed && noteY > BH + 20) continue;
        if (noteY < -20) { allDone = false; continue; }
        allDone = false;

        // Draw note
        const cx = note.lane * laneW + laneW / 2;
        const color = note.missed ? '#555' : LANE_COLORS[note.lane];
        const noteR = laneW * 0.28;

        beatsCtx.fillStyle = color;
        beatsCtx.beginPath();
        beatsCtx.arc(cx, noteY, noteR, 0, Math.PI * 2);
        beatsCtx.fill();

        // Note shine
        if (!note.missed) {
            beatsCtx.fillStyle = 'rgba(255,255,255,0.25)';
            beatsCtx.beginPath();
            beatsCtx.arc(cx - noteR * 0.2, noteY - noteR * 0.25, noteR * 0.4, 0, Math.PI * 2);
            beatsCtx.fill();
        }
    }

    // Hit effects (floating text)
    beats.hitEffects = beats.hitEffects.filter(e => e.timer > 0);
    beats.hitEffects.forEach(e => {
        const alpha = e.timer / 30;
        beatsCtx.fillStyle = e.color;
        beatsCtx.globalAlpha = alpha;
        beatsCtx.font = '10px "Press Start 2P", monospace';
        beatsCtx.textAlign = 'center';
        beatsCtx.fillText(e.text, e.x, e.y - (30 - e.timer) * 1.5);
        beatsCtx.globalAlpha = 1;
        e.timer--;
    });

    // Bottom bar (dark)
    beatsCtx.fillStyle = '#0D0C14';
    beatsCtx.fillRect(0, hitY + laneW * 0.4, BW, BH - hitY);

    // Lane labels at bottom
    beatsCtx.font = '9px "Press Start 2P", monospace';
    beatsCtx.textAlign = 'center';
    for (let i = 0; i < NUM_LANES; i++) {
        const cx = i * laneW + laneW / 2;
        beatsCtx.fillStyle = beats.lanePress[i] ? LANE_COLORS[i] : '#555270';
        beatsCtx.fillText(LANE_LABELS[i], cx, BH - 8);
    }

    // Score & combo HUD
    beatsCtx.fillStyle = '#F5E6D0';
    beatsCtx.font = '10px "Press Start 2P", monospace';
    beatsCtx.textAlign = 'left';
    beatsCtx.fillText(Math.floor(beats.score) + '', 8, 20);

    if (beats.combo > 2) {
        beatsCtx.fillStyle = '#F0C674';
        beatsCtx.textAlign = 'right';
        beatsCtx.font = '12px "Press Start 2P", monospace';
        beatsCtx.fillText(beats.combo + 'x', BW - 8, 20);
    }

    // Song name
    beatsCtx.fillStyle = '#555270';
    beatsCtx.font = '7px "Press Start 2P", monospace';
    beatsCtx.textAlign = 'center';
    beatsCtx.fillText(beats.song.name, BW / 2, 14);

    // Check if song is done
    if (allDone && elapsed > 2) {
        showBeatsResults();
    }

    pixelEnd('beats');
}

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
}

function drawBeatsMenu() {
    // Background
    beatsCtx.fillStyle = '#0D0C14';
    beatsCtx.fillRect(0, 0, BW, BH);

    // Title
    beatsCtx.fillStyle = '#F0C674';
    beatsCtx.font = '16px "Press Start 2P", monospace';
    beatsCtx.textAlign = 'center';
    beatsCtx.fillText('BEAN BEATS', BW / 2, 40);

    beatsCtx.fillStyle = '#B8B0CC';
    beatsCtx.font = '7px "Press Start 2P", monospace';
    beatsCtx.fillText('Pick a song!', BW / 2, 60);

    // Song list
    const itemH = 60;
    const startY = 80;
    SONGS.forEach((song, i) => {
        const y = startY + i * itemH;
        if (y > BH - 20) return;

        const hover = false;
        beatsCtx.fillStyle = '#1A1828';
        beatsCtx.fillRect(20, y, BW - 40, itemH - 8);
        beatsCtx.strokeStyle = '#3D3A4E';
        beatsCtx.lineWidth = 2;
        beatsCtx.strokeRect(20, y, BW - 40, itemH - 8);

        // Song name
        beatsCtx.fillStyle = '#F5E6D0';
        beatsCtx.font = '9px "Press Start 2P", monospace';
        beatsCtx.textAlign = 'left';
        beatsCtx.fillText(song.name, 32, y + 20);

        // Difficulty
        const diffColors = { Easy: '#6FCF97', Medium: '#E8C85B', Hard: '#E85B7A' };
        beatsCtx.fillStyle = diffColors[song.difficulty] || '#B8B0CC';
        beatsCtx.font = '7px "Press Start 2P", monospace';
        beatsCtx.fillText(song.difficulty, 32, y + 38);

        // Note count
        beatsCtx.fillStyle = '#555270';
        beatsCtx.textAlign = 'right';
        beatsCtx.fillText(song.notes.length + ' notes', BW - 32, y + 20);
        beatsCtx.fillText(song.bpm + ' BPM', BW - 32, y + 38);
    });

    // Instruction
    beatsCtx.fillStyle = '#555270';
    beatsCtx.font = '6px "Press Start 2P", monospace';
    beatsCtx.textAlign = 'center';
    beatsCtx.fillText('Tap a song to play  |  D F J K keys', BW / 2, BH - 10);
}

function drawBeatsResults() {
    beatsCtx.fillStyle = '#0D0C14';
    beatsCtx.fillRect(0, 0, BW, BH);

    // Title
    beatsCtx.fillStyle = '#F0C674';
    beatsCtx.font = '14px "Press Start 2P", monospace';
    beatsCtx.textAlign = 'center';
    beatsCtx.fillText('SONG COMPLETE!', BW / 2, 40);

    // Song name
    beatsCtx.fillStyle = '#B8B0CC';
    beatsCtx.font = '8px "Press Start 2P", monospace';
    beatsCtx.fillText(beats.song.name, BW / 2, 62);

    // Grade
    const pct = beats.totalNotes > 0 ? (beats.perfects + beats.goods + beats.oks) / beats.totalNotes : 0;
    let grade, gradeColor;
    if (pct >= 0.95) { grade = 'S'; gradeColor = '#F0C674'; }
    else if (pct >= 0.85) { grade = 'A'; gradeColor = '#6FCF97'; }
    else if (pct >= 0.7) { grade = 'B'; gradeColor = '#5BA4E8'; }
    else if (pct >= 0.5) { grade = 'C'; gradeColor = '#E8C85B'; }
    else { grade = 'D'; gradeColor = '#E85B7A'; }

    beatsCtx.fillStyle = gradeColor;
    beatsCtx.font = '40px "Press Start 2P", monospace';
    beatsCtx.fillText(grade, BW / 2, 120);

    // Stats
    beatsCtx.font = '8px "Press Start 2P", monospace';
    beatsCtx.textAlign = 'left';
    const sx = 60;
    let sy = 155;
    const lineH = 22;

    beatsCtx.fillStyle = '#F0C674';
    beatsCtx.fillText('Perfect:', sx, sy);
    beatsCtx.textAlign = 'right';
    beatsCtx.fillText(beats.perfects + '', BW - sx, sy);
    sy += lineH;

    beatsCtx.textAlign = 'left';
    beatsCtx.fillStyle = '#6FCF97';
    beatsCtx.fillText('Good:', sx, sy);
    beatsCtx.textAlign = 'right';
    beatsCtx.fillText(beats.goods + '', BW - sx, sy);
    sy += lineH;

    beatsCtx.textAlign = 'left';
    beatsCtx.fillStyle = '#5BA4E8';
    beatsCtx.fillText('OK:', sx, sy);
    beatsCtx.textAlign = 'right';
    beatsCtx.fillText(beats.oks + '', BW - sx, sy);
    sy += lineH;

    beatsCtx.textAlign = 'left';
    beatsCtx.fillStyle = '#CC3333';
    beatsCtx.fillText('Miss:', sx, sy);
    beatsCtx.textAlign = 'right';
    beatsCtx.fillText(beats.misses + '', BW - sx, sy);
    sy += lineH;

    beatsCtx.textAlign = 'left';
    beatsCtx.fillStyle = '#F5E6D0';
    beatsCtx.fillText('Max Combo:', sx, sy);
    beatsCtx.textAlign = 'right';
    beatsCtx.fillText(beats.maxCombo + 'x', BW - sx, sy);
    sy += lineH;

    beatsCtx.textAlign = 'left';
    beatsCtx.fillStyle = '#F5E6D0';
    beatsCtx.fillText('Score:', sx, sy);
    beatsCtx.textAlign = 'right';
    beatsCtx.fillText(Math.floor(beats.score) + '', BW - sx, sy);
    sy += lineH + 8;

    // Rewards
    beatsCtx.textAlign = 'center';
    beatsCtx.fillStyle = '#F0C674';
    beatsCtx.fillText('+ ' + beats.coinsEarned + ' coins   + ' + Math.min(25, Math.floor(beats.score / 100)) + ' fun', BW / 2, sy);

    // Tap to continue
    beatsCtx.fillStyle = '#555270';
    beatsCtx.font = '7px "Press Start 2P", monospace';
    beatsCtx.fillText('Tap to return to song list', BW / 2, BH - 15);
}

function showBeatsResults() {
    beats.phase = 'results';

    // Calculate rewards
    const pct = beats.totalNotes > 0 ? (beats.perfects + beats.goods + beats.oks) / beats.totalNotes : 0;
    beats.coinsEarned = Math.floor(pct * 5) + (beats.maxCombo >= 20 ? 3 : 0);
    const funBoost = Math.min(25, Math.floor(beats.score / 100));

    state.coins += beats.coinsEarned;
    state.fun = Math.min(100, state.fun + funBoost);
    updateStatBars();
    updateCoinDisplay();
    saveGame();
}

// Input handling for beats
function onBeatsCanvasInput(e) {
    if (currentScreen !== 'beats') return;
    e.preventDefault();

    if (beats.phase === 'menu') {
        // Check which song was tapped
        const rect = beatsCanvas.getBoundingClientRect();
        const scaleY = BH / rect.height;
        let clientY;
        if (e.touches) clientY = e.touches[0].clientY;
        else clientY = e.clientY;
        const y = (clientY - rect.top) * scaleY;

        const itemH = 60;
        const startY = 80;
        const index = Math.floor((y - startY) / itemH);
        if (index >= 0 && index < SONGS.length) {
            startSong(index);
        }
        return;
    }

    if (beats.phase === 'results') {
        beats.phase = 'menu';
        return;
    }

    if (beats.phase === 'playing') {
        // Determine which lane was tapped based on X position
        const rect = beatsCanvas.getBoundingClientRect();
        const scaleX = BW / rect.width;
        let clientX;
        if (e.touches) clientX = e.touches[0].clientX;
        else clientX = e.clientX;
        const x = (clientX - rect.left) * scaleX;
        const lane = Math.floor(x / (BW / NUM_LANES));
        if (lane >= 0 && lane < NUM_LANES) {
            beatsHitLane(lane);
        }
    }
}

function onBeatsKeyDown(e) {
    if (currentScreen !== 'beats' || beats.phase !== 'playing') return;
    const lane = LANE_KEYS.indexOf(e.key.toLowerCase());
    if (lane >= 0) {
        e.preventDefault();
        beatsHitLane(lane);
    }
}

// ---- BAR SCENE ----
const BEAN_NAMES = [
    'Lima Larry', 'Pinto Pete', 'Kidney Karen', 'Black Bean Bob',
    'Navy Nancy', 'Edamame Eddie', 'Garbanzo Gary', 'Lentil Lisa',
    'Fava Frank', 'Mung Bean Mike', 'String Bean Steve', 'Jelly Bean Jen',
    'Cool Bean Chris', 'Has-Bean Harry', 'Refried Rita', 'Espresso Ellie',
    'Vanilla Val', 'Cocoa Bean Carl', 'Coffee Kate', 'Jumping Bean Jake',
    'Broad Bean Betty', 'Runner Bean Rick', 'Butter Bean Barb', 'Soy Bean Sam',
];

const BEAN_VIBES = [
    { id: 'chill',    label: 'vibing to the jukebox',     emoji: '😎' },
    { id: 'rowdy',    label: 'being loud at the bar',      emoji: '🤪' },
    { id: 'shy',      label: 'quietly sipping a drink',    emoji: '🥺' },
    { id: 'philo',    label: 'staring deep into a beer',   emoji: '🤔' },
    { id: 'sporty',   label: 'watching disc golf on TV',   emoji: '🏆' },
    { id: 'funny',    label: 'cracking up at something',   emoji: '😂' },
];

const BEAN_COLORS = ['#8B6B4A', '#A0825E', '#6B8B5A', '#8B5A5A', '#5A6B8B', '#8B7B5A', '#7A5A8B', '#5A8B7B'];

// Conversation topics and responses per vibe
const CONVERSATIONS = {
    greet: {
        label: 'Say hey',
        responses: {
            chill:  ['"Heyyy, what\'s good? Pull up a stool."', '"Sup. Nice night for a cold one."', '"Ayy, haven\'t seen you around. Welcome."'],
            rowdy:  ['"YOOO! This bean knows how to party!"', '"Finally someone cool showed up! Let\'s GO!"', '"HEY! You look like you can hang!"'],
            shy:    ['"Oh, um... hi there."', '"...hey." *small wave*', '"Oh! I didn\'t think anyone would come talk to me."'],
            philo:  ['"Ah, another soul seeking connection in this vast universe."', '"Hello, friend. Tell me — are we beans having a human experience?"', '"Welcome. I was just pondering the meaning of fermentation."'],
            sporty: ['"Hey! Did you see that ace on hole 7 today??"', '"What\'s up! You play disc golf? You LOOK like you play."', '"Yo! My drive has been so clean lately."'],
            funny:  ['"Oh good, I need a new audience — everyone else already heard my jokes."', '"Hey! Quick — what do you call a bean that tells lies? A fib-er bean!"', '"Welcome to my TED talk. Today\'s topic: why bar nuts are hilarious."'],
            pam:    ['"Well well well, look who finally showed up! I was JUST talking about you."', '"Hey sugar! Pam\'s been holding down this stool since Tuesday. Pull up a chair!"', '"Oh honey, you look like you need a drink and a story. I got both."'],
        },
        social: 8, fun: 3,
    },
    joke: {
        label: 'Tell a joke',
        responses: {
            chill:  ['"Heh, nice one. That\'s pretty good."', '"Ha! Okay okay, I see you."', '*nods approvingly* "Solid."'],
            rowdy:  ['"BAHAHA! That\'s the best thing I\'ve heard all WEEK!"', '"I\'M DYING! Tell another one!"', '"HAHAHAHA oh man, you\'re killing me!"'],
            shy:    ['"Oh... hehe..." *covers face* "That was actually funny."', '"..." *trying not to laugh* "...okay that was good."', '*giggles quietly* "...please tell more."'],
            philo:  ['"Interesting. Humor as a defense mechanism against the absurd."', '"Hmm. That joke reveals a deeper truth about bean society."', '"I laughed, but also, have you considered WHY it\'s funny?"'],
            sporty: ['"Ha! Good one. Okay but have you heard the one about the shanked drive?"', '"Lol nice. Not as good as my disc golf jokes though."', '"Haha! Reminds me of this one time on hole 3—"'],
            funny:  ['"Okay that was a 7/10. Let me hit you with a 10/10..."', '"HA! A fellow comedian! We should start a duo."', '"Not bad, not bad. But check THIS one out—"'],
            pam:    ['"HAAAA! Oh that\'s good. I\'m stealing that. It\'s mine now."', '"Okay okay, not bad! But have you heard the one about the bean who walked into a bar? ...it\'s this bar. I\'m the bean. I never left."', '"HA! You\'re funny. Not as funny as me, but who is?"'],
        },
        social: 12, fun: 8,
    },
    deep: {
        label: 'Get deep',
        responses: {
            chill:  ['"For real though... I\'m glad I came out tonight."', '"You know what, you\'re good people. I mean, good beans."', '"Life\'s pretty good when you think about it. Cheers."'],
            rowdy:  ['"Bro... that\'s actually... *sniff* ...really beautiful."', '"Dude okay I wasn\'t ready to get emotional tonight."', '"Why you gotta make it deep?? ...but yeah, you\'re right."'],
            shy:    ['"Wow... nobody ever asks me real stuff like that."', '"I... actually really needed to hear that tonight."', '"You\'re the first bean who really gets me."'],
            philo:  ['"YES. Now we\'re talking. The existential weight of being a bean..."', '"I\'ve been waiting all night for this conversation."', '"This is why I come to bars. Not the drinks. The TRUTH."'],
            sporty: ['"Huh. I usually don\'t go there but... you make a good point."', '"That\'s actually deep. Like a really deep rough on hole 12."', '"Wow... I need to think about that during my next round."'],
            funny:  ['"Oh we\'re doing feelings now? ...okay fine, that was beautiful."', '"Dang. I came here to laugh, not to FEEL."', '"...alright that got me. Cheers to that."'],
            pam:    ['"Oh honey... *puts down drink* ...you know, I\'ve been coming to this bar for years. You\'re the first bean who actually asked how I\'m doing."', '"Listen. Pam\'s been through a LOT. Three marriages, two business failures, and one really bad haircut. But you know what? I wouldn\'t change a thing."', '"...you\'re a real one, you know that? Most beans just want jokes. You actually listen."'],
        },
        social: 18, fun: 2,
    },
    buyround: {
        label: 'Buy a round',
        cost: 2,
        responses: {
            chill:  ['"Woah, you didn\'t have to! ...but I respect it. Cheers!"', '"Now THAT is a vibe. You\'re officially my friend."', '"A bean after my own heart. To good times!"'],
            rowdy:  ['"YOOOO FREE DRINKS!! THIS BEAN IS A LEGEND!!"', '"EVERYBODY! This bean just bought a round! *the whole bar cheers*"', '"LET\'S GOOOO! Best bean in the building!!"'],
            shy:    ['"For... for me? Oh wow... you really didn\'t have to..."', '"*eyes light up* ...nobody\'s ever bought me a drink before."', '"This is... the nicest thing. Thank you."'],
            philo:  ['"Generosity — the purest expression of the bean condition."', '"In buying this round, you buy a moment of connection. Beautiful."', '"The glass fills, as does my appreciation for your kindness."'],
            sporty: ['"Drinks on you?? That\'s a birdie move right there!"', '"Now THAT\'S a power play! Cheers, champ!"', '"Ace move! Next round of disc golf is on me."'],
            funny:  ['"Free drinks AND good company? Did I win the lottery?"', '"To the bean with the deepest pockets and biggest heart!"', '"Finally my looks are paying off! ...wait, you\'re buying for everyone?"'],
            pam:    ['"NOW we\'re talking!! BARTENDER! This one\'s buying! *announces it to the entire bar*"', '"Oh you sweet angel bean. Pam will remember this FOREVER. And I mean it — I have a spreadsheet."', '"This is why you\'re my favorite. Don\'t tell the others. Actually, tell them. I don\'t care."'],
        },
        social: 22, fun: 10, thirst: 15,
    },
    discgolf: {
        label: 'Talk disc golf',
        responses: {
            chill:  ['"I\'ve been getting into it! Super relaxing out on the course."', '"Disc golf is the perfect chill sport. Beer in one hand, disc in the other."', '"My buddy took me last week. I\'m hooked."'],
            rowdy:  ['"DUDE I just threw the farthest drive of my LIFE yesterday!"', '"Disc golf?? I SMASH drivers! Pure BEEF!"', '"Let\'s play tomorrow! I\'ll bring the beers!"'],
            shy:    ['"I\'ve been wanting to try but... I\'d need someone to go with."', '"I watch videos about it... it looks really peaceful."', '"Maybe... would you want to play sometime?"'],
            philo:  ['"The flight of a disc — chaos and order in perfect balance."', '"Each throw is a metaphor. The wind, the trees, the choices..."', '"In disc golf, as in life, we throw and hope for the best."'],
            sporty: ['"Oh you wanna go? My forehand is NASTY right now."', '"I just parked a 300-footer yesterday. No big deal."', '"What\'s your go-to driver? I\'m a Destroyer bean myself."'],
            funny:  ['"I played yesterday! Shot a 12 on one hole. New record!"', '"I\'m great at disc golf. The disc just goes... not where I want."', '"Trees are 90% of the course and 100% of my problems."'],
            pam:    ['"Oh I LOVE disc golf. I mean, I\'ve never played. But I love the outfits."', '"My ex-husband was really into disc golf. That\'s actually why he\'s my ex. He chose the course over me. TWICE."', '"I threw a disc once. It went backwards. The group behind us applauded. I took a bow."'],
        },
        social: 10, fun: 12,
    },
};

const barCanvas = $('bar-canvas');
let barCtx = barCanvas.getContext('2d');

let barState = {
    npcs: [],
    talkingTo: null,
    phase: 'pick', // pick, dialogue, result
};

// Pinto Bean Pam - always at the bar
const PAM = {
    name: 'Pinto Bean Pam',
    vibe: { id: 'funny', label: 'holding court at the bar', emoji: '👑' },
    color: '#C4885A',
    talked: false,
    isPam: true,
};

function enterBar() {
    // Pam is always there + 2 random NPCs
    const shuffledNames = [...BEAN_NAMES].sort(() => Math.random() - 0.5);
    const shuffledVibes = [...BEAN_VIBES].sort(() => Math.random() - 0.5);
    barState.npcs = [{ ...PAM, talked: false }];
    for (let i = 0; i < 2; i++) {
        barState.npcs.push({
            name: shuffledNames[i],
            vibe: shuffledVibes[i],
            color: BEAN_COLORS[Math.floor(Math.random() * BEAN_COLORS.length)],
            talked: false,
        });
    }
    barState.talkingTo = null;
    barState.phase = 'pick';
    drawBar();
    renderBarUI();
}

function drawBar() {
    barCtx = pixelBegin('bar');
    const w = barCanvas.width;
    const h = barCanvas.height;

    // Bar background - warm dark interior
    barCtx.fillStyle = '#2A1F14';
    barCtx.fillRect(0, 0, w, h);

    // Back wall (wood paneling)
    barCtx.fillStyle = '#3D2B1A';
    barCtx.fillRect(0, 0, w, h * 0.55);
    // Wall planks
    barCtx.strokeStyle = '#33220F';
    barCtx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
        const x = i * (w / 8) + 10;
        barCtx.beginPath();
        barCtx.moveTo(x, 0);
        barCtx.lineTo(x, h * 0.55);
        barCtx.stroke();
    }

    // Shelf on wall
    barCtx.fillStyle = '#5C4025';
    barCtx.fillRect(20, 30, w - 40, 8);
    barCtx.fillStyle = '#4A3320';
    barCtx.fillRect(20, 38, w - 40, 3);

    // Bottles on shelf
    const bottleColors = ['#2D7D2D', '#8B2020', '#C4A043', '#2050A0', '#8B6538', '#A02050'];
    for (let i = 0; i < 10; i++) {
        const bx = 35 + i * 35;
        const bc = bottleColors[i % bottleColors.length];
        barCtx.fillStyle = bc;
        barCtx.fillRect(bx - 4, 8, 8, 22);
        barCtx.fillStyle = '#1A1210';
        barCtx.fillRect(bx - 2, 4, 4, 6);
    }

    // Neon sign glow
    barCtx.fillStyle = 'rgba(240, 198, 116, 0.08)';
    barCtx.beginPath();
    barCtx.arc(w / 2, 55, 60, 0, Math.PI * 2);
    barCtx.fill();
    // Neon sign text
    barCtx.font = '10px "Press Start 2P", monospace';
    barCtx.textAlign = 'center';
    barCtx.fillStyle = '#F0C674';
    barCtx.fillText('THE BEAN BAR', w / 2, 58);
    barCtx.strokeStyle = '#F0C674';
    barCtx.lineWidth = 1;
    barCtx.strokeRect(w / 2 - 70, 44, 140, 22);

    // Bar counter top
    barCtx.fillStyle = '#5C4025';
    barCtx.fillRect(0, h * 0.55, w, 12);
    // Counter front
    barCtx.fillStyle = '#4A3320';
    barCtx.fillRect(0, h * 0.55 + 12, w, h * 0.45 - 12);
    // Counter trim
    barCtx.fillStyle = '#6B5030';
    barCtx.fillRect(0, h * 0.55, w, 4);
    // Counter wood grain
    barCtx.strokeStyle = '#3D2815';
    barCtx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
        const y = h * 0.55 + 20 + i * 15;
        barCtx.beginPath();
        barCtx.moveTo(0, y);
        barCtx.lineTo(w, y);
        barCtx.stroke();
    }

    // Bar stools
    for (let i = 0; i < 3; i++) {
        const sx = 80 + i * 120;
        const sy = h * 0.55 + 40;
        // Stool base
        barCtx.strokeStyle = '#666';
        barCtx.lineWidth = 3;
        barCtx.beginPath();
        barCtx.moveTo(sx, sy + 20);
        barCtx.lineTo(sx, sy + 45);
        barCtx.stroke();
        barCtx.beginPath();
        barCtx.moveTo(sx - 12, sy + 45);
        barCtx.lineTo(sx + 12, sy + 45);
        barCtx.stroke();
        // Stool seat
        barCtx.fillStyle = '#8B4444';
        barCtx.beginPath();
        barCtx.ellipse(sx, sy + 18, 14, 6, 0, 0, Math.PI * 2);
        barCtx.fill();
    }

    // Draw NPC beans on stools
    barState.npcs.forEach((npc, i) => {
        const bx = 80 + i * 120;
        const by = h * 0.55 + 10;
        drawBarBean(bx, by, npc);
    });

    // Your bean at the bar (smaller, at the counter)
    const yx = 200;
    const yy = h * 0.55 + 60;
    barCtx.fillStyle = '#8B6B4A';
    barCtx.beginPath();
    barCtx.ellipse(yx, yy, 10, 14, 0, 0, Math.PI * 2);
    barCtx.fill();
    barCtx.strokeStyle = '#5C4530';
    barCtx.lineWidth = 1.5;
    barCtx.stroke();
    // Your face
    barCtx.fillStyle = '#3D2B1A';
    barCtx.beginPath();
    barCtx.arc(yx - 3, yy - 4, 2, 0, Math.PI * 2);
    barCtx.arc(yx + 3, yy - 4, 2, 0, Math.PI * 2);
    barCtx.fill();
    // Smile
    barCtx.strokeStyle = '#3D2B1A';
    barCtx.lineWidth = 1.5;
    barCtx.beginPath();
    barCtx.arc(yx, yy, 4, 0.2, Math.PI - 0.2);
    barCtx.stroke();
    // Label
    barCtx.font = '6px "Press Start 2P", monospace';
    barCtx.fillStyle = '#F0C674';
    barCtx.textAlign = 'center';
    barCtx.fillText('YOU', yx, yy + 22);

    // Drinks on counter
    barState.npcs.forEach((npc, i) => {
        const dx = 70 + i * 120;
        const dy = h * 0.55 + 2;
        // Glass
        barCtx.fillStyle = '#F0C674';
        barCtx.fillRect(dx, dy - 10, 8, 10);
        barCtx.fillStyle = 'rgba(255,255,255,0.3)';
        barCtx.fillRect(dx + 1, dy - 9, 3, 8);
    });

    pixelEnd('bar');
}

function drawBarBean(x, y, npc) {
    // Body
    barCtx.fillStyle = npc.color;
    barCtx.beginPath();
    barCtx.ellipse(x, y - 8, 12, 16, 0, 0, Math.PI * 2);
    barCtx.fill();
    barCtx.strokeStyle = '#3D2B1A';
    barCtx.lineWidth = 1.5;
    barCtx.stroke();

    // Highlight
    barCtx.fillStyle = 'rgba(255,255,255,0.12)';
    barCtx.beginPath();
    barCtx.ellipse(x - 3, y - 13, 5, 9, -0.3, 0, Math.PI * 2);
    barCtx.fill();

    // Eyes
    barCtx.fillStyle = '#3D2B1A';
    barCtx.beginPath();
    barCtx.arc(x - 4, y - 12, 2, 0, Math.PI * 2);
    barCtx.arc(x + 4, y - 12, 2, 0, Math.PI * 2);
    barCtx.fill();
    // Eye shine
    barCtx.fillStyle = 'white';
    barCtx.beginPath();
    barCtx.arc(x - 3, y - 13, 0.8, 0, Math.PI * 2);
    barCtx.arc(x + 5, y - 13, 0.8, 0, Math.PI * 2);
    barCtx.fill();

    // Mouth (varies by vibe)
    barCtx.strokeStyle = '#3D2B1A';
    barCtx.lineWidth = 1.5;
    barCtx.beginPath();
    if (npc.vibe.id === 'rowdy') {
        barCtx.arc(x, y - 6, 5, 0, Math.PI); // big open mouth
        barCtx.fill();
    } else if (npc.vibe.id === 'shy') {
        barCtx.moveTo(x - 2, y - 5);
        barCtx.lineTo(x + 2, y - 5);
    } else {
        barCtx.arc(x, y - 6, 3, 0.2, Math.PI - 0.2);
    }
    barCtx.stroke();

    // Name tag
    barCtx.font = '6px "Press Start 2P", monospace';
    barCtx.fillStyle = '#F5E6D0';
    barCtx.textAlign = 'center';
    barCtx.fillText(npc.name.split(' ')[0], x, y + 16);

    // Highlight if talking to
    if (barState.talkingTo === npc) {
        barCtx.strokeStyle = '#F0C674';
        barCtx.lineWidth = 2;
        barCtx.setLineDash([3, 3]);
        barCtx.beginPath();
        barCtx.arc(x, y - 6, 22, 0, Math.PI * 2);
        barCtx.stroke();
        barCtx.setLineDash([]);
    }
}

function renderBarUI() {
    const npcList = $('bar-npc-list');
    const dialogue = $('bar-dialogue');
    const result = $('bar-result');

    if (barState.phase === 'pick') {
        npcList.classList.remove('hidden');
        dialogue.classList.add('hidden');
        result.classList.add('hidden');
        npcList.innerHTML = '<div style="font-size:8px;color:#F0C674;margin-bottom:6px;text-align:center;">Who do you wanna talk to?</div>';

        barState.npcs.forEach((npc, i) => {
            const btn = document.createElement('div');
            btn.className = 'bar-npc-btn';
            btn.innerHTML = `
                <span class="npc-icon">${npc.vibe.emoji}</span>
                <span class="npc-info">
                    <span class="npc-name">${npc.name}</span>
                    <span class="npc-vibe">${npc.vibe.label}</span>
                </span>
            `;
            btn.addEventListener('click', () => startConversation(npc));
            npcList.appendChild(btn);
        });
    } else if (barState.phase === 'dialogue') {
        npcList.classList.add('hidden');
        dialogue.classList.remove('hidden');
        result.classList.add('hidden');

        const npc = barState.talkingTo;
        $('bar-speaker').textContent = npc.vibe.emoji + ' ' + npc.name;
        $('bar-text').textContent = barState.greeting;

        const choices = $('bar-choices');
        choices.innerHTML = '';
        Object.entries(CONVERSATIONS).forEach(([key, conv]) => {
            if (key === 'greet') return; // greeting already happened
            const btn = document.createElement('button');
            btn.className = 'bar-choice-btn';
            let label = conv.label;
            if (conv.cost) label += ` <span class="choice-cost">(${conv.cost} coins)</span>`;
            btn.innerHTML = label;
            if (conv.cost && state.coins < conv.cost) {
                btn.disabled = true;
                btn.style.opacity = '0.4';
            }
            btn.addEventListener('click', () => doBarAction(key, conv, npc));
            choices.appendChild(btn);
        });

        // Back button
        const backBtn = document.createElement('button');
        backBtn.className = 'bar-choice-btn';
        backBtn.style.borderColor = '#B8B0CC';
        backBtn.textContent = '← Talk to someone else';
        backBtn.addEventListener('click', () => {
            barState.phase = 'pick';
            barState.talkingTo = null;
            drawBar();
            renderBarUI();
        });
        choices.appendChild(backBtn);
    }
}

function startConversation(npc) {
    barState.talkingTo = npc;
    barState.phase = 'dialogue';

    // Get greeting
    const vibeKey = npc.isPam ? 'pam' : npc.vibe.id;
    const greetings = CONVERSATIONS.greet.responses[vibeKey];
    barState.greeting = greetings[Math.floor(Math.random() * greetings.length)];

    // Apply greeting boost
    state.social = Math.min(100, state.social + CONVERSATIONS.greet.social);
    state.fun = Math.min(100, state.fun + CONVERSATIONS.greet.fun);

    drawBar();
    renderBarUI();
}

function doBarAction(key, conv, npc) {
    if (conv.cost) {
        if (state.coins < conv.cost) return;
        state.coins -= conv.cost;
    }

    // Get response
    const vibeKey = npc.isPam ? 'pam' : npc.vibe.id;
    const responses = conv.responses[vibeKey];
    const response = responses[Math.floor(Math.random() * responses.length)];

    // Apply stat boosts
    if (conv.social) state.social = Math.min(100, state.social + conv.social);
    if (conv.fun) state.fun = Math.min(100, state.fun + conv.fun);
    if (conv.thirst) state.thirst = Math.min(100, state.thirst + conv.thirst);

    // Show result
    barState.phase = 'result';
    let resultText = `${npc.vibe.emoji} ${npc.name}:\n${response}\n\n`;
    if (conv.social) resultText += `+${conv.social} social  `;
    if (conv.fun) resultText += `+${conv.fun} fun  `;
    if (conv.thirst) resultText += `+${conv.thirst} thirst  `;
    if (conv.cost) resultText += `\n-${conv.cost} coins`;

    $('bar-npc-list').classList.add('hidden');
    $('bar-dialogue').classList.add('hidden');
    $('bar-result').classList.remove('hidden');
    $('bar-result-text').textContent = resultText;

    updateStatBars();
    updateCoinDisplay();
    saveGame();
}

function barTalkMore() {
    barState.phase = 'pick';
    barState.talkingTo = null;
    drawBar();
    renderBarUI();
}

// ---- DECORATE MODE ----
let decorateMode = false;
let decoSelectedItem = null;
let decoDragging = false;
let decoLastTouch = null;

function enterDecorateMode() {
    decorateMode = true;
    decoSelectedItem = null;
    $('action-bar').classList.add('hidden');
    $('decorate-bar').classList.remove('hidden');
    $('stat-bars').classList.add('hidden');
    $('status-text').textContent = 'DECORATE MODE - Place your furniture!';
    renderDecoInventory();
    document.body.classList.add('decorate-active');
}

function exitDecorateMode() {
    decorateMode = false;
    decoSelectedItem = null;
    $('action-bar').classList.remove('hidden');
    $('decorate-bar').classList.add('hidden');
    $('stat-bars').classList.remove('hidden');
    document.body.classList.remove('decorate-active');
    updateStatusText();
    saveGame();
}

function renderDecoInventory() {
    const container = $('decorate-inventory');
    container.innerHTML = '';
    state.furniture.forEach(id => {
        const item = FURNITURE.find(f => f.id === id);
        if (!item) return;
        const placed = !!state.furniturePlacement[id];
        const div = document.createElement('div');
        div.className = 'deco-item' + (decoSelectedItem === id ? ' selected' : '');
        div.innerHTML = `
            <span class="deco-item-icon">${item.icon}</span>
            <span class="deco-item-name">${item.name}</span>
        `;
        div.addEventListener('click', () => {
            decoSelectedItem = id;
            renderDecoInventory();
        });
        container.appendChild(div);
    });
}

function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let clientX, clientY;
    if (e.touches) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
    };
}

function findItemAtPos(pos) {
    // Check items in reverse order (top-most first)
    const sorted = [...state.furniture].sort((a, b) => {
        const pa = state.furniturePlacement[a] || { y: 0 };
        const pb = state.furniturePlacement[b] || { y: 0 };
        return pb.y - pa.y;
    });
    for (const id of sorted) {
        const p = state.furniturePlacement[id];
        if (!p) continue;
        const dx = pos.x - p.x;
        const dy = pos.y - p.y;
        const hitRadius = 28 * p.scale;
        if (dx * dx + dy * dy < hitRadius * hitRadius) return id;
    }
    return null;
}

function onCanvasDown(e) {
    if (!decorateMode) return;
    e.preventDefault();
    const pos = getCanvasPos(e);

    // If we have a selected inventory item, check if clicking on an existing item first
    const hitItem = findItemAtPos(pos);
    if (hitItem) {
        decoSelectedItem = hitItem;
        decoDragging = true;
        decoLastTouch = pos;
        renderDecoInventory();
        return;
    }

    // If an item is selected in inventory, place/move it to this position
    if (decoSelectedItem) {
        if (!state.furniturePlacement[decoSelectedItem]) {
            state.furniturePlacement[decoSelectedItem] = { x: pos.x, y: pos.y, scale: 1, rotation: 0 };
        } else {
            state.furniturePlacement[decoSelectedItem].x = pos.x;
            state.furniturePlacement[decoSelectedItem].y = pos.y;
        }
        decoDragging = true;
        decoLastTouch = pos;
        saveGame();
    }
}

function onCanvasMove(e) {
    if (!decorateMode || !decoDragging || !decoSelectedItem) return;
    e.preventDefault();
    const pos = getCanvasPos(e);
    const placement = state.furniturePlacement[decoSelectedItem];
    if (placement) {
        placement.x = pos.x;
        placement.y = pos.y;
    }
    decoLastTouch = pos;
}

function onCanvasUp(e) {
    if (!decorateMode) return;
    decoDragging = false;
    decoLastTouch = null;
    saveGame();
}

function decoRotate() {
    if (!decoSelectedItem) return;
    const p = state.furniturePlacement[decoSelectedItem];
    if (p) {
        p.rotation = (p.rotation + 1) % 4;
        saveGame();
    }
}

function decoFlip() {
    if (!decoSelectedItem) return;
    const p = state.furniturePlacement[decoSelectedItem];
    if (p) {
        p.flip = !p.flip;
        saveGame();
    }
}

function decoResize(delta) {
    if (!decoSelectedItem) return;
    const p = state.furniturePlacement[decoSelectedItem];
    if (p) {
        p.scale = Math.max(0.4, Math.min(2.5, p.scale + delta));
        saveGame();
    }
}

// ---- SCREEN NAVIGATION ----
let currentScreen = 'room';

function switchScreen(screen) {
    // Exit decorate mode if switching away
    if (decorateMode && screen !== 'decorate') exitDecorateMode();

    if (screen === 'decorate') {
        // Decorate reuses the room screen
        currentScreen = 'room';
        $('game-screen').classList.remove('hidden');
        $('shop-screen').classList.add('hidden');
        $('discgolf-screen').classList.add('hidden');
        enterDecorateMode();
    } else {
        currentScreen = screen;
        $('game-screen').classList.toggle('hidden', screen !== 'room');
        $('action-bar').classList.toggle('hidden', screen !== 'room');
        $('shop-screen').classList.toggle('hidden', screen !== 'shop');
        $('bar-screen').classList.toggle('hidden', screen !== 'bar');
        $('discgolf-screen').classList.toggle('hidden', screen !== 'discgolf');
        $('flappy-screen').classList.toggle('hidden', screen !== 'flappy');
        $('beats-screen').classList.toggle('hidden', screen !== 'beats');
        $('decorate-bar').classList.add('hidden');
    }

    // Active nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.screen === screen);
    });

    if (screen === 'shop') renderShop();
    if (screen === 'discgolf') startDiscGolf();
    if (screen === 'flappy') startFlappy();
    if (screen !== 'flappy') stopFlappy();
    if (screen === 'beats') startBeats();
    if (screen !== 'beats') stopBeats();
}

// ---- REVIVE ----
function reviveBean() {
    state.alive = true;
    state.hunger = 30;
    state.thirst = 30;
    state.social = 30;
    state.fun = 30;
    state.hungover = false;
    state.beerTimestamps = [];
    // Lose some coins as penalty
    state.coins = Math.max(0, state.coins - 5);
    $('passed-out-overlay').classList.add('hidden');
    saveGame();
    showNotification('Your bean is back! Take better care of it this time! (-5 coins)');
}

// ---- EVENT LISTENERS ----
function init() {
    loadGame();

    // Initialize pixel art buffers
    initPixelBuffer('room', canvas);
    initPixelBuffer('disc', discCanvas);
    initPixelBuffer('flappy', flapCanvas);
    initPixelBuffer('bar', barCanvas);
    initPixelBuffer('beats', beatsCanvas);

    // Action buttons
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', () => doAction(btn.dataset.action));
    });

    // Nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchScreen(btn.dataset.screen));
    });

    // Notification OK
    $('notification-ok').addEventListener('click', () => {
        $('notification').classList.add('hidden');
    });

    // Revive
    $('revive-btn').addEventListener('click', reviveBean);

    // Disc golf controls
    document.querySelectorAll('.disc-type').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.disc-type').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            discState.disc = btn.dataset.disc;
        });
    });

    // Flappy Bean input
    flapCanvas.addEventListener('click', onFlappyInput);
    flapCanvas.addEventListener('touchstart', onFlappyInput, { passive: false });
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && currentScreen === 'flappy') {
            e.preventDefault();
            flapJump();
        }
    });

    // Bean Beats input
    beatsCanvas.addEventListener('click', onBeatsCanvasInput);
    beatsCanvas.addEventListener('touchstart', onBeatsCanvasInput, { passive: false });
    document.addEventListener('keydown', onBeatsKeyDown);

    // Bar buttons
    $('bar-talk-more').addEventListener('click', barTalkMore);
    $('bar-leave').addEventListener('click', () => switchScreen('room'));

    $('throw-btn').addEventListener('click', throwDisc);
    $('disc-next').addEventListener('click', nextHole);
    $('disc-play-again').addEventListener('click', startDiscGolf);
    $('disc-back').addEventListener('click', () => switchScreen('room'));

    // Decorate mode controls
    $('deco-rotate').addEventListener('click', decoRotate);
    $('deco-flip').addEventListener('click', decoFlip);
    $('deco-smaller').addEventListener('click', () => decoResize(-0.15));
    $('deco-bigger').addEventListener('click', () => decoResize(0.15));
    $('deco-done').addEventListener('click', () => switchScreen('room'));

    // Canvas interaction for decorate mode
    canvas.addEventListener('mousedown', onCanvasDown);
    canvas.addEventListener('mousemove', onCanvasMove);
    canvas.addEventListener('mouseup', onCanvasUp);
    canvas.addEventListener('touchstart', onCanvasDown, { passive: false });
    canvas.addEventListener('touchmove', onCanvasMove, { passive: false });
    canvas.addEventListener('touchend', onCanvasUp);

    // Bean naming
    $('bean-name-save').addEventListener('click', () => {
        const name = $('bean-name-input').value.trim();
        if (name) {
            state.beanName = name;
            $('name-overlay').classList.add('hidden');
            updateBeanName();
            saveGame();
        }
    });

    // Initial UI
    updateStatBars();
    updateCoinDisplay();
    updateStatusText();
    updateBeanName();

    // Show naming overlay if no name set
    if (!state.beanName) {
        $('name-overlay').classList.remove('hidden');
    }

    if (!state.alive) {
        $('passed-out-overlay').classList.remove('hidden');
    }

    // Start game loop (ticks every second)
    setInterval(gameTick, TICK_INTERVAL);

    // Start render loop
    renderLoop();

    // Save on page hide
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) saveGame();
    });
    window.addEventListener('beforeunload', saveGame);
}

// Start the game!
init();
