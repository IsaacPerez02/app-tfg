/**
 * TradingViewChart — Apache ECharts (no TradingView dependency)
 * Works on web (iframe + postMessage) and native (WebView + injectJavaScript).
 */
import React, { useRef, useEffect, useMemo, useCallback } from 'react'
import { View, StyleSheet, Platform } from 'react-native'
import { MarketCandle, MarketIndicators } from '@/types'

let WebView: any = null
if (Platform.OS !== 'web') {
  WebView = require('react-native-webview').WebView
}

export interface TradingViewChartProps {
  candles:    MarketCandle[]
  indicators: MarketIndicators[]
  isDark?:    boolean
  height?:    number
}

// ── Data helpers ──────────────────────────────────────────────────────────────

function toUnixMs(ts: string | number): number {
  if (typeof ts === 'number') return ts > 1e12 ? ts : ts * 1000
  return new Date(ts).getTime()
}

function buildPayload(candles: MarketCandle[], indicators: MarketIndicators[]) {
  const sorted = [...candles].sort((a, b) => toUnixMs(a.timestamp) - toUnixMs(b.timestamp))

  const dates:   string[] = []
  const ohlc:    number[][] = []
  const volumes: number[] = []
  const volColors: string[] = []

  for (const c of sorted) {
    const d = new Date(toUnixMs(c.timestamp))
    dates.push(d.toISOString())
    ohlc.push([c.open, c.close, c.low, c.high])
    volumes.push(c.volume)
    volColors.push(c.close >= c.open ? '#00c896' : '#ff4d6d')
  }

  // Build indicator arrays aligned to sorted candles
  const indByTs: Record<number, MarketIndicators> = {}
  for (const ind of indicators) {
    const t = Math.round(toUnixMs(ind.timestamp) / 60000) * 60000
    indByTs[t] = ind
  }

  const ema20:  (number | null)[] = []
  const ema50:  (number | null)[] = []
  const ema200: (number | null)[] = []
  const bbUpper: (number | null)[] = []
  const bbLower: (number | null)[] = []
  const rsi:    (number | null)[] = []
  const macd:   (number | null)[] = []
  const macdSig:(number | null)[] = []
  const macdHist:(number | null)[] = []

  for (const c of sorted) {
    const t = Math.round(toUnixMs(c.timestamp) / 60000) * 60000
    const ind = indByTs[t]
    ema20.push(ind?.ema_20  ?? null)
    ema50.push(ind?.ema_50  ?? null)
    ema200.push(ind?.ema_200 ?? null)
    bbUpper.push(ind?.bollinger_upper ?? ind?.bb_upper ?? null)
    bbLower.push(ind?.bollinger_lower ?? ind?.bb_lower ?? null)
    rsi.push(ind?.rsi_14 ?? null)
    macd.push(ind?.macd ?? null)
    macdSig.push(ind?.macd_signal ?? null)
    macdHist.push(ind?.macd_hist ?? ind?.macd_histogram ?? null)
  }

  return { dates, ohlc, volumes, volColors, ema20, ema50, ema200, bbUpper, bbLower, rsi, macd, macdSig, macdHist }
}

// ── HTML ─────────────────────────────────────────────────────────────────────

function buildHTML(isDark: boolean): string {
  const bg      = isDark ? '#0D0D0D' : '#FFFFFF'
  const text    = isDark ? '#8E8E93' : '#555555'
  const grid    = isDark ? '#1E1E1E' : '#F2F2F2'
  const border  = isDark ? '#2C2C2E' : '#E5E5EA'
  const tooltip = isDark ? 'rgba(18,18,20,0.92)' : 'rgba(255,255,255,0.96)'

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=5.0">
<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:${bg};overflow:hidden}
#chart{width:100%;height:100%}
</style>
</head>
<body>
<div id="chart"></div>
<script>
var chart = echarts.init(document.getElementById('chart'), null, { renderer:'canvas' });

var UP   = '#00c896';
var DOWN = '#ff4d6d';
var BG   = '${bg}';
var TEXT = '${text}';
var GRID = '${grid}';
var BORDER = '${border}';
var TT   = '${tooltip}';

