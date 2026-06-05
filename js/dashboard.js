/**
 * 首页看板 - 排行榜表格 + 新闻横幅
 */
const Dashboard = {
    coins: [],
    sortBy: 'volume', // 'volume' | 'mcap'
    currentSymbol: null,

    /**
     * 渲染整个看板
     */
    render(coins, fngData, newsData) {
        this.coins = coins;
        this._updateMarketBar(coins, fngData);
        this._updateNewsTicker(newsData);
        this._renderTable();
        this._bindSortButtons();
    },

    /**
     * 市场概览条
     */
    _updateMarketBar(coins, fngData) {
        const btc = coins.find(c => c.symbol === 'BTCUSDT' || c.symbol === 'BTC');
        const totalMcap = coins.reduce((s, c) => s + (c.marketCap || 0), 0);

        document.getElementById('mbar-fng').textContent = fngData
            ? `${fngData.current} (${fngData.classification})`
            : '--';
        document.getElementById('mbar-btc').textContent = btc?.price
            ? '$' + this._fmtPrice(btc.price)
            : '--';
        document.getElementById('mbar-btc-change').textContent = btc?.change24h
            ? (btc.change24h > 0 ? '+' : '') + btc.change24h.toFixed(2) + '%'
            : '--';
        document.getElementById('mbar-btc-change').className = 'market-value ' +
            (btc?.change24h >= 0 ? 'positive' : 'negative');
        document.getElementById('mbar-total-mcap').textContent = totalMcap > 0
            ? '$' + this._fmtMcap(totalMcap)
            : '--';

        if (btc?.marketCap && totalMcap > 0) {
            const dom = (btc.marketCap / totalMcap * 100).toFixed(1);
            document.getElementById('mbar-btc-dom').textContent = dom + '%';
        }
    },

    /**
     * 新闻横幅
     */
    _updateNewsTicker(newsData) {
        const content = document.getElementById('news-ticker-content');
        if (!newsData || newsData.length === 0) {
            content.textContent = '暂无新闻数据';
            return;
        }
        const titles = newsData.slice(0, 8).map(n => {
            const t = n.title.length > 50 ? n.title.slice(0, 50) + '...' : n.title;
            const cat = n.category === 'macro' ? '[宏观] ' : '';
            return cat + t;
        });
        content.textContent = titles.join('  |  ');
    },

    /**
     * 渲染排名表格
     */
    _renderTable() {
        const sorted = [...this.coins].sort((a, b) => {
            if (this.sortBy === 'volume') {
                return (b.volume24h || 0) - (a.volume24h || 0);
            }
            return (b.marketCap || 0) - (a.marketCap || 0);
        });

        const tbody = document.getElementById('crypto-tbody');
        document.getElementById('table-count').textContent = `共 ${sorted.length} 个币种`;

        tbody.innerHTML = sorted.map((c, i) => {
            const symbol = c.symbol + (c.symbol.endsWith('USDT') ? '' : 'USDT');
            const baseAsset = c.symbol.replace('USDT', '');
            const change = c.change24h || 0;
            const changeClass = change >= 0 ? 'positive' : 'negative';
            const changeStr = change ? ((change > 0 ? '+' : '') + change.toFixed(2) + '%') : '--';
            const price = c.price ? '$' + this._fmtPrice(c.price) : '--';
            const mcap = c.marketCap ? '$' + this._fmtMcap(c.marketCap) : '--';
            const volume = c.volume24h ? '$' + this._fmtMcap(c.volume24h) : '--';

            return `
            <tr class="crypto-row" data-symbol="${symbol}">
                <td class="col-rank">${i + 1}</td>
                <td class="col-name">
                    <span class="coin-symbol">${baseAsset}</span>
                    ${c.name ? `<span class="coin-name">${c.name}</span>` : ''}
                </td>
                <td class="col-price">${price}</td>
                <td class="col-change ${changeClass}">${changeStr}</td>
                <td class="col-mcap">${mcap}</td>
                <td class="col-volume">${volume}</td>
            </tr>`;
        }).join('');

        // 绑定点击事件
        tbody.querySelectorAll('.crypto-row').forEach(row => {
            row.addEventListener('click', () => {
                const symbol = row.dataset.symbol;
                if (typeof App !== 'undefined' && App._openAnalysis) {
                    App._openAnalysis(symbol);
                }
            });
        });
    },

    /**
     * 排序切换
     */
    _bindSortButtons() {
        document.querySelectorAll('.sort-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.sortBy = btn.dataset.sort;
                this._renderTable();
            });
        });
    },

    /**
     * 搜索过滤
     */
    filter(query) {
        if (!query) {
            document.querySelectorAll('.crypto-row').forEach(r => r.style.display = '');
            return;
        }
        const upper = query.toUpperCase();
        document.querySelectorAll('.crypto-row').forEach(r => {
            const symbol = r.dataset.symbol || '';
            r.style.display = symbol.includes(upper) ? '' : 'none';
        });
    },

    _fmtPrice(p) {
        if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 2 });
        if (p >= 1) return p.toLocaleString('en-US', { maximumFractionDigits: 4 });
        return p.toLocaleString('en-US', { maximumFractionDigits: 6 });
    },

    _fmtMcap(v) {
        if (v >= 1e12) return (v / 1e12).toFixed(2) + 'T';
        if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
        if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
        return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
    },
};
