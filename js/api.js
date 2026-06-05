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
        'https://api.binance.us',       // 币安美国
    ],
    FUTURES_URLS: [
        'https://fapi.binance.com',
        'https://fapi.binance.us',
    ],

    _activeBase: 0,       // 当前可用的BASE索引
    _activeFutures: 0,    // 当前可用的Futures索引
    _cache: {},

    /**
     * 初始化：检测哪个API端点可用
     */
    async init() {
        const [baseIdx, futuresIdx] = await Promise.all([
            this._testEndpoint(this.BASE_URLS, '/api/v3/ping'),
            this._testEndpoint(this.FUTURES_URLS, '/fapi/v1/ping'),
        ]);
        this._activeBase = baseIdx;
        this._activeFutures = futuresIdx;
        console.log(`Binance API: ${this.BASE_URLS[baseIdx]} (现货), ${this.FUTURES_URLS[futuresIdx]} (期货)`);
    },

    async _testEndpoint(urls, path) {
        const controller = new AbortController();
        for (let i = 0; i < urls.length; i++) {
            try {
                const resp = await fetch(urls[i] + path, {
                    signal: controller.signal,
                });
                if (resp.ok) {
                    controller.abort();
                    return i;
                }
            } catch (e) {
                // 继续尝试下一个
            }
        }
        return 0; // 全失败时用默认的
    },

    get baseUrl() { return this.BASE_URLS[this._activeBase]; },
    get futuresUrl() { return this.FUTURES_URLS[this._activeFutures]; },

    /**
     * 通用请求方法（带缓存）
     */
    async _fetch(url, cacheKey = null, ttl = 30000) {
        if (cacheKey && this._cache[cacheKey] && Date.now() - this._cache[cacheKey].ts < ttl) {
            return this._cache[cacheKey].data;
        }
        try {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            if (cacheKey) {
                this._cache[cacheKey] = { data, ts: Date.now() };
            }
            return data;
        } catch (err) {
            console.error(`API请求失败: ${url}`, err);
            throw err;
        }
    },

    /**
     * 获取24小时行情（所有USDT交易对）
     * 用于粒子首页展示
     */
    async get24hrTickers() {
        const data = await this._fetch(
            `${this.baseUrl}/api/v3/ticker/24hr`,
            'tickers_24hr',
            15000
        );
        // 筛选USDT交易对，按交易量排序，取Top 60
        return data
            .filter(t => t.symbol.endsWith('USDT'))
            .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
            .slice(0, 60);
    },

    /**
     * 获取K线数据
     * @param {string} symbol - 交易对如 BTCUSDT
     * @param {string} interval - 时间周期: 15m, 1h, 4h, 1d, 1w
     * @param {number} limit - 获取数量
     */
    async getKlines(symbol, interval = '4h', limit = 200) {
        const cacheKey = `klines_${symbol}_${interval}_${limit}`;
        const data = await this._fetch(
            `${this.baseUrl}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
            cacheKey,
            10000
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

    /**
     * 获取多空比（期货账户）
     * @param {string} symbol - 如 BTCUSDT
     */
    async getLongShortRatio(symbol) {
        try {
            const data = await this._fetch(
                `${this.futuresUrl}/futures/data/topLongShortAccountRatio?symbol=${symbol}&period=5m&limit=30`,
                `lsr_${symbol}`,
                30000
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
            console.warn(`多空比获取失败(${symbol}):`, err.message);
            return null;
        }
    },

    /**
     * 获取当前价格
     */
    async getPrice(symbol) {
        try {
            const data = await this._fetch(
                `${this.baseUrl}/api/v3/ticker/price?symbol=${symbol}`,
                `price_${symbol}`,
                5000
            );
            return parseFloat(data.price);
        } catch (err) {
            console.error(`价格获取失败(${symbol}):`, err.message);
            return null;
        }
    },

    /**
     * 获取24h价格变化
     */
    async get24hrTicker(symbol) {
        try {
            const data = await this._fetch(
                `${this.baseUrl}/api/v3/ticker/24hr?symbol=${symbol}`,
                `ticker_${symbol}`,
                5000
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
        } catch (err) {
            console.error(`24h行情获取失败(${symbol}):`, err.message);
            return null;
        }
    },

    /**
     * 获取恐慌贪婪指数 (Fear & Greed Index)
     * 数据来源: alternative.me, 完全免费无需API Key
     * 0-25: 极度恐慌, 25-45: 恐慌, 45-55: 中性, 55-75: 贪婪, 75-100: 极度贪婪
     */
    async getFearGreedIndex() {
        try {
            const data = await this._fetch(
                'https://api.alternative.me/fng/?limit=7',
                'fear_greed',
                60000
            );
            if (!data || !data.data || data.data.length === 0) return null;
            const current = data.data[0];
            const history = data.data.map(d => ({
                value: parseInt(d.value),
                classification: d.value_classification,
                timestamp: parseInt(d.timestamp) * 1000,
            }));
            return {
                current: parseInt(current.value),
                classification: current.value_classification,
                history,
                bias: current.value <= 25 ? 'strong_bullish' :
                      current.value <= 45 ? 'bullish' :
                      current.value <= 55 ? 'neutral' :
                      current.value <= 75 ? 'bearish' :
                      'strong_bearish',
            };
        } catch (err) {
            console.warn('恐慌贪婪指数获取失败:', err.message);
            return null;
        }
    },

    /**
     * 获取加密货币新闻头条
     * 优先 CryptoPanic，失败则用 Reddit
     */
    async getCryptoNews() {
        try {
            const data = await this._fetch(
                'https://cryptopanic.com/api/v1/posts/?public=true&filter=trending&kind=news',
                'cryptopanic_news',
                60000
            );
            if (data && data.results) {
                return data.results.slice(0, 8).map(p => ({
                    title: p.title,
                    url: p.url,
                    source: p.source?.title || 'CryptoPanic',
                    sentiment: p.votes?.positive > p.votes?.negative ? 'positive' :
                               p.votes?.negative > p.votes?.positive ? 'negative' : 'neutral',
                    published: p.published_at,
                }));
            }
        } catch (e) { /* fallback to Reddit */ }

        try {
            const resp = await fetch('https://www.reddit.com/r/CryptoCurrency/hot.json?limit=8');
            if (resp.ok) {
                const data = await resp.json();
                return data.data.children.map(c => {
                    const post = c.data;
                    return {
                        title: post.title,
                        url: `https://reddit.com${post.permalink}`,
                        source: 'r/CryptoCurrency',
                        sentiment: post.upvote_ratio > 0.85 ? 'positive' :
                                   post.upvote_ratio < 0.6 ? 'negative' : 'neutral',
                        published: new Date(post.created_utc * 1000).toISOString(),
                        score: post.score,
                    };
                });
            }
        } catch (e) { /* fallback */ }

        return null;
    },
};
