/**
 * K线图表模块
 * 使用 lightweight-charts 渲染专业K线图和技术指标
 */

const ChartManager = {
    mainChart: null,
    volumeChart: null,
    macdChart: null,
    rsiChart: null,
    mainSeries: null,
    volumeSeries: null,
    macdHistogram: null,
    macdDIF: null,
    macdDEA: null,
    rsiSeries: null,
    ma5Series: null,
    ma10Series: null,
    ma20Series: null,
    ma60Series: null,

    /**
     * 初始化所有图表
     */
    init() {
        this._createMainChart();
        this._createVolumeChart();
        this._createMACDChart();
        this._createRSIChart();
    },

    /**
     * 创建主K线图
     */
    _createMainChart() {
        const container = document.getElementById('chart-main');
        this.mainChart = LightweightCharts.createChart(container, {
            layout: {
                background: { color: '#1a1a2e' },
                textColor: '#aaa',
            },
            grid: {
                vertLines: { color: 'rgba(255,255,255,0.05)' },
                horzLines: { color: 'rgba(255,255,255,0.05)' },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
            },
            rightPriceScale: {
                borderColor: 'rgba(255,255,255,0.1)',
                scaleMargins: { top: 0.05, bottom: 0.05 },
            },
            timeScale: {
                borderColor: 'rgba(255,255,255,0.1)',
                timeVisible: true,
                secondsVisible: false,
            },
            handleScroll: { vertTouchDrag: false },
        });

        // 添加K线图
        this.mainSeries = this.mainChart.addCandlestickSeries({
            upColor: '#00d4aa',
            downColor: '#ff4466',
            borderUpColor: '#00d4aa',
            borderDownColor: '#ff4466',
            wickUpColor: '#00d4aa',
            wickDownColor: '#ff4466',
        });

        // 添加MA均线
        this.ma5Series = this.mainChart.addLineSeries({
            color: '#f39c12', lineWidth: 1,
            priceLineVisible: false, lastValueVisible: false,
        });
        this.ma10Series = this.mainChart.addLineSeries({
            color: '#3498db', lineWidth: 1,
            priceLineVisible: false, lastValueVisible: false,
        });
        this.ma20Series = this.mainChart.addLineSeries({
            color: '#9b59b6', lineWidth: 1.5,
            priceLineVisible: false, lastValueVisible: false,
        });
        this.ma60Series = this.mainChart.addLineSeries({
            color: '#e74c3c', lineWidth: 2,
            priceLineVisible: false, lastValueVisible: false,
        });
    },

    /**
     * 创建成交量图
     */
    _createVolumeChart() {
        const container = document.getElementById('chart-volume');
        this.volumeChart = LightweightCharts.createChart(container, {
            height: 120,
            layout: {
                background: { color: '#1a1a2e' },
                textColor: '#aaa',
            },
            grid: {
                vertLines: { color: 'rgba(255,255,255,0.05)' },
                horzLines: { color: 'rgba(255,255,255,0.05)' },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
            },
            rightPriceScale: {
                borderColor: 'rgba(255,255,255,0.1)',
                scaleMargins: { top: 0, bottom: 0 },
            },
            timeScale: {
                borderColor: 'rgba(255,255,255,0.1)',
                visible: false,
            },
            handleScroll: { vertTouchDrag: false },
        });

        this.volumeSeries = this.volumeChart.addHistogramSeries({
            priceFormat: { type: 'volume' },
            priceScaleId: '',
        });

        // 同步主图和成交量图的时间轴
        this.volumeChart.timeScale().subscribeVisibleTimeRangeChange(() => {
            const range = this.volumeChart.timeScale().getVisibleRange();
            if (range) this.mainChart.timeScale().setVisibleRange(range);
        });
        this.mainChart.timeScale().subscribeVisibleTimeRangeChange(() => {
            const range = this.mainChart.timeScale().getVisibleRange();
            if (range) this.volumeChart.timeScale().setVisibleRange(range);
        });
    },

    /**
     * 创建MACD图
     */
    _createMACDChart() {
        const container = document.getElementById('chart-macd');
        this.macdChart = LightweightCharts.createChart(container, {
            height: 120,
            layout: {
                background: { color: '#1a1a2e' },
                textColor: '#aaa',
            },
            grid: {
                vertLines: { color: 'rgba(255,255,255,0.05)' },
                horzLines: { color: 'rgba(255,255,255,0.05)' },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
            },
            rightPriceScale: {
                borderColor: 'rgba(255,255,255,0.1)',
            },
            timeScale: {
                borderColor: 'rgba(255,255,255,0.1)',
                visible: false,
            },
            handleScroll: { vertTouchDrag: false },
        });

        this.macdHistogram = this.macdChart.addHistogramSeries({
            priceLineVisible: false,
            lastValueVisible: false,
        });
        this.macdDIF = this.macdChart.addLineSeries({
            color: '#f39c12', lineWidth: 1.5,
            priceLineVisible: false, lastValueVisible: false,
        });
        this.macdDEA = this.macdChart.addLineSeries({
            color: '#3498db', lineWidth: 1.5,
            priceLineVisible: false, lastValueVisible: false,
        });

        // 同步时间轴
        this.macdChart.timeScale().subscribeVisibleTimeRangeChange(() => {
            const range = this.macdChart.timeScale().getVisibleRange();
            if (range) this.mainChart.timeScale().setVisibleRange(range);
        });
    },

    /**
     * 创建RSI图
     */
    _createRSIChart() {
        const container = document.getElementById('chart-rsi');
        this.rsiChart = LightweightCharts.createChart(container, {
            height: 120,
            layout: {
                background: { color: '#1a1a2e' },
                textColor: '#aaa',
            },
            grid: {
                vertLines: { color: 'rgba(255,255,255,0.05)' },
                horzLines: { color: 'rgba(255,255,255,0.05)' },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
            },
            rightPriceScale: {
                borderColor: 'rgba(255,255,255,0.1)',
                autoScale: false,
            },
            timeScale: {
                borderColor: 'rgba(255,255,255,0.1)',
                visible: true,
            },
            handleScroll: { vertTouchDrag: false },
        });

        this.rsiSeries = this.rsiChart.addLineSeries({
            color: '#9b59b6',
            lineWidth: 1.5,
            priceLineVisible: false,
            lastValueVisible: true,
        });

        // RSI 超买超卖参考线
        this.rsiSeries.createPriceLine({
            price: 70, color: '#ff4466', lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Dashed,
            axisLabelVisible: true, title: '超买',
        });
        this.rsiSeries.createPriceLine({
            price: 30, color: '#00d4aa', lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Dashed,
            axisLabelVisible: true, title: '超卖',
        });
        this.rsiSeries.createPriceLine({
            price: 50, color: '#888888', lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Dotted,
            axisLabelVisible: false,
        });

        // 同步时间轴
        this.rsiChart.timeScale().subscribeVisibleTimeRangeChange(() => {
            const range = this.rsiChart.timeScale().getVisibleRange();
            if (range) this.mainChart.timeScale().setVisibleRange(range);
        });
    },

    /**
     * 更新图表数据
     * @param {Object[]} klines - K线数据
     * @param {Object} indicators - 技术指标
     */
    updateData(klines, indicators) {
        // K线数据
        const candleData = klines.map(k => ({
            time: k.time,
            open: k.open,
            high: k.high,
            low: k.low,
            close: k.close,
        }));
        this.mainSeries.setData(candleData);

        // MA均线
        const maData = (maArr) => klines.map((k, i) => {
            if (maArr[i] === null) return { time: k.time };
            return { time: k.time, value: maArr[i] };
        }).filter(d => d.value !== undefined);

        this.ma5Series.setData(maData(indicators.ma.ma5));
        this.ma10Series.setData(maData(indicators.ma.ma10));
        this.ma20Series.setData(maData(indicators.ma.ma20));
        this.ma60Series.setData(maData(indicators.ma.ma60));

        // 成交量
        const volumeData = klines.map(k => {
            const color = k.close >= k.open
                ? 'rgba(0, 212, 170, 0.4)'
                : 'rgba(255, 68, 102, 0.4)';
            return { time: k.time, value: k.volume, color };
        });
        this.volumeSeries.setData(volumeData);

        // MACD
        const macdHistData = klines.map((k, i) => {
            if (indicators.macd.histogram[i] === null) return { time: k.time };
            const val = indicators.macd.histogram[i];
            return {
                time: k.time,
                value: val,
                color: val >= 0 ? 'rgba(0, 212, 170, 0.5)' : 'rgba(255, 68, 102, 0.5)',
            };
        }).filter(d => d.value !== undefined);
        this.macdHistogram.setData(macdHistData);

        const macdLineData = (arr) => klines.map((k, i) => {
            if (arr[i] === null) return { time: k.time };
            return { time: k.time, value: arr[i] };
        }).filter(d => d.value !== undefined);

        this.macdDIF.setData(macdLineData(indicators.macd.dif));
        this.macdDEA.setData(macdLineData(indicators.macd.dea));

        // RSI
        const rsiData = klines.map((k, i) => {
            if (indicators.rsi.values[i] === null) return { time: k.time };
            return { time: k.time, value: indicators.rsi.values[i] };
        }).filter(d => d.value !== undefined);
        this.rsiSeries.setData(rsiData);

        // 自适应时间范围
        this.mainChart.timeScale().fitContent();
    },

    /**
     * 更新图表尺寸（容器大小变化时调用）
     */
    resize() {
        const mainEl = document.getElementById('chart-main');
        const volEl = document.getElementById('chart-volume');
        const macdEl = document.getElementById('chart-macd');
        const rsiEl = document.getElementById('chart-rsi');

        if (mainEl) this.mainChart.applyOptions({ width: mainEl.clientWidth });
        if (volEl) this.volumeChart.applyOptions({ width: volEl.clientWidth });
        if (macdEl) this.macdChart.applyOptions({ width: macdEl.clientWidth });
        if (rsiEl) this.rsiChart.applyOptions({ width: rsiEl.clientWidth });
    },

    /**
     * 移除所有图表
     */
    destroy() {
        if (this.mainChart) { this.mainChart.remove(); this.mainChart = null; }
        if (this.volumeChart) { this.volumeChart.remove(); this.volumeChart = null; }
        if (this.macdChart) { this.macdChart.remove(); this.macdChart = null; }
        if (this.rsiChart) { this.rsiChart.remove(); this.rsiChart = null; }
        this.mainSeries = null;
        this.volumeSeries = null;
        this.macdHistogram = null;
        this.macdDIF = null;
        this.macdDEA = null;
        this.rsiSeries = null;
        this.ma5Series = null;
        this.ma10Series = null;
        this.ma20Series = null;
        this.ma60Series = null;
    },
};
