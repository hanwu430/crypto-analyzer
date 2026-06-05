/**
 * 币安公开API数据层
 * 无需API Key，所有接口均为公开数据
 * 自动尝试多个API端点，适应不同网络环境
 */

const BinanceAPI = {
    // 多个备用API端点（部分环境可能墙了某些域名）
    BASE_URLS: [
        'https://api.binance.com',
        'https://api1.binance.com',
        'https://api2.binance.com',
        'https://api3.binance.com',
        'https://api.binance.us',
    ],
    FUTURES_URLS: [
        'https://fapi.binance.com',
        'https://fapi.binance.us',
    ],

    _activeBase: 0,
    _activeFutures: 0,
    _cache: {},

    /**
     * 初始化：快速检测API端点（5秒超时）
     */
    async init() {
        const results = await Promise.allSettled([
            this._testEndpoint(this.BASE_URLS, '/api/v3/ping'),
            this._testEndpoint(this.FUTURES_URLS, '/fapi/v1/ping'),
        ]);
        if (results[0].status === 'fulfilled') this._activeBase = results[0].value;
        if (results[1].status === 'fulfilled') this._activeFutures = results[1].value;
        console.log(`Binance API: ${this.BASE_URLS[this._activeBase]}`);
    },

    async _testEndpoint(urls, path) {
        for (let i = 0; i < urls.length; i++) {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 4000);
            try {
                const resp = await fetch(urls[i] + path, { signal: ctrl.signal });
                clearTimeout(t);
                if (resp.ok) return i;
            } catch (e) { /* next */ }
            // 代理也试试
            try {
                const ctrl2 = new AbortController();
                const t2 = setTimeout(() => ctrl2.abort(), 6000);
                const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(urls[i] + path);
                const resp = await fetch(proxyUrl, { signal: ctrl2.signal });
                clearTimeout(t2);
                if (resp.ok) return i;
            } catch (e) { /* next */ }
        }
        return 0;
    },

    get baseUrl() { return this.BASE_URLS[this._activeBase]; },
    get futuresUrl() { return this.FUTURES_URLS[this._activeFutures]; },

    /**
     * 通用请求（10秒超时），失败自动走代理
     */
    async _fetch(url, cacheKey = null, ttl = 30000) {
        if (cacheKey && this._cache[cacheKey] && Date.now() - this._cache[cacheKey].ts < ttl) {
            return this._cache[cacheKey].data;
        }
        // 先直连，失败走代理
        let resp = await this._doFetch(url);
        if (!resp) {
            console.log('直连失败，尝试代理...');
            const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(url);
            resp = await this._doFetch(proxyUrl, 15000);
        }
        if (!resp) throw new Error('网络请求失败（直连和代理均不可达）');
        const data = await resp.json();
        if (cacheKey) this._cache[cacheKey] = { data, ts: Date.now() };
        return data;
    },

    async _doFetch(url, timeoutMs = 8000) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
            const resp = await fetch(url, { signal: ctrl.signal });
            clearTimeout(t);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return resp;
        } catch (err) {
            clearTimeout(t);
            return null;
        }
    },

    async get24hrTickers() {
        const data = await this._fetch(
            `${this.baseUrl}/api/v3/ticker/24hr`,
            'tickers_24hr', 15000
        );
        return data
            .filter(t => t.symbol.endsWith('USDT'))
            .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
            .slice(0, 60);
    },

    async getKlines(symbol, interval = '4h', limit = 200) {
        const cacheKey = `klines_${symbol}_${interval}_${limit}`;
        const data = await this._fetch(
            `${this.baseUrl}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
            cacheKey, 10000
        );
        return data.map(k => ({
            time: k[0] / 1000,
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
            closeTime: k[6] / 1000,
            quoteVolume: parseFloat(k[7]),
            trades: k[8],
        }));
    },

    async getLongShortRatio(symbol) {
        try {
            const data = await this._fetch(
                `${this.futuresUrl}/futures/data/topLongShortAccountRatio?symbol=${symbol}&period=5m&limit=30`,
                `lsr_${symbol}`, 30000
            );
            if (!data || data.length === 0) return null;
            const sum = data.reduce((acc, d) => acc + parseFloat(d.longShortRatio), 0);
            return {
                current: parseFloat(data[data.length - 1].longShortRatio),
                avg: sum / data.length,
                history: data.map(d => ({
                    time: d.timestamp / 1000,
                    ratio: parseFloat(d.longShortRatio),
                    longAccount: parseFloat(d.longAccount),
                    shortAccount: parseFloat(d.shortAccount),
                })),
            };
        } catch (err) {
            console.warn(`多空比获取失败:`, err.message);
            return null;
        }
    },

    async getPrice(symbol) {
        try {
            const data = await this._fetch(
                `${this.baseUrl}/api/v3/ticker/price?symbol=${symbol}`,
                `price_${symbol}`, 5000
            );
            return parseFloat(data.price);
        } catch (err) { return null; }
    },

    async get24hrTicker(symbol) {
        try {
            const data = await this._fetch(
                `${this.baseUrl}/api/v3/ticker/24hr?symbol=${symbol}`,
                `ticker_${symbol}`, 5000
            );
            return {
                price: parseFloat(data.lastPrice),
                change: parseFloat(data.priceChange),
                changePercent: parseFloat(data.priceChangePercent),
                high: parseFloat(data.highPrice),
                low: parseFloat(data.lowPrice),
                volume: parseFloat(data.volume),
                quoteVolume: parseFloat(data.quoteVolume),
            };
        } catch (err) { return null; }
    },

    async getFearGreedIndex() {
        try {
            const data = await this._fetch(
                'https://api.alternative.me/fng/?limit=7',
                'fear_greed', 60000
            );
            if (!data || !data.data) return null;
            const current = data.data[0];
            return {
                current: parseInt(current.value),
                classification: current.value_classification,
                history: data.data.map(d => ({
                    value: parseInt(d.value),
                    classification: d.value_classification,
                    timestamp: parseInt(d.timestamp) * 1000,
                })),
                bias: current.value <= 25 ? 'strong_bullish' :
                      current.value <= 45 ? 'bullish' :
                      current.value <= 55 ? 'neutral' :
                      current.value <= 75 ? 'bearish' : 'strong_bearish',
            };
        } catch (err) {
            console.warn('恐慌贪婪指数获取失败:', err.message);
            return null;
        }
    },

    async getCryptoNews() {
        try {
            const data = await this._fetch(
                'https://cryptopanic.com/api/v1/posts/?public=true&filter=trending&kind=news',
                'cryptopanic_news', 60000
            );
            if (data && data.results) {
                return data.results.slice(0, 8).map(p => ({
                    title: p.title, url: p.url,
                    source: p.source?.title || 'CryptoPanic',
                    sentiment: p.votes?.positive > p.votes?.negative ? 'positive' :
                               p.votes?.negative > p.votes?.positive ? 'negative' : 'neutral',
                    published: p.published_at,
                }));
            }
        } catch (e) { /* fallback */ }

        try {
            const resp = await fetch('https://www.reddit.com/r/CryptoCurrency/hot.json?limit=8');
            if (resp.ok) {
                const data = await resp.json();
                return data.data.children.map(c => ({
                    title: c.data.title,
                    url: `https://reddit.com${c.data.permalink}`,
                    source: 'r/CryptoCurrency',
                    sentiment: c.data.upvote_ratio > 0.85 ? 'positive' :
                               c.data.upvote_ratio < 0.6 ? 'negative' : 'neutral',
                    published: new Date(c.data.created_utc * 1000).toISOString(),
                }));
            }
        } catch (e) { /* fallback */ }

        return null;
    },
};
