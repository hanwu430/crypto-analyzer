/**
 * 应用主控模块
 * 初始化应用，管理页面切换和全局状态
 */

const App = {
    // 当前状态
    currentSymbol: null,
    currentInterval: '4h',
    tickers: [],
    analysisResult: null,

    /**
     * 应用入口
     */
    async init() {
        this._bindNavigation();

        // 先检测可用API端点
        try {
            await BinanceAPI.init();
        } catch (e) {
            console.warn('API端点检测失败，使用默认端点');
        }

        await this._loadParticlePage();
    },

    /**
     * 绑定导航和UI事件
     */
    _bindNavigation() {
        // 返回按钮
        document.getElementById('btn-back').addEventListener('click', () => this._goBack());

        // 时间周期切换
        document.querySelectorAll('.tf-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const interval = btn.dataset.interval;
                if (interval !== this.currentInterval) {
                    this.currentInterval = interval;
                    if (this.currentSymbol) {
                        this._loadAnalysis(this.currentSymbol, interval);
                    }
                }
            });
        });

        // 刷新按钮
        document.getElementById('btn-refresh').addEventListener('click', () => {
            if (this.currentSymbol) {
                this._loadAnalysis(this.currentSymbol, this.currentInterval);
            }
        });

        // 搜索框
        const searchInput = document.getElementById('search-input');
        const searchResults = document.getElementById('search-results');

        searchInput.addEventListener('input', () => {
            const query = searchInput.value.trim().toUpperCase();
            if (query.length < 1) {
                searchResults.classList.add('hidden');
                return;
            }
            const matches = this.tickers
                .filter(t => {
                    const base = t.symbol.replace('USDT', '');
                    return base.includes(query);
                })
                .slice(0, 8);

            if (matches.length > 0) {
                searchResults.innerHTML = matches.map(m => {
                    const base = m.symbol.replace('USDT', '');
                    const change = parseFloat(m.priceChangePercent);
                    const changeClass = change >= 0 ? 'positive' : 'negative';
                    const changeStr = (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
                    return `<div class="search-item" data-symbol="${m.symbol}">
                        <span class="search-symbol">${base}</span>
                        <span class="search-change ${changeClass}">${changeStr}</span>
                    </div>`;
                }).join('');
                searchResults.classList.remove('hidden');

                // 点击搜索结果
                searchResults.querySelectorAll('.search-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const symbol = item.dataset.symbol;
                        searchResults.classList.add('hidden');
                        searchInput.value = '';
                        this._openAnalysis(symbol);
                    });
                });
            } else {
                searchResults.classList.add('hidden');
            }
        });

        searchInput.addEventListener('blur', () => {
            setTimeout(() => searchResults.classList.add('hidden'), 200);
        });

        // 响应式图表resize
        window.addEventListener('resize', () => {
            if (this.currentSymbol) {
                ChartManager.resize();
            }
        });
    },

    /**
     * 加载粒子首页
     */
    async _loadParticlePage() {
        const loading = document.getElementById('particle-loading');
        loading.classList.remove('hidden');

        try {
            // 获取24h行情
            this.tickers = await BinanceAPI.get24hrTickers();

            // 初始化粒子系统
            const canvas = document.getElementById('particle-canvas');
            ParticleSystem.init(canvas, (symbol) => this._openAnalysis(symbol));
            ParticleSystem.createParticles(this.tickers);
            ParticleSystem.start();

            loading.classList.add('hidden');
        } catch (err) {
            console.error('加载首页数据失败:', err);
            let msg = '❌ 数据加载失败，可能原因：<br><br>';
            msg += '1️⃣ 网络连接问题 — 请检查网络<br>';
            msg += '2️⃣ 币安API不可达 — 可能需要科学上网<br>';
            msg += '3️⃣ 浏览器拦截 — 请检查是否开启了广告拦截插件<br><br>';
            msg += `<small style="color:#888;">错误详情: ${err.message}</small><br>`;
            msg += '<small style="color:#888;">当前API: ' + BinanceAPI.baseUrl + '</small>';
            loading.innerHTML = `<div style="max-width:450px;text-align:left;line-height:1.8;color:#ff6b6b;">${msg}</div>`;
        }
    },

    /**
     * 打开分析页
     */
    async _openAnalysis(symbol) {
        this.currentSymbol = symbol;

        // 停止粒子动画
        ParticleSystem.stop();

        // 切换页面
        document.getElementById('particle-page').classList.remove('active');
        document.getElementById('analysis-page').classList.add('active');

        // 初始化图表
        ChartManager.init();

        // 加载数据
        await this._loadAnalysis(symbol, this.currentInterval);
    },

    /**
     * 加载分析数据
     */
    async _loadAnalysis(symbol, interval) {
        const loading = document.getElementById('analysis-loading');
        loading.classList.remove('hidden');

        try {
            // 并行获取数据（技术指标 + 市场情绪）
            const [klines, ticker, lsrData, fngData, newsData] = await Promise.all([
                BinanceAPI.getKlines(symbol, interval, 200),
                BinanceAPI.get24hrTicker(symbol),
                BinanceAPI.getLongShortRatio(symbol),
                BinanceAPI.getFearGreedIndex(),
                BinanceAPI.getCryptoNews(),
            ]);

            // 计算技术指标
            const indicators = Indicators.calculateAll(klines);

            // 综合分析（含新闻情绪）
            const analysis = AnalysisEngine.analyze(indicators, lsrData, fngData, newsData);
            this.analysisResult = analysis;

            // 更新UI
            this._updateAnalysisUI(ticker, analysis);

            // 更新图表
            ChartManager.updateData(klines, indicators);
            ChartManager.resize();

            loading.classList.add('hidden');
        } catch (err) {
            console.error('加载分析数据失败:', err);
            loading.classList.add('hidden');
            this._showToast('❌ 数据加载失败: ' + err.message);
        }
    },

    /**
     * 更新分析页UI
     */
    _updateAnalysisUI(ticker, analysis) {
        const baseAsset = this.currentSymbol.replace('USDT', '');

        // 头部信息
        document.getElementById('analysis-symbol').textContent = `${baseAsset}/USDT`;
        const priceEl = document.getElementById('analysis-price');
        const changeEl = document.getElementById('analysis-change');

        if (ticker) {
            const price = ticker.price;
            // 动态小数位
            const decimals = price >= 100 ? 2 : price >= 1 ? 4 : price >= 0.01 ? 6 : 8;
            priceEl.textContent = '$' + price.toFixed(decimals);

            const changeStr = (ticker.changePercent >= 0 ? '+' : '') + ticker.changePercent.toFixed(2) + '%';
            changeEl.textContent = changeStr;
            changeEl.className = 'change ' + (ticker.changePercent >= 0 ? 'positive' : 'negative');
        }

        // 指标面板
        const panel = document.getElementById('indicators-panel');
        panel.innerHTML = analysis.details.map(d => {
            const barFilled = Math.max(0, Math.min(10, d.barValue || 5));
            let signalClass = 'signal-neutral';
            let signalEmoji = '⚪';
            if (d.signal === 'bullish') { signalClass = 'signal-bullish'; signalEmoji = '🟢'; }
            if (d.signal === 'bearish') { signalClass = 'signal-bearish'; signalEmoji = '🔴'; }

            return `<div class="indicator-item">
                <div class="indicator-header">
                    <span class="indicator-name">${signalEmoji} ${d.name}</span>
                    <span class="indicator-value ${signalClass}">${d.value}</span>
                </div>
                <div class="indicator-bar">
                    <div class="indicator-bar-fill ${signalClass}" style="width:${(barFilled/10)*100}%"></div>
                </div>
                <div class="indicator-desc">${d.description}</div>
            </div>`;
        }).join('');

        // 建议面板
        const rec = analysis.recommendation;
        const recPanel = document.getElementById('recommendation-panel');
        recPanel.innerHTML = `
            <div class="rec-score ${rec.verdictClass}">📈 综合评分: ${rec.score > 0 ? '+' : ''}${rec.score}/12</div>
            <div class="rec-verdict ${rec.verdictClass}">${rec.verdict}</div>
            <div class="rec-advice">${rec.advice}</div>
            <div class="rec-disclaimer">⚠️ 免责声明：以上分析仅基于技术指标与市场情绪，不构成投资建议。加密货币市场波动剧烈，请谨慎决策。</div>
        `;

        // 新闻情绪面板
        this._updateSentimentPanel(analysis);
    },

    /**
     * 更新市场情绪面板（恐慌指数 + 新闻）
     */
    _updateSentimentPanel(analysis) {
        const fng = analysis.fearGreed;
        const newsSentiment = analysis.newsSentiment;

        let html = '<div class="sentiment-section"><h3>📰 市场情绪</h3>';

        // 恐慌贪婪指数仪表
        if (fng) {
            const fngPct = fng.current;
            let fngColor, fngEmoji;
            if (fngPct <= 25) { fngColor = '#00d4aa'; fngEmoji = '😱'; }
            else if (fngPct <= 45) { fngColor = '#8ed4a0'; fngEmoji = '😟'; }
            else if (fngPct <= 55) { fngColor = '#888'; fngEmoji = '😐'; }
            else if (fngPct <= 75) { fngColor = '#f39c12'; fngEmoji = '😊'; }
            else { fngColor = '#ff4466'; fngEmoji = '🤩'; }

            html += `
            <div class="fng-gauge">
                <div class="fng-header">
                    <span>${fngEmoji} 恐慌贪婪指数</span>
                    <span style="color:${fngColor};font-weight:700;">${fngPct} — ${fng.classification}</span>
                </div>
                <div class="fng-bar">
                    <div class="fng-fill" style="width:${fngPct}%;background:${fngColor};"></div>
                </div>
                <div class="fng-labels">
                    <span>0 极度恐慌</span><span>50 中性</span><span>100 极度贪婪</span>
                </div>
            </div>`;
        }

        // 新闻头条
        if (newsSentiment && newsSentiment.headlines && newsSentiment.headlines.length > 0) {
            html += '<div class="news-list">';
            newsSentiment.headlines.forEach(h => {
                const icon = h.sentiment === 'positive' ? '🟢' : h.sentiment === 'negative' ? '🔴' : '⚪';
                html += `
                <a class="news-item" href="${h.url}" target="_blank" rel="noopener">
                    <span class="news-icon">${icon}</span>
                    <span class="news-title">${h.title}</span>
                    <span class="news-source">${h.source}</span>
                </a>`;
            });
            html += '</div>';
        }

        html += '</div>';

        // 追加到建议面板后面
        const recPanel = document.getElementById('recommendation-panel');
        recPanel.innerHTML += html;
    },
    },

    /**
     * 返回粒子首页
     */
    _goBack() {
        this.currentSymbol = null;
        this.analysisResult = null;

        // 销毁图表
        ChartManager.destroy();

        // 重置时间周期按钮
        document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.tf-btn[data-interval="4h"]').classList.add('active');
        this.currentInterval = '4h';

        // 切换页面
        document.getElementById('analysis-page').classList.remove('active');
        document.getElementById('particle-page').classList.add('active');

        // 重启动画
        ParticleSystem.resize();
        ParticleSystem.start();
    },

    /**
     * 显示Toast提示
     */
    _showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.remove('hidden');
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, 3000);
    },
};

// 启动应用
document.addEventListener('DOMContentLoaded', () => App.init());