function makeOption(d) {
  var hasMacd = d.macd.some(function(v){ return v !== null; });
  var hasRsi  = d.rsi.some(function(v){ return v !== null; });

  // Grid layout: main (60%), volume (15%), rsi (12.5%), macd (12.5%)
  var grids = [
    { left:60, right:12, top:8, bottom:'42%' },           // 0 main
    { left:60, right:12, top:'62%', bottom:'28%' },        // 1 volume
  ];
  var xAxes = [
    { type:'category', data:d.dates, gridIndex:0, show:false, axisPointer:{ show:true } },
    { type:'category', data:d.dates, gridIndex:1, show:false, axisPointer:{ show:true } },
  ];
  var yAxes = [
    { scale:true, gridIndex:0, splitLine:{ lineStyle:{ color:GRID } }, axisLabel:{ color:TEXT, fontSize:10 }, axisLine:{ lineStyle:{ color:BORDER } } },
    { gridIndex:1, splitLine:{ show:false }, axisLabel:{ show:false }, axisLine:{ lineStyle:{ color:BORDER } } },
  ];
  var series = [
    {
      name:'Candles', type:'candlestick', xAxisIndex:0, yAxisIndex:0,
      data: d.ohlc,
      itemStyle:{ color:UP, color0:DOWN, borderColor:UP, borderColor0:DOWN },
      barMaxWidth: 12,
    },
    {
      name:'Volume', type:'bar', xAxisIndex:1, yAxisIndex:1,
      data: d.volumes.map(function(v,i){ return { value:v, itemStyle:{ color:d.volColors[i] } }; }),
      barMaxWidth:12,
    },
  ];

  // EMAs
  if (d.ema20.some(function(v){ return v!==null; })) {
    series.push({ name:'EMA20', type:'line', xAxisIndex:0, yAxisIndex:0, data:d.ema20, smooth:false, symbol:'none', lineStyle:{ color:'#00b4d8', width:1.5 }, z:3 });
  }
  if (d.ema50.some(function(v){ return v!==null; })) {
    series.push({ name:'EMA50', type:'line', xAxisIndex:0, yAxisIndex:0, data:d.ema50, smooth:false, symbol:'none', lineStyle:{ color:'#FF9500', width:1.5 }, z:3 });
  }
  if (d.ema200.some(function(v){ return v!==null; })) {
    series.push({ name:'EMA200', type:'line', xAxisIndex:0, yAxisIndex:0, data:d.ema200, smooth:false, symbol:'none', lineStyle:{ color:'#FF4757', width:1.5 }, z:3 });
  }
  if (d.bbUpper.some(function(v){ return v!==null; })) {
    series.push({ name:'BB Upper', type:'line', xAxisIndex:0, yAxisIndex:0, data:d.bbUpper, smooth:false, symbol:'none', lineStyle:{ color:'rgba(100,150,255,0.5)', width:1, type:'dashed' }, z:2 });
    series.push({ name:'BB Lower', type:'line', xAxisIndex:0, yAxisIndex:0, data:d.bbLower, smooth:false, symbol:'none', lineStyle:{ color:'rgba(100,150,255,0.5)', width:1, type:'dashed' }, z:2 });
  }

  // RSI
  if (hasRsi) {
    grids.push({ left:60, right:12, top: hasMacd ? '72%' : '72%', bottom: hasMacd ? '15%' : '3%' });
    var rsiGridIdx = grids.length - 1;
    xAxes.push({ type:'category', data:d.dates, gridIndex:rsiGridIdx, show:false, axisPointer:{ show:true } });
    yAxes.push({
      scale:false, gridIndex:rsiGridIdx,
      min:0, max:100,
      splitNumber:2,
      splitLine:{ lineStyle:{ color:GRID } },
      axisLabel:{ color:TEXT, fontSize:9 },
      axisLine:{ lineStyle:{ color:BORDER } },
    });
    var rsiYIdx = yAxes.length - 1;
    series.push({ name:'RSI', type:'line', xAxisIndex:rsiGridIdx, yAxisIndex:rsiYIdx, data:d.rsi, smooth:false, symbol:'none', lineStyle:{ color:'#a78bfa', width:1.5 } });
    series.push({ name:'OB', type:'line', xAxisIndex:rsiGridIdx, yAxisIndex:rsiYIdx, data:d.dates.map(function(){ return 70; }), symbol:'none', lineStyle:{ color:'rgba(255,77,109,0.4)', width:1, type:'dashed' } });
    series.push({ name:'OS', type:'line', xAxisIndex:rsiGridIdx, yAxisIndex:rsiYIdx, data:d.dates.map(function(){ return 30; }), symbol:'none', lineStyle:{ color:'rgba(0,200,150,0.4)', width:1, type:'dashed' } });
  }

  // MACD
  if (hasMacd) {
    grids.push({ left:60, right:12, top:'84%', bottom:'3%' });
    var macdGridIdx = grids.length - 1;
    xAxes.push({ type:'category', data:d.dates, gridIndex:macdGridIdx, show:true, axisLabel:{ color:TEXT, fontSize:9, formatter: function(v){ var dt=new Date(v); return (dt.getMonth()+1)+'/'+(dt.getDate()); } }, axisPointer:{ show:true } });
    yAxes.push({ scale:true, gridIndex:macdGridIdx, splitLine:{ lineStyle:{ color:GRID } }, axisLabel:{ color:TEXT, fontSize:9 }, axisLine:{ lineStyle:{ color:BORDER } } });
    var macdYIdx = yAxes.length - 1;
    series.push({ name:'MACD', type:'line', xAxisIndex:macdGridIdx, yAxisIndex:macdYIdx, data:d.macd, smooth:false, symbol:'none', lineStyle:{ color:'#00b4d8', width:1.5 } });
    series.push({ name:'Signal', type:'line', xAxisIndex:macdGridIdx, yAxisIndex:macdYIdx, data:d.macdSig, smooth:false, symbol:'none', lineStyle:{ color:'#FF9500', width:1 } });
    series.push({
      name:'Hist', type:'bar', xAxisIndex:macdGridIdx, yAxisIndex:macdYIdx,
      data: d.macdHist.map(function(v){ return { value:v, itemStyle:{ color: v >= 0 ? 'rgba(0,200,150,0.7)' : 'rgba(255,77,109,0.7)' } }; }),
      barMaxWidth: 8,
    });
  } else {
    // show x axis on volume if no macd
    xAxes[1].show = true;
    xAxes[1].axisLabel = { color:TEXT, fontSize:9, formatter: function(v){ var dt=new Date(v); return (dt.getMonth()+1)+'/'+(dt.getDate()); } };
  }

  // Adjust grids for presence of sub-charts
  if (!hasRsi && !hasMacd) {
    grids[0].bottom = '22%';
    grids[1].top = '80%';
    grids[1].bottom = '3%';
  } else if (hasRsi && !hasMacd) {
    grids[0].bottom = '42%';
    grids[1].top = '62%'; grids[1].bottom = '28%';
    grids[2].top  = '76%'; grids[2].bottom = '3%';
  } else if (!hasRsi && hasMacd) {
    grids[0].bottom = '32%';
    grids[1].top = '71%'; grids[1].bottom = '16%';
    grids[2].top  = '87%'; grids[2].bottom = '3%';
  }

  return {
    backgroundColor: BG,
    animation: false,
    tooltip: {
      trigger:'axis',
      axisPointer:{ type:'cross', crossStyle:{ color:TEXT } },
      backgroundColor: TT,
      borderColor: BORDER,
      textStyle:{ color: TEXT === '${text}' ? ('${text}' === '#8E8E93' ? '#fff' : '#111') : TEXT, fontSize:11 },
    },
    legend: {
      data:['EMA20','EMA50','EMA200'],
      top: 2, right: 12,
      textStyle:{ color:TEXT, fontSize:10 },
      itemWidth:14, itemHeight:3,
      selected:{ 'BB Upper':false, 'BB Lower':false, 'OB':false, 'OS':false, 'Hist':false }
    },
    axisPointer: { link:[{ xAxisIndex:'all' }] },
    dataZoom: [
      { type:'inside', xAxisIndex:[0,1,2,3,4].slice(0, grids.length), start:60, end:100, zoomOnMouseWheel:true, moveOnMouseMove:true, moveOnTouch:true },
      { type:'slider', xAxisIndex:[0,1,2,3,4].slice(0, grids.length), bottom:0, height:18, start:60, end:100, textStyle:{ color:TEXT, fontSize:9 }, borderColor:BORDER, fillerColor:'rgba(100,150,255,0.1)', handleStyle:{ color:'#00b4d8' } },
    ],
    grid:   grids,
    xAxis:  xAxes,
    yAxis:  yAxes,
    series: series,
  };
}

