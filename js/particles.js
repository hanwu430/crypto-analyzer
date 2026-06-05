/**
 * 现代化粒子系统 - 赛博朋克/宇宙轨道风格
 * Canvas渲染加密货币粒子，多层光晕、轨迹、涟漪交互
 */

const ParticleSystem = {
    canvas: null,
    ctx: null,
    particles: [],
    trails: [],          // 轨迹粒子
    ripples: [],         // 鼠标涟漪
    animationId: null,
    mouse: { x: -1000, y: -1000, prevX: -1000, prevY: -1000 },
    hoveredParticle: null,
    onClickCallback: null,
    time: 0,
    centerX: 0,
    centerY: 0,
    stars: [],           // 背景星空

    init(canvas, onClickCallback) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.onClickCallback = onClickCallback;
        this.resize();
        this._createStars();
        this.bindEvents();
    },

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
        this._createStars();
    },

    _createStars() {
        this.stars = [];
        for (let i = 0; i < 150; i++) {
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                r: Math.random() * 1.5 + 0.3,
                twinkle: Math.random() * Math.PI * 2,
                speed: 0.01 + Math.random() * 0.03,
            });
        }
    },

    bindEvents() {
        window.addEventListener('resize', () => this.resize());

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.prevX = this.mouse.x;
            this.mouse.prevY = this.mouse.y;
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;

            // 鼠标移动时产生涟漪
            const dx = this.mouse.x - this.mouse.prevX;
            const dy = this.mouse.y - this.mouse.prevY;
            const speed = Math.sqrt(dx * dx + dy * dy);
            if (speed > 3 && Math.random() < 0.4) {
                this.ripples.push({
                    x: this.mouse.x,
                    y: this.mouse.y,
                    radius: 0,
                    maxRadius: 40 + Math.random() * 30,
                    life: 1,
                    color: `hsl(${220 + Math.random() * 60}, 80%, 60%)`,
                });
            }
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.mouse.x = -1000;
            this.mouse.y = -1000;
            this.hoveredParticle = null;
            this.canvas.style.cursor = 'default';
        });

        this.canvas.addEventListener('click', (e) => {
            if (this.hoveredParticle && this.onClickCallback) {
                this.onClickCallback(this.hoveredParticle.symbol);
            }
        });

        // 触摸支持
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.touches[0].clientX - rect.left;
            this.mouse.y = e.touches[0].clientY - rect.top;
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (this.hoveredParticle && this.onClickCallback) {
                this.onClickCallback(this.hoveredParticle.symbol);
            }
        });
    },

    createParticles(tickers) {
        this.particles = [];
        const maxVolume = Math.max(...tickers.map(t => parseFloat(t.quoteVolume)));
        const cx = this.centerX;
        const cy = this.centerY;
        const count = tickers.length;

        tickers.forEach((ticker, index) => {
            const changePercent = parseFloat(ticker.priceChangePercent);
            const volume = parseFloat(ticker.quoteVolume);
            const volumeRatio = Math.log(volume) / Math.log(maxVolume);

            // 多层轨道布局
            const orbitIndex = Math.floor(index / 12); // 每层约12个粒子
            const angleInOrbit = (index % 12) / 12 * Math.PI * 2 + orbitIndex * 0.3;
            const orbitRadius = 80 + orbitIndex * 70 + volumeRatio * 60;
            const depth = 0.5 + (orbitIndex / 6); // 0.5~1.5 深度

            // 大小
            const radius = 16 + volumeRatio * 44;
            const baseRadius = radius;

            // 颜色：涨绿跌红，高亮色
            let color;
            if (changePercent > 3) color = '#00ff88';
            else if (changePercent > 0) color = '#00d4aa';
            else if (changePercent < -3) color = '#ff3355';
            else if (changePercent < 0) color = '#ff6680';
            else color = '#8899bb';

            const baseAsset = ticker.symbol.replace('USDT', '');

            this.particles.push({
                symbol: ticker.symbol,
                baseAsset,
                price: parseFloat(ticker.lastPrice),
                changePercent,
                volume,
                color,
                radius,
                baseRadius,
                // 轨道参数
                orbitIndex,
                orbitRadius,
                baseOrbitRadius: orbitRadius,
                angle: angleInOrbit,
                baseAngle: angleInOrbit,
                depth,
                // 位置
                x: cx + Math.cos(angleInOrbit) * orbitRadius,
                y: cy + Math.sin(angleInOrbit) * orbitRadius * 0.6, // 椭圆
                // 随机微漂移
                driftX: 0,
                driftY: 0,
                driftPhase: Math.random() * Math.PI * 2,
                driftSpeed: 0.003 + Math.random() * 0.008,
                driftAmp: 10 + Math.random() * 30,
                // 呼吸脉冲
                pulse: Math.random() * Math.PI * 2,
                pulseSpeed: 0.02 + Math.abs(changePercent) * 0.005,
                // 轨迹
                trail: [],
                maxTrail: 5,
            });
        });
    },

    start() {
        if (this.animationId) return;
        this.time = 0;
        this._loop();
    },

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    },

    _loop() {
        this.animationId = requestAnimationFrame(() => this._loop());
        this.time += 0.016;
        this._update();
        this._draw();
    },

    _update() {
        const cx = this.centerX;
        const cy = this.centerY;
        const mx = this.mouse.x;
        const my = this.mouse.y;
        const mouseActive = mx > 0 && my > 0;

        // 更新涟漪
        this.ripples = this.ripples.filter(r => {
            r.radius += 1.5;
            r.life -= 0.025;
            return r.life > 0;
        });

        this.hoveredParticle = null;
        let closestDist = Infinity;

        this.particles.forEach(p => {
            // 轨道旋转
            p.angle += 0.0004 + p.changePercent * 0.00002;
            p.baseAngle = p.angle;

            // 轨道半径呼吸
            const orbitBreathe = 1 + Math.sin(this.time * 0.5 + p.orbitIndex) * 0.08;
            p.orbitRadius = p.baseOrbitRadius * orbitBreathe;

            // 漂移
            p.driftPhase += p.driftSpeed;
            p.driftX = Math.sin(p.driftPhase) * p.driftAmp;
            p.driftY = Math.cos(p.driftPhase * 1.3) * p.driftAmp * 0.7;

            // 目标位置
            const targetX = cx + Math.cos(p.angle) * p.orbitRadius + p.driftX;
            const targetY = cy + Math.sin(p.angle) * p.orbitRadius * 0.6 + p.driftY;

            // 鼠标排斥力
            let repelX = 0, repelY = 0;
            if (mouseActive) {
                const dx = targetX - mx;
                const dy = targetY - my;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const repelRadius = 120 * p.depth;

                if (dist < repelRadius && dist > 0) {
                    const force = (1 - dist / repelRadius) * 3;
                    repelX = (dx / dist) * force;
                    repelY = (dy / dist) * force;
                }

                // 检测hover
                if (dist < p.radius * 1.6 && dist < closestDist) {
                    closestDist = dist;
                    this.hoveredParticle = p;
                }
            }

            // 平滑移动
            p.x += (targetX + repelX - p.x) * 0.08;
            p.y += (targetY + repelY - p.y) * 0.08;

            // 呼吸脉冲
            p.pulse += p.pulseSpeed;
            const pulseScale = 1 + Math.sin(p.pulse) * 0.1;
            p.radius = p.baseRadius * pulseScale * (p === this.hoveredParticle ? 1.35 : 1);

            // 更新轨迹
            p.trail.push({ x: p.x, y: p.y, life: 1 });
            if (p.trail.length > p.maxTrail) p.trail.shift();
            p.trail.forEach(t => t.life -= 0.2);
        });

        this.canvas.style.cursor = this.hoveredParticle ? 'pointer' : 'default';
    },

    _draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // 深空背景
        const bg = ctx.createRadialGradient(w * 0.35, h * 0.4, 0, w / 2, h / 2, Math.max(w, h) * 0.8);
        bg.addColorStop(0, '#0d1117');
        bg.addColorStop(0.5, '#090c10');
        bg.addColorStop(1, '#020408');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        // 星空
        this.stars.forEach(s => {
            s.twinkle += s.speed;
            const alpha = 0.3 + Math.sin(s.twinkle) * 0.3 + 0.3;
            ctx.fillStyle = `rgba(180, 200, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        });

        // 中心微光
        const centerGlow = ctx.createRadialGradient(this.centerX, this.centerY, 0, this.centerX, this.centerY, 250);
        centerGlow.addColorStop(0, 'rgba(60, 100, 200, 0.03)');
        centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = centerGlow;
        ctx.fillRect(0, 0, w, h);

        // 粒子间连线（仅相邻轨道间）
        ctx.lineWidth = 0.4;
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const a = this.particles[i];
                const b = this.particles[j];
                if (Math.abs(a.orbitIndex - b.orbitIndex) > 1) continue;
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 130) {
                    const alpha = (1 - dist / 130) * 0.12;
                    ctx.strokeStyle = `rgba(100, 160, 255, ${alpha})`;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                }
            }
        }

        // 轨迹
        this.particles.forEach(p => {
            if (p.trail.length < 2) return;
            for (let i = 1; i < p.trail.length; i++) {
                const t0 = p.trail[i - 1];
                const t1 = p.trail[i];
                const alpha = t1.life * 0.3;
                if (alpha <= 0) continue;
                ctx.strokeStyle = p.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
                if (p.color.startsWith('#')) {
                    const r = parseInt(p.color.slice(1, 3), 16);
                    const g = parseInt(p.color.slice(3, 5), 16);
                    const b = parseInt(p.color.slice(5, 7), 16);
                    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
                }
                ctx.lineWidth = p.radius * 0.15 * t1.life;
                ctx.beginPath();
                ctx.moveTo(t0.x, t0.y);
                ctx.lineTo(t1.x, t1.y);
                ctx.stroke();
            }
        });

        // 绘制粒子
        this.particles.sort((a, b) => {
            if (a === this.hoveredParticle) return 1;
            if (b === this.hoveredParticle) return -1;
            return 0;
        });

        this.particles.forEach(p => {
            const isHovered = p === this.hoveredParticle;

            // 外层大光晕
            const outerGlow = ctx.createRadialGradient(p.x, p.y, p.radius * 0.2, p.x, p.y, p.radius * 2.2);
            const rgb = this._hexToRgb(p.color);
            outerGlow.addColorStop(0, `rgba(${rgb}, 0.25)`);
            outerGlow.addColorStop(0.5, `rgba(${rgb}, 0.08)`);
            outerGlow.addColorStop(1, `rgba(${rgb}, 0)`);
            ctx.fillStyle = outerGlow;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius * 2.2, 0, Math.PI * 2);
            ctx.fill();

            // 内层光晕
            const innerGlow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 1.3);
            innerGlow.addColorStop(0, `rgba(255, 255, 255, 0.15)`);
            innerGlow.addColorStop(0.3, `rgba(${rgb}, 0.5)`);
            innerGlow.addColorStop(0.7, `rgba(${rgb}, 0.2)`);
            innerGlow.addColorStop(1, `rgba(${rgb}, 0)`);
            ctx.fillStyle = innerGlow;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius * 1.3, 0, Math.PI * 2);
            ctx.fill();

            // 主体 - 半透明玻璃质感
            const bodyGrad = ctx.createRadialGradient(
                p.x - p.radius * 0.25, p.y - p.radius * 0.25, p.radius * 0.05,
                p.x, p.y, p.radius
            );
            bodyGrad.addColorStop(0, `rgba(255, 255, 255, 0.85)`);
            bodyGrad.addColorStop(0.4, `rgba(${rgb}, 0.75)`);
            bodyGrad.addColorStop(0.8, `rgba(${rgb}, 0.35)`);
            bodyGrad.addColorStop(1, `rgba(${rgb}, 0.1)`);
            ctx.fillStyle = bodyGrad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();

            // 玻璃高光
            const highlightGrad = ctx.createRadialGradient(
                p.x - p.radius * 0.3, p.y - p.radius * 0.4, 0,
                p.x, p.y, p.radius
            );
            highlightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
            highlightGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
            highlightGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = highlightGrad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius * 0.85, 0, Math.PI * 2);
            ctx.fill();

            // hover边框
            if (isHovered) {
                ctx.strokeStyle = `rgba(${rgb}, 0.9)`;
                ctx.lineWidth = 2.5;
                ctx.shadowColor = `rgba(${rgb}, 0.7)`;
                ctx.shadowBlur = 20;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius + 3, 0, Math.PI * 2);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // 文字
            const fontSize = Math.max(10, p.radius * 0.52);
            ctx.fillStyle = '#ffffff';
            ctx.font = `600 ${fontSize}px "Segoe UI", "PingFang SC", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 3;
            ctx.fillText(p.baseAsset, p.x, p.y);
            ctx.shadowBlur = 0;

            // 悬停信息卡片
            if (isHovered) {
                const changeStr = (p.changePercent >= 0 ? '+' : '') + p.changePercent.toFixed(2) + '%';
                const cardW = 120;
                const cardH = 44;
                const cardY = p.y - p.radius - cardH - 5;

                // 卡片背景
                ctx.fillStyle = 'rgba(13, 17, 23, 0.92)';
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 1;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 12;
                ctx.beginPath();
                this._roundRect(ctx, p.x - cardW / 2, cardY, cardW, cardH, 10);
                ctx.fill();
                ctx.stroke();
                ctx.shadowBlur = 0;

                // 连接线
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.moveTo(p.x, cardY + cardH);
                ctx.lineTo(p.x, p.y - p.radius);
                ctx.stroke();
                ctx.setLineDash([]);

                // 名称
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 13px "Segoe UI", "PingFang SC", sans-serif';
                ctx.fillText(p.baseAsset + '/USDT', p.x, cardY + 15);

                // 涨跌幅
                ctx.fillStyle = p.color;
                ctx.font = 'bold 12px "Segoe UI", sans-serif';
                ctx.fillText(changeStr, p.x, cardY + 33);
            }
        });

        // 鼠标涟漪
        this.ripples.forEach(r => {
            const alpha = r.life * 0.4;
            ctx.strokeStyle = r.color.replace(')', `, ${alpha})`).replace('hsl', 'hsla');
            ctx.lineWidth = 1.5 * r.life;
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            ctx.stroke();
        });

        // 中心标题装饰环
        const ringAlpha = 0.06 + Math.sin(this.time * 0.7) * 0.02;
        ctx.strokeStyle = `rgba(100, 160, 220, ${ringAlpha})`;
        ctx.lineWidth = 0.5;
        ctx.setLineDash([2, 20]);
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, 280, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    },

    _hexToRgb(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `${r}, ${g}, ${b}`;
    },

    _roundRect(ctx, x, y, w, h, r) {
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
    },
};
