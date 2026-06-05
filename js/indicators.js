/**
 * 技术指标计算模块
 * 纯数学计算，输入OHLCV数据，输出各项指标结果
 */

const Indicators = {

    /**
     * 计算SMA (简单移动平均线)
     */
    SMA(data, period) {
        const result = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                result.push(null);
                continue;
            }
            let sum = 0;
            for (let j = i - period + 1; j <= i; j++) {
                sum += data[j];
            }
            result.push(sum / period);
        }
        return result;
    },

    /**
     * 计算EMA (指数移动平均线)
     */
    EMA(data, period) {
        const result = [];
        const multiplier = 2 / (period + 1);
        // 第一个EMA值使用SMA
        let ema = null;
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                result.push(null);
                continue;
            }
            if (ema === null) {
                let sum = 0;
                for (let j = 0; j < period; j++) {
                    sum += data[j];
                }
                ema = sum / period;
            } else {
                ema = (data[i] - ema) * multiplier + ema;
            }
            result.push(ema);
        }
        return result;
    },

    /**
     * 计算RSI (相对强弱指数)
     * @param {number[]} closes - 收盘价数组
     * @param {number} period - 周期，默认14
     */
    RSI(closes, period = 14) {
        const result = [];
        const gains = [];
        const losses = [];

        // 计算涨跌幅
        for (let i = 1; i < closes.length; i++) {
            const diff = closes[i] - closes[i - 1];
            gains.push(diff > 0 ? diff : 0);
            losses.push(diff < 0 ? -diff : 0);
        }

        let avgGain = 0;
        let avgLoss = 0;

        for (let i = 0; i < closes.length; i++) {
            if (i === 0) {
                result.push(null);
                continue;
            }
            const idx = i - 1;
            if (idx < period) {
                avgGain += gains[idx];
                avgLoss += losses[idx];
                if (idx === period - 1) {
                    avgGain /= period;
                    avgLoss /= period;
                    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
                    result.push(100 - (100 / (1 + rs)));
                } else {
                    result.push(null);
                }
            } else {
                avgGain = (avgGain * (period - 1) + gains[idx]) / period;
                avgLoss = (avgLoss * (period - 1) + losses[idx]) / period;
                const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
                result.push(100 - (100 / (1 + rs)));
            }
        }
        return result;
    },

    /**
     * 计算MACD
     * @returns {{ dif: number[], dea: number[], histogram: number[] }}
     */
    MACD(closes, fast = 12, slow = 26, signal = 9) {
        const emaFast = this.EMA(closes, fast);
        const emaSlow = this.EMA(closes, slow);
        const dif = [];
        const dea = [];
        const histogram = [];

        for (let i = 0; i < closes.length; i++) {
            if (emaFast[i] === null || emaSlow[i] === null) {
                dif.push(null);
                dea.push(null);
                histogram.push(null);
            } else {
                dif.push(emaFast[i] - emaSlow[i]);
            }
        }

        // DEA = EMA of DIF
        const validDifs = dif.filter(d => d !== null);
        const emaDif = this.EMA(validDifs, signal);
        let emaIdx = 0;
        for (let i = 0; i < dif.length; i++) {
            if (dif[i] === null) {
                continue;
            }
            if (emaIdx < emaDif.length) {
                dea[i] = emaDif[emaIdx];
                histogram[i] = (dif[i] - dea[i]) * 2; // 柱子 = 2*(DIF-DEA)
                emaIdx++;
            }
        }
        return { dif, dea, histogram };
    },

    /**
     * 计算布林带 (Bollinger Bands)
     * @returns {{ upper: number[], middle: number[], lower: number[] }}
     */
    BollingerBands(closes, period = 20, stdDev = 2) {
        const middle = this.SMA(closes, period);
        const upper = [];
        const lower = [];

        for (let i = 0; i < closes.length; i++) {
            if (middle[i] === null) {
                upper.push(null);
                lower.push(null);
                continue;
            }
            // 计算标准差
            let sumSq = 0;
            for (let j = i - period + 1; j <= i; j++) {
                sumSq += Math.pow(closes[j] - middle[i], 2);
            }
            const std = Math.sqrt(sumSq / period);
            upper.push(middle[i] + stdDev * std);
            lower.push(middle[i] - stdDev * std);
        }
        return { upper, middle, lower };
    },

    /**
     * 计算多周期MA (MA5, MA10, MA20, MA60)
     */
    MultiMA(closes) {
        return {
            ma5: this.SMA(closes, 5),
            ma10: this.SMA(closes, 10),
            ma20: this.SMA(closes, 20),
            ma60: this.SMA(closes, 60),
        };
    },

    /**
     * 检测MACD金叉/死叉
     * @returns {{ crossType: 'golden'|'death'|null, crossIndex: number }}
     */
    detectMACDCross(dif, dea) {
        for (let i = dif.length - 1; i >= 1; i--) {
            if (dif[i] === null || dea[i] === null || dif[i - 1] === null || dea[i - 1] === null) {
                continue;
            }
            // 金叉：DIF从下往上穿过DEA
            if (dif[i - 1] <= dea[i - 1] && dif[i] > dea[i]) {
                return { crossType: 'golden', crossIndex: i };
            }
            // 死叉：DIF从上往下穿过DEA
            if (dif[i - 1] >= dea[i - 1] && dif[i] < dea[i]) {
                return { crossType: 'death', crossIndex: i };
            }
        }
        return { crossType: null, crossIndex: -1 };
    },

    /**
     * 检查MA多头/空头排列
     * 短周期在长周期上方为多头
     */
    checkMAAlignment(multiMA, index) {
        const { ma5, ma10, ma20, ma60 } = multiMA;
        const vals = [
            ma5[index], ma10[index], ma20[index], ma60[index]
        ];
        // 所有值都必须有效
        if (vals.some(v => v === null)) return 'invalid';
        // 多头排列：短>长
        if (ma5[index] > ma10[index] && ma10[index] > ma20[index] && ma20[index] > ma60[index]) {
            return 'bullish';
        }
        // 空头排列：短<长
        if (ma5[index] < ma10[index] && ma10[index] < ma20[index] && ma20[index] < ma60[index]) {
            return 'bearish';
        }
        return 'mixed';
    },

    /**
     * 分析成交量趋势
     */
    analyzeVolume(volumes, closes) {
        const len = volumes.length;
        if (len < 20) return { trend: 'normal', description: '数据不足' };

        // 最近10根 vs 前10根的平均成交量
        const recentVol = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10;
        const prevVol = volumes.slice(-20, -10).reduce((a, b) => a + b, 0) / 10;
        const volRatio = recentVol / prevVol;

        // 价格趋势
        const recentPrice = closes.slice(-10).reduce((a, b) => a + b, 0) / 10;
        const prevPrice = closes.slice(-20, -10).reduce((a, b) => a + b, 0) / 10;
        const priceChange = recentPrice - prevPrice;

        if (volRatio > 1.5 && priceChange > 0) return { trend: 'bullish', description: '放量上涨', ratio: volRatio };
        if (volRatio > 1.5 && priceChange < 0) return { trend: 'bearish', description: '放量下跌', ratio: volRatio };
        if (volRatio < 0.6 && priceChange > 0) return { trend: 'weakening', description: '缩量上涨', ratio: volRatio };
        if (volRatio < 0.6 && priceChange < 0) return { trend: 'weakening_bear', description: '缩量下跌', ratio: volRatio };
        return { trend: 'normal', description: '量能平稳', ratio: volRatio };
    },

    /**
     * 综合计算所有指标
     * @param {Object[]} klines - K线数据
     * @returns {Object} 所有指标的综合结果
     */
    calculateAll(klines) {
        const closes = klines.map(k => k.close);
        const highs = klines.map(k => k.high);
        const lows = klines.map(k => k.low);
        const volumes = klines.map(k => k.volume);

        const rsi = this.RSI(closes, 14);
        const macd = this.MACD(closes);
        const bb = this.BollingerBands(closes);
        const multiMA = this.MultiMA(closes);
        const macdCross = this.detectMACDCross(macd.dif, macd.dea);
        const maAlignment = this.checkMAAlignment(multiMA, closes.length - 1);
        const volumeAnalysis = this.analyzeVolume(volumes, closes);

        const lastIdx = closes.length - 1;
        const lastClose = closes[lastIdx];

        // 判断布林带位置
        let bbPosition = 'middle';
        if (bb.upper[lastIdx] !== null && lastClose >= bb.upper[lastIdx]) {
            bbPosition = 'upper';
        } else if (bb.lower[lastIdx] !== null && lastClose <= bb.lower[lastIdx]) {
            bbPosition = 'lower';
        }

        return {
            closes,
            highs,
            lows,
            volumes,
            rsi: {
                values: rsi,
                current: rsi[lastIdx],
                isOverbought: rsi[lastIdx] !== null && rsi[lastIdx] > 70,
                isOversold: rsi[lastIdx] !== null && rsi[lastIdx] < 30,
            },
            macd: {
                dif: macd.dif,
                dea: macd.dea,
                histogram: macd.histogram,
                currentDIF: macd.dif[lastIdx],
                currentDEA: macd.dea[lastIdx],
                currentHistogram: macd.histogram[lastIdx],
                cross: macdCross,
            },
            bollingerBands: {
                upper: bb.upper,
                middle: bb.middle,
                lower: bb.lower,
                currentUpper: bb.upper[lastIdx],
                currentMiddle: bb.middle[lastIdx],
                currentLower: bb.lower[lastIdx],
                position: bbPosition,
                bandwidth: bb.upper[lastIdx] !== null
                    ? ((bb.upper[lastIdx] - bb.lower[lastIdx]) / bb.middle[lastIdx] * 100)
                    : null,
            },
            ma: {
                ma5: multiMA.ma5,
                ma10: multiMA.ma10,
                ma20: multiMA.ma20,
                ma60: multiMA.ma60,
                currentMA5: multiMA.ma5[lastIdx],
                currentMA10: multiMA.ma10[lastIdx],
                currentMA20: multiMA.ma20[lastIdx],
                currentMA60: multiMA.ma60[lastIdx],
                alignment: maAlignment,
            },
            volume: volumeAnalysis,
            lastClose,
            lastIdx,
        };
    },
};
