/**
 * 应用主控模块
 */
const App = {
    currentSymbol: null,
    currentInterval: '4h',
    coins: [],

    async init() {
        this._bindNavigation();
        try { await BinanceAPI.init(); } catch (e) {}
        await this._loadDashboard();
    },

    _bindNavigation() {
        document.getElementById('btn-back').addEventListener('click', () => this._goBack());

        document.querySelectorAll('.tf-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const interval = btn.dataset.interval;
                if (interval !== this.currentInterval) {
                    this.currentInterval = interval;
                    if (this.currentSymbol) this._loadAnalysis(this.currentSymbol, interval);
                }
            });
        });

        document.getElementById('btn-refresh').addEventListener('click', () => {
            if (this.currentSymbol) this._loadAnalysis(this.currentSymbol, this.currentInterval);
        });

        // 搜索过滤
        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', () => {
            Dashboard.filter(searchInput.value.trim());
        });

        window.addEventListener('resize', () => {
            if (this.currentSymbol) ChartManager.resize();
        });
    },

    /**
     * 加载首页看板
     */
    async _loadDashboard() {
        try {
            const [tickers, mcapData, fngData, newsData] = await Promise.all([
                BinanceAPI.get24hrTickers(),
                BinanceAPI.getMarketCapData(),
                BinanceAPI.getFearGreedIndex(),
                BinanceAPI.getCryptoNews(),
            ]);

            // 合并 Binance + CoinGecko 数据
            const mcapMap = {};
            if (mcapData) {
                mcapData.forEach(c => { mcapMap[c.symbol] = c; });
            }

            this.coins = tickers.map(t => {
                const base = t.symbol.replace('USDT', '');
                const cg = mcapMap[base] || {};
                return {
                    symbol: t.symbol,
                    name: cg.name || base,
                    price: parseFloat(t.lastPrice),
                    change24h: cg.change24h ?? parseFloat(t.priceChangePercent),
                    marketCap: cg.marketCap || null,
                    marketCapRank: cg.marketCapRank || null,
                    volume24h: parseFloat(t.quoteVolume),
                };
            });

            // 渲染看板
            Dashboard.render(this.coins, fngData, newsData);

        } catch (err) {
            console.error('看板加载失败:', err);
            document.getElementById('crypto-tbody').innerHTML =
                `<tr><td colspan="6" class="loading-row" style="color:#ff4466;">❌ 加载失败: ${err.message}</td></tr>`;
        }
    },

    _openAnalysis(symbol) {
        this.currentSymbol = symbol;
        document.getElementById('dashboard-page').classList.remove('active');
        document.getElementById('analysis-page').classList.add('active');
        ChartManager.init();
        this._loadAnalysis(symbol, this.currentInterval);
    },

    async _loadAnalysis(symbol, interval) {
        try {
            const [klines, ticker, lsrData, fngData, newsData] = await Promise.all([
                BinanceAPI.getKlines(symbol, interval, 200),
                BinanceAPI.get24hrTicker(symbol),
                BinanceAPI.getLongShortRatio(symbol),
                BinanceAPI.getFearGreedIndex(),
                BinanceAPI.getCryptoNews(),
            ]);

            const indicators = Indicators.calculateAll(klines);
            const analysis = AnalysisEngine.analyze(indicators, lsrData, fngData, newsData);

            this._updateAnalysisUI(ticker, analysis);
            ChartManager.updateData(klines, indicators);
            ChartManager.resize();
        } catch (err) {
            console.error('分析加载失败:', err);
            this._showToast('❌ 数据加载失败: ' + err.message);
        }
    },

    _updateAnalysisUI(ticker, analysis) {
        const baseAsset = this.currentSymbol.replace('USDT', '');
        document.getElementById('analysis-symbol').textContent = `${baseAsset}/USDT`;
        const priceEl = document.getElementById('analysis-price');
        const changeEl = document.getElementById('analysis-change');

        if (ticker) {
            const decimals = ticker.price >= 100 ? 2 : ticker.price >= 1 ? 4 : ticker.price >= 0.01 ? 6 : 8;
            priceEl.textContent = '$' + ticker.price.toFixed(decimals);
            const changeStr = (ticker.changePercent >= 0 ? '+' : '') + ticker.changePercent.toFixed(2) + '%';
            changeEl.textContent = changeStr;
            changeEl.className = 'change ' + (ticker.changePercent >= 0 ? 'positive' : 'negative');
        }

        // 指标面板
        document.getElementById('indicators-panel').innerHTML = analysis.details.map(d => {
            const barFilled = Math.max(0, Math.min(10, d.barValue || 5));
            let signalClass = 'signal-neutral', signalEmoji = '⚪';
            if (d.signal === 'bullish') { signalClass = 'signal-bullish'; signalEmoji = '🟢'; }
            if (d.signal === 'bearish') { signalClass = 'signal-bearish'; signalEmoji = '🔴'; }
            return `<div class="indicator-item">
                <div class="indicator-header">
                    <span class="indicator-name">${signalEmoji} ${d.name}</span>
                    <span class="indicator-value ${signalClass}">${d.value}</span>
                </div>
                <div class="indicator-bar"><div class="indicator-bar-fill ${signalClass}" style="width:${(barFilled/10)*100}%"></div></div>
                <div class="indicator-desc">${d.description}</div>
            </div>`;
        }).join('');

        // 建议面板
        const rec = analysis.recommendation;
        document.getElementById('recommendation-panel').innerHTML = `
            <div class="rec-score ${rec.verdictClass}">📈 综合评分: ${rec.score > 0 ? '+' : ''}${rec.score}/12</div>
            <div class="rec-verdict ${rec.verdictClass}">${rec.verdict}</div>
            <div class="rec-advice">${rec.advice}</div>
            <div class="rec-disclaimer">⚠️ 免责声明：以上分析仅基于技术指标与市场情绪，不构成投资建议。</div>
        `;

        this._updateSentimentPanel(analysis);
    },

    _updateSentimentPanel(analysis) {
        const fng = analysis.fearGreed;
        const ns = analysis.newsSentiment;
        let html = '<div class="sentiment-section"><h3>📰 市场情绪</h3>';

        if (fng) {
            let fngColor;
            if (fng.current <= 25) fngColor = '#00d4aa';
            else if (fng.current <= 45) fngColor = '#8ed4a0';
            else if (fng.current <= 55) fngColor = '#888';
            else if (fng.current <= 75) fngColor = '#f39c12';
            else fngColor = '#ff4466';

            html += `<div class="fng-gauge">
                <div class="fng-header"><span>😱 恐慌贪婪指数</span><span style="color:${fngColor};font-weight:700;">${fng.current} — ${fng.classification}</span></div>
                <div class="fng-bar"><div class="fng-fill" style="width:${fng.current}%;background:${fngColor};"></div></div>
                <div class="fng-labels"><span>0 极度恐慌</span><span>50 中性</span><span>100 极度贪婪</span></div>
            </div>`;
        }

        if (ns?.headlines?.length) {
            html += '<div class="news-list">';
            ns.headlines.forEach(h => {
                const icon = h.sentiment === 'positive' ? '🟢' : h.sentiment === 'negative' ? '🔴' : '⚪';
                const catTag = h.category === 'macro' ? '<span class="news-cat macro">宏观</span>' : '';
                html += `<a class="news-item" href="${h.url}" target="_blank" rel="noopener">
                    <span class="news-icon">${icon}</span>
                    <span class="news-title">${h.title} ${catTag}</span>
                    <span class="news-source">${h.source}</span>
                </a>`;
            });
            html += '</div>';
        }
        html += '</div>';
        document.getElementById('recommendation-panel').innerHTML += html;
    },

    _goBack() {
        this.currentSymbol = null;
        ChartManager.destroy();
        document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.tf-btn[data-interval="4h"]')?.classList.add('active');
        this.currentInterval = '4h';
        document.getElementById('analysis-page').classList.remove('active');
        document.getElementById('dashboard-page').classList.add('active');
    },

    _showToast(msg) {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.classList.remove('hidden');
        toast.classList.add('show');
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.classList.add('hidden'), 300); }, 3000);
    },
};

document.addEventListener('DOMContentLoaded', () => App.init());
