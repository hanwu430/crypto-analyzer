/**
 * 粒子系统
 * Canvas渲染加密货币粒子，带浮动动画和交互
 */

const ParticleSystem = {
    canvas: null,
    ctx: null,
    particles: [],
    animationId: null,
    mouse: { x: -1000, y: -1000 },
    hoveredParticle: null,
    onClickCallback: null,

    /**
     * 初始化粒子系统
     */
    init(canvas, onClickCallback) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.onClickCallback = onClickCallback;
        this.resize();
        this.bindEvents();
    },

    /**
     * 响应窗口大小变化
     */
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    },

    /**
     * 绑定事件
     */
    bindEvents() {
        window.addEventListener('resize', () => this.resize());

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
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

    /**
     * 根据24h行情数据创建粒子
     * @param {Object[]} tickers - 币安24h行情数据
     */
    createParticles(tickers) {
        this.particles = [];
        const maxVolume = Math.max(...tickers.map(t => parseFloat(t.quoteVolume)));

        tickers.forEach((ticker, index) => {
            const changePercent = parseFloat(ticker.priceChangePercent);
            const volume = parseFloat(ticker.quoteVolume);

            // 粒子大小与交易量成正比（对数尺度）
            const volumeRatio = Math.log(volume) / Math.log(maxVolume);
            const radius = 18 + volumeRatio * 40;

            // 颜色
            let color;
            if (changePercent > 2) color = '#00d4aa';
            else if (changePercent > 0) color = '#26a69a';
            else if (changePercent < -2) color = '#ff4466';
            else if (changePercent < 0) color = '#ef5350';
            else color = '#888888';

            // 提取币种简称
            const baseAsset = ticker.symbol.replace('USDT', '');

            this.particles.push({
                symbol: ticker.symbol,
                baseAsset,                          // 如 BTC
                price: parseFloat(ticker.lastPrice),
                changePercent,
                volume,
                color,
                radius,
                baseRadius: radius,
                // 随机初始位置
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                // 随机速度
                vx: (Math.random() - 0.5) * 0.8,
                vy: (Math.random() - 0.5) * 0.8,
                // 用于布朗运动的随机相位
                phase: Math.random() * Math.PI * 2,
                phaseSpeed: 0.005 + Math.random() * 0.015,
                amplitude: 0.3 + Math.random() * 0.7,
            });
        });
    },

    /**
     * 开始渲染循环
     */
    start() {
        if (this.animationId) return;
        this._loop();
    },

    /**
     * 停止渲染
     */
    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    },

    /**
     * 渲染循环
     */
    _loop() {
        this.animationId = requestAnimationFrame(() => this._loop());
        this._update();
        this._draw();
    },

    /**
     * 更新粒子位置
     */
    _update() {
        const w = this.canvas.width;
        const h = this.canvas.height;

        this.hoveredParticle = null;
        let minDist = Infinity;
        const hoverThreshold = 50;

        this.particles.forEach(p => {
            // 布朗运动
            p.phase += p.phaseSpeed;
            p.vx += Math.sin(p.phase) * p.amplitude * 0.05;
            p.vy += Math.cos(p.phase + 1) * p.amplitude * 0.05;

            // 阻尼
            p.vx *= 0.995;
            p.vy *= 0.995;

            // 微弱引力趋向中心
            const cx = w / 2;
            const cy = h / 2;
            p.vx += (cx - p.x) * 0.00002;
            p.vy += (cy - p.y) * 0.00002;

            // 更新位置
            p.x += p.vx;
            p.y += p.vy;

            // 边界弹跳
            if (p.x < p.radius) { p.x = p.radius; p.vx *= -0.5; }
            if (p.x > w - p.radius) { p.x = w - p.radius; p.vx *= -0.5; }
            if (p.y < p.radius) { p.y = p.radius; p.vy *= -0.5; }
            if (p.y > h - p.radius) { p.y = h - p.radius; p.vy *= -0.5; }

            // 鼠标交互 - 放大和排斥
            const dx = p.x - this.mouse.x;
            const dy = p.y - this.mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < hoverThreshold) {
                // 鼠标附近的粒子放大
                const factor = 1 + (1 - dist / hoverThreshold) * 0.6;
                p.radius = p.baseRadius * factor;

                // 微弱排斥
                if (dist > 0) {
                    const force = (1 - dist / hoverThreshold) * 0.5;
                    p.vx += (dx / dist) * force;
                    p.vy += (dy / dist) * force;
                }

                // 记录最近的粒子
                if (dist < minDist && dist < p.baseRadius * 1.8) {
                    minDist = dist;
                    this.hoveredParticle = p;
                }
            } else {
                // 平滑恢复
                p.radius += (p.baseRadius - p.radius) * 0.1;
            }
        });

        // 更新鼠标样式
        this.canvas.style.cursor = this.hoveredParticle ? 'pointer' : 'default';
    },

    /**
     * 绘制
     */
    _draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // 清除画布
        ctx.clearRect(0, 0, w, h);

        // 背景渐变
        const bg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
        bg.addColorStop(0, '#1a1a2e');
        bg.addColorStop(1, '#0a0a15');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        // 绘制粒子间连线
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 0.5;
        const maxLineDist = 150;

        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const a = this.particles[i];
                const b = this.particles[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < maxLineDist) {
                    const alpha = (1 - dist / maxLineDist) * 0.15;
                    ctx.strokeStyle = `rgba(100, 140, 255, ${alpha})`;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                }
            }
        }

        // 绘制粒子
        this.particles.forEach(p => {
            const isHovered = p === this.hoveredParticle;

            // 光晕效果
            const glowRadius = p.radius * 1.8;
            const glow = ctx.createRadialGradient(p.x, p.y, p.radius * 0.3, p.x, p.y, glowRadius);
            const hexToRgb = (hex) => {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                return `${r}, ${g}, ${b}`;
            };
            glow.addColorStop(0, `rgba(${hexToRgb(p.color)}, 0.3)`);
            glow.addColorStop(1, `rgba(${hexToRgb(p.color)}, 0)`);
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
            ctx.fill();

            // 主体圆形
            const gradient = ctx.createRadialGradient(p.x - p.radius * 0.3, p.y - p.radius * 0.3, p.radius * 0.1, p.x, p.y, p.radius);
            gradient.addColorStop(0, `rgba(${hexToRgb(p.color)}, 0.9)`);
            gradient.addColorStop(0.7, `rgba(${hexToRgb(p.color)}, 0.6)`);
            gradient.addColorStop(1, `rgba(${hexToRgb(p.color)}, 0.2)`);

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();

            // 边框
            if (isHovered) {
                ctx.strokeStyle = `rgba(${hexToRgb(p.color)}, 0.9)`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius + 2, 0, Math.PI * 2);
                ctx.stroke();
            }

            // 币种文字
            const fontSize = Math.max(10, p.radius * 0.55);
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${fontSize}px "Segoe UI", "PingFang SC", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.baseAsset, p.x, p.y);

            // 悬停时显示详细信息
            if (isHovered) {
                const infoY = p.y - p.radius - 25;
                const changeStr = (p.changePercent >= 0 ? '+' : '') + p.changePercent.toFixed(2) + '%';
                const changeColor = p.changePercent >= 0 ? '#00d4aa' : '#ff4466';

                // 背景框
                const infoWidth = Math.max(120, ctx.measureText(p.baseAsset + '  ' + changeStr).width + 20);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
                ctx.strokeStyle = `rgba(${hexToRgb(p.color)}, 0.6)`;
                ctx.lineWidth = 1;
                const boxH = 40;
                const boxY = infoY - boxH / 2;
                ctx.beginPath();
                ctx.roundRect(p.x - infoWidth / 2, boxY, infoWidth, boxH, 8);
                ctx.fill();
                ctx.stroke();

                // 文字
                ctx.fillStyle = '#ffffff';
                ctx.font = `bold 13px "Segoe UI", "PingFang SC", sans-serif`;
                ctx.fillText(p.baseAsset, p.x, boxY + 13);

                ctx.fillStyle = changeColor;
                ctx.font = `bold 12px "Segoe UI", "PingFang SC", sans-serif`;
                ctx.fillText(changeStr, p.x, boxY + 30);
            }
        });
    },
};
