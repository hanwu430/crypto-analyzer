/**
 * 综合分析引擎
 * 多指标打分系统，结合技术指标、多空比等给出操作建议
 */

const AnalysisEngine = {

    /**
     * 分析单个指标并打分
     * @param {Object} indicators - Indicators.calculateAll 的输出
     * @param {Object|null} lsrData - 多空比数据
     * @returns {Object} 分析结果
     */
    analyze(indicators, lsrData) {
        const scores = [];
        const details = [];

        // === 1. RSI分析 (权重: 2) ===
        const rsiScore = this._analyzeRSI(indicators.rsi);
        scores.push({ name: 'RSI', score: rsiScore.score, weight: 2, detail: rsiScore.detail });
        details.push({
            name: 'RSI (14)',
            value: indicators.rsi.current !== null ? indicators.rsi.current.toFixed(1) : '--',
            signal: rsiScore.signal,
            description: rsiScore.detail,
            barValue: ((indicators.rsi.current || 50) / 100) * 10,
        });

        // === 2. MACD分析 (权重: 2) ===
        const macdScore = this._analyzeMACD(indicators.macd);
        scores.push({ name: 'MACD', score: macdScore.score, weight: 2, detail: macdScore.detail });
        details.push({
            name: 'MACD',
            value: indicators.macd.currentDIF !== null ? indicators.macd.currentDIF.toFixed(4) : '--',
            signal: macdScore.signal,
            description: macdScore.detail,
            barValue: macdScore.score > 0 ? 7.5 : macdScore.score < 0 ? 2.5 : 5,
        });

        // === 3. MA均线排列 (权重: 2) ===
        const maScore = this._analyzeMA(indicators.ma, indicators.lastClose);
        scores.push({ name: 'MA均线', score: maScore.score, weight: 2, detail: maScore.detail });
        details.push({
            name: 'MA均线排列',
            value: indicators.ma.alignment === 'bullish' ? '多头' :
                   indicators.ma.alignment === 'bearish' ? '空头' : '交叉',
            signal: maScore.signal,
            description: maScore.detail,
            barValue: maScore.score > 0 ? 7.5 : maScore.score < 0 ? 2.5 : 5,
        });

        // === 4. 布林带分析 (权重: 1.5) ===
        const bbScore = this._analyzeBB(indicators.bollingerBands, indicators.lastClose);
        scores.push({ name: '布林带', score: bbScore.score, weight: 1.5, detail: bbScore.detail });
        details.push({
            name: '布林带',
            value: indicators.bollingerBands.position === 'upper' ? '上轨' :
                   indicators.bollingerBands.position === 'lower' ? '下轨' : '中轨附近',
            signal: bbScore.signal,
            description: bbScore.detail,
            barValue: bbScore.score > 0 ? 7.5 : bbScore.score < 0 ? 2.5 : 5,
        });

        // === 5. 成交量分析 (权重: 1.5) ===
        const volScore = this._analyzeVolume(indicators.volume);
        scores.push({ name: '成交量', score: volScore.score, weight: 1.5, detail: volScore.detail });
        details.push({
            name: '成交量',
            value: indicators.volume.description,
            signal: volScore.signal,
            description: volScore.detail,
            barValue: volScore.score > 0 ? 7.5 : volScore.score < 0 ? 2.5 : 5,
        });

        // === 6. 多空比分析 (权重: 1.5) ===
        const lsrScore = this._analyzeLSR(lsrData);
        scores.push({ name: '多空比', score: lsrScore.score, weight: 1.5, detail: lsrScore.detail });
        details.push({
            name: '多空比',
            value: lsrData ? lsrData.current.toFixed(2) : '无数据',
            signal: lsrScore.signal,
            description: lsrScore.detail,
            barValue: lsrScore.score > 0 ? 7.5 : lsrScore.score < 0 ? 2.5 : 5,
        });

        // === 7. 价格相对MA60位置 (权重: 1) ===
        const trendScore = this._analyzeTrend(indicators);
        scores.push({ name: '趋势强度', score: trendScore.score, weight: 1, detail: trendScore.detail });
        details.push({
            name: '趋势强度(相对MA60)',
            value: indicators.ma.currentMA60 !== null
                ? ((indicators.lastClose / indicators.ma.currentMA60 - 1) * 100).toFixed(2) + '%'
                : '--',
            signal: trendScore.signal,
            description: trendScore.detail,
            barValue: trendScore.score > 0 ? 7.5 : trendScore.score < 0 ? 2.5 : 5,
        });

        // 计算加权总分
        const totalWeight = scores.reduce((s, item) => s + item.weight, 0);
        const weightedSum = scores.reduce((s, item) => s + item.score * item.weight, 0);
        const totalScore = weightedSum / totalWeight; // 归一化到 -2 ~ +2 范围

        // 映射到 -12 ~ +12
        const finalScore = Math.round(totalScore * 6);
        const clampedScore = Math.max(-12, Math.min(12, finalScore));

        // 生成建议
        const recommendation = this._generateRecommendation(clampedScore, details);

        return {
            details,
            scores,
            totalWeight,
            weightedSum,
            rawScore: totalScore,
            finalScore: clampedScore,
            recommendation,
        };
    },

    _signalLabel(score) {
        if (score > 0.5) return 'bullish';
        if (score < -0.5) return 'bearish';
        return 'neutral';
    },

    _analyzeRSI(rsi) {
        const val = rsi.current;
        if (val === null) return { score: 0, signal: 'neutral', detail: 'RSI数据不可用' };
        if (val < 25) return { score: 2, signal: 'bullish', detail: `RSI=${val.toFixed(1)}，深度超卖区域，反弹概率高` };
        if (val < 35) return { score: 1.5, signal: 'bullish', detail: `RSI=${val.toFixed(1)}，超卖区域，有反弹需求` };
        if (val < 45) return { score: 0.5, signal: 'neutral', detail: `RSI=${val.toFixed(1)}，偏弱但未超卖` };
        if (val < 55) return { score: 0, signal: 'neutral', detail: `RSI=${val.toFixed(1)}，中性区域` };
        if (val < 65) return { score: -0.5, signal: 'neutral', detail: `RSI=${val.toFixed(1)}，偏强但未超买` };
        if (val < 75) return { score: -1.5, signal: 'bearish', detail: `RSI=${val.toFixed(1)}，超买区域，回调风险` };
        return { score: -2, signal: 'bearish', detail: `RSI=${val.toFixed(1)}，深度超买区域，回调概率高` };
    },

    _analyzeMACD(macd) {
        const { currentDIF, currentDEA, currentHistogram, cross } = macd;
        if (currentDIF === null) return { score: 0, signal: 'neutral', detail: 'MACD数据不可用' };

        let score = 0;
        const reasons = [];

        // 金叉/死叉检测
        if (cross.crossType === 'golden') {
            const barsAgo = macd.dif.length - 1 - cross.crossIndex;
            if (barsAgo <= 3) {
                score += 1.5;
                reasons.push(`近期金叉(${barsAgo}根K线前)`);
            }
        } else if (cross.crossType === 'death') {
            const barsAgo = macd.dif.length - 1 - cross.crossIndex;
            if (barsAgo <= 3) {
                score -= 1.5;
                reasons.push(`近期死叉(${barsAgo}根K线前)`);
            }
        }

        // DIF位置
        if (currentDIF > 0) {
            score += 0.5;
            reasons.push('DIF在零轴上方');
        } else {
            score -= 0.5;
            reasons.push('DIF在零轴下方');
        }

        // 柱状图趋势
        if (currentHistogram > 0) {
            score += 0.5;
            reasons.push('动能柱为正');
        } else {
            score -= 0.5;
            reasons.push('动能柱为负');
        }

        // DIF与DEA关系
        if (currentDIF > currentDEA) {
            score += 0.3;
        } else {
            score -= 0.3;
        }

        return {
            score: Math.max(-2, Math.min(2, score)),
            signal: this._signalLabel(score),
            detail: reasons.join('；') || 'MACD信号中性',
        };
    },

    _analyzeMA(ma, lastClose) {
        const { alignment, currentMA5, currentMA10, currentMA20, currentMA60 } = ma;
        const reasons = [];

        if (alignment === 'bullish') {
            reasons.push('均线多头排列(MA5>MA10>MA20>MA60)');
        } else if (alignment === 'bearish') {
            reasons.push('均线空头排列(MA5<MA10<MA20<MA60)');
        } else {
            reasons.push('均线交叉缠绕');
        }

        // 价格相对均线位置
        if (currentMA20 !== null) {
            if (lastClose > currentMA20) reasons.push('价格站上MA20');
            else reasons.push('价格跌破MA20');
        }

        let score = 0;
        if (alignment === 'bullish') score = 1.5;
        else if (alignment === 'bearish') score = -1.5;

        if (currentMA20 !== null && lastClose > currentMA20) score += 0.5;
        if (currentMA20 !== null && lastClose < currentMA20) score -= 0.5;

        return {
            score: Math.max(-2, Math.min(2, score)),
            signal: this._signalLabel(score),
            detail: reasons.join('；'),
        };
    },

    _analyzeBB(bb, lastClose) {
        const { position, bandwidth } = bb;
        if (position === 'lower') {
            return { score: 1.5, signal: 'bullish', detail: '价格触及布林带下轨，有反弹需求' };
        }
        if (position === 'upper') {
            return { score: -1.5, signal: 'bearish', detail: '价格触及布林带上轨，有回调压力' };
        }
        // 中轨附近
        if (bandwidth !== null && bandwidth < 5) {
            return { score: 0, signal: 'neutral', detail: '布林带收窄，可能即将变盘' };
        }
        return { score: 0, signal: 'neutral', detail: '价格在布林带中轨附近运行' };
    },

    _analyzeVolume(vol) {
        switch (vol.trend) {
            case 'bullish':
                return { score: 1.5, signal: 'bullish', detail: '放量上涨，多头力量强劲' };
            case 'bearish':
                return { score: -1.5, signal: 'bearish', detail: '放量下跌，空头力量强劲' };
            case 'weakening':
                return { score: -0.5, signal: 'bearish', detail: '缩量上涨，上涨动力不足' };
            case 'weakening_bear':
                return { score: 0.5, signal: 'bullish', detail: '缩量下跌，抛压减弱' };
            default:
                return { score: 0, signal: 'neutral', detail: '成交量平稳，方向待定' };
        }
    },

    _analyzeLSR(lsrData) {
        if (!lsrData) {
            return { score: 0, signal: 'neutral', detail: '多空比数据不可用（部分币种不支持）' };
        }
        const ratio = lsrData.current;
        if (ratio > 2.5) {
            return { score: -2, signal: 'bearish', detail: `多空比${ratio.toFixed(2)}，多头过于拥挤，警惕踩踏` };
        }
        if (ratio > 1.8) {
            return { score: -1, signal: 'bearish', detail: `多空比${ratio.toFixed(2)}，多头偏多，存在回调风险` };
        }
        if (ratio < 0.6) {
            return { score: 2, signal: 'bullish', detail: `多空比${ratio.toFixed(2)}，空头主导，可能轧空上涨` };
        }
        if (ratio < 0.85) {
            return { score: 1, signal: 'bullish', detail: `多空比${ratio.toFixed(2)}，空头偏多，有反弹空间` };
        }
        return { score: 0, signal: 'neutral', detail: `多空比${ratio.toFixed(2)}，多空均衡` };
    },

    _analyzeTrend(indicators) {
        const { lastClose, ma } = indicators;
        if (ma.currentMA60 === null) return { score: 0, signal: 'neutral', detail: 'MA60数据不足' };

        const pctFromMA60 = (lastClose / ma.currentMA60 - 1) * 100;
        const absPct = Math.abs(pctFromMA60);

        if (pctFromMA60 > 20) {
            return { score: -1.5, signal: 'bearish', detail: `价格高于MA60 ${absPct.toFixed(1)}%，严重偏离，回调风险大` };
        }
        if (pctFromMA60 > 10) {
            return { score: -0.5, signal: 'neutral', detail: `价格高于MA60 ${absPct.toFixed(1)}%，短期强势但偏离较大` };
        }
        if (pctFromMA60 > 0) {
            return { score: 1, signal: 'bullish', detail: `价格高于MA60 ${absPct.toFixed(1)}%，趋势偏多` };
        }
        if (pctFromMA60 > -10) {
            return { score: -0.5, signal: 'neutral', detail: `价格低于MA60 ${absPct.toFixed(1)}%，短期偏弱` };
        }
        return { score: -1.5, signal: 'bearish', detail: `价格低于MA60 ${absPct.toFixed(1)}%，严重偏离，超跌可能反弹` };
    },

    _generateRecommendation(score, details) {
        let verdict, verdictClass, advice;

        if (score >= 6) {
            verdict = '🟢 强烈看涨';
            verdictClass = 'strong-bullish';
            advice = '多项技术指标共振看涨，多头趋势明确。建议可考虑逢低做多，止损设在近期支撑位或MA60下方。注意控制仓位，分批建仓降低风险。';
        } else if (score >= 3) {
            verdict = '🟡 偏多';
            verdictClass = 'mild-bullish';
            advice = '多数指标偏多，但上涨信号尚未完全确认。建议小仓位参与，严格设置止损。关注能否突破关键阻力位。';
        } else if (score >= -2) {
            verdict = '⚪ 震荡观望';
            verdictClass = 'neutral';
            advice = '技术指标信号不明确，市场处于震荡格局。建议观望为主，等待方向明确后再入场。可在支撑位附近轻仓试多，阻力位附近试空。';
        } else if (score >= -5) {
            verdict = '🟠 偏空';
            verdictClass = 'mild-bearish';
            advice = '多数指标偏空，下跌风险加大。持有仓位注意减仓或设好止损。做空需等待反弹至阻力位再考虑。';
        } else {
            verdict = '🔴 强烈看跌';
            verdictClass = 'strong-bearish';
            advice = '多项技术指标共振看跌，空头趋势明确。建议减仓或清仓观望，可考虑在阻力位做空，严格止损。不要逆势抄底。';
        }

        return { verdict, verdictClass, advice, score };
    },
};