var currentData = null;

function applyData(d) {
  currentData = d;
  chart.setOption(makeOption(d), true);
}

// Listen for postMessage (web iframe) and ReactNativeWebView messages
window.addEventListener('message', function(e) {
  try {
    var msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
    if (msg && msg.type === 'update') applyData(msg.payload);
  } catch(_) {}
});

window.addEventListener('resize', function() {
  chart.resize();
});

// Signal ready
function signalReady() {
  var msg = JSON.stringify({ type:'ready' });
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
  else if (window.parent !== window) window.parent.postMessage(msg, '*');
}
signalReady();
</script>
</body>
</html>`
}

// ── Shared send logic ─────────────────────────────────────────────────────────

function makeMsg(candles: MarketCandle[], indicators: MarketIndicators[]): string {
  return JSON.stringify({ type: 'update', payload: buildPayload(candles, indicators) })
}

// ── Web (iframe) ──────────────────────────────────────────────────────────────

function WebChart({ candles, indicators, isDark, height }: TradingViewChartProps & { height: number }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const readyRef  = useRef(false)
  const latestRef = useRef({ candles, indicators })

  useEffect(() => { latestRef.current = { candles, indicators } }, [candles, indicators])

  const html = useMemo(() => buildHTML(isDark ?? false), [isDark])

  const send = useCallback((c: MarketCandle[], ind: MarketIndicators[]) => {
    if (!iframeRef.current?.contentWindow || c.length === 0) return
    iframeRef.current.contentWindow.postMessage(makeMsg(c, ind), '*')
  }, [])

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      try {
        const msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (msg?.type === 'ready') {
          readyRef.current = true
          send(latestRef.current.candles, latestRef.current.indicators)
        }
      } catch (_) {}
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [send])

  useEffect(() => {
    if (readyRef.current) send(candles, indicators)
  }, [candles, indicators, send])

  return (
    <div style={{ width: '100%', height, overflow: 'hidden' }}>
      <iframe
        ref={iframeRef}
        srcDoc={html}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  )
}

// ── Native (WebView) ──────────────────────────────────────────────────────────

function NativeChart({ candles, indicators, isDark, height }: TradingViewChartProps & { height: number }) {
  const wvRef    = useRef<any>(null)
  const readyRef = useRef(false)
  const latestRef = useRef({ candles, indicators })

  useEffect(() => { latestRef.current = { candles, indicators } }, [candles, indicators])

  const html = useMemo(() => buildHTML(isDark ?? false), [isDark])

  const inject = useCallback((c: MarketCandle[], ind: MarketIndicators[]) => {
    if (!wvRef.current || c.length === 0) return
    const msg = makeMsg(c, ind)
    wvRef.current.injectJavaScript(
      `(function(){window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(msg)}}));})();true;`
    )
  }, [])

  const onMessage = useCallback((e: any) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data)
      if (msg?.type === 'ready') {
        readyRef.current = true
        inject(latestRef.current.candles, latestRef.current.indicators)
      }
    } catch (_) {}
  }, [inject])

  useEffect(() => {
    if (readyRef.current) inject(candles, indicators)
  }, [candles, indicators, inject])

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={wvRef}
        source={{ html }}
        style={styles.webview}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        originWhitelist={['*']}
        mixedContentMode="always"
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────

export function TradingViewChart({ candles, indicators, isDark = false, height = 420 }: TradingViewChartProps) {
  if (Platform.OS === 'web') {
    return <WebChart candles={candles} indicators={indicators} isDark={isDark} height={height} />
  }
  return <NativeChart candles={candles} indicators={indicators} isDark={isDark} height={height} />
}

const styles = StyleSheet.create({
  container: { width: '100%', overflow: 'hidden' },
  webview:   { flex: 1, backgroundColor: 'transparent' },
})
