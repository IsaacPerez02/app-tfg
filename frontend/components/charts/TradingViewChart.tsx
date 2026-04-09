import React, { useRef, useEffect, useMemo, useCallback } from 'react'
import { View, StyleSheet } from 'react-native'
import { WebView } from 'react-native-webview'

interface OHLCData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface TradingViewChartProps {
  data: OHLCData[]
  sma20?: (number | null)[]
  sma50?: (number | null)[]
  isDark?: boolean
  height?: number
}

function formatChartPayload(
  data: OHLCData[],
  sma20?: (number | null)[],
  sma50?: (number | null)[]
) {
  const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp)

  const candles = sorted.map(d => ({
    time: Math.floor(d.timestamp / 1000),
    open: d.open,
    high: d.high,
    low: d.low,
    close: d.close,
  }))

  const volumes = sorted.map(d => ({
    time: Math.floor(d.timestamp / 1000),
    value: d.volume,
    color: d.close >= d.open ? 'rgba(0,204,102,0.45)' : 'rgba(255,51,51,0.45)',
  }))

  const sma20Data = sorted
    .map((d, i) => {
      const v = sma20?.[i]
      if (v == null) return null
      return { time: Math.floor(d.timestamp / 1000), value: v }
    })
    .filter(Boolean)

  const sma50Data = sorted
    .map((d, i) => {
      const v = sma50?.[i]
      if (v == null) return null
      return { time: Math.floor(d.timestamp / 1000), value: v }
    })
    .filter(Boolean)

  return { candles, volumes, sma20Data, sma50Data }
}

function buildHTML(isDark: boolean): string {
  const bg = isDark ? '#0D0D0D' : '#FFFFFF'
  const text = isDark ? '#888888' : '#555555'
  const grid = isDark ? '#1C1C1C' : '#F5F5F5'
  const border = isDark ? '#2A2A2A' : '#E0E0E0'
  const tooltipBg = isDark ? 'rgba(18,18,18,0.95)' : 'rgba(255,255,255,0.97)'
  const tooltipBorder = isDark ? '#333' : '#ddd'
  const tooltipText = isDark ? '#fff' : '#111'
  const tooltipLabel = isDark ? '#666' : '#aaa'

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
  <script src="https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%;background:${bg};overflow:hidden}
    #chart{width:100%;height:100%}
    #tip{
      position:fixed;top:8px;left:8px;
      background:${tooltipBg};border:1px solid ${tooltipBorder};
      border-radius:6px;padding:5px 10px;
      font-family:-apple-system,BlinkMacSystemFont,sans-serif;
      font-size:11px;color:${tooltipText};
      display:none;gap:10px;z-index:100;pointer-events:none;
      align-items:center;
    }
    .tl{color:${tooltipLabel};margin-right:2px}
    #legend{
      position:fixed;bottom:30px;left:8px;
      display:flex;gap:10px;align-items:center;
      font-family:-apple-system,sans-serif;font-size:10px;
    }
    .li{display:flex;align-items:center;gap:4px;color:${text}}
    .ld{width:14px;height:2px;border-radius:2px}
  </style>
</head>
<body>
  <div id="chart"></div>
  <div id="tip"></div>
  <div id="legend">
    <div class="li"><div class="ld" style="background:#FF9500"></div>SMA 20</div>
    <div class="li"><div class="ld" style="background:#0099FF"></div>SMA 50</div>
  </div>
  <script>
    var chart = LightweightCharts.createChart(document.getElementById('chart'), {
      layout: {
        background: { type: 'solid', color: '${bg}' },
        textColor: '${text}',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '${grid}' },
        horzLines: { color: '${grid}' },
      },
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: '${border}',
        scaleMargins: { top: 0.08, bottom: 0.25 },
      },
      timeScale: {
        borderColor: '${border}',
        timeVisible: true,
        secondsVisible: false,
      },
      width: window.innerWidth,
      height: window.innerHeight,
    });

    var cs = chart.addCandlestickSeries({
      upColor: '#00CC66',
      downColor: '#FF3333',
      borderUpColor: '#00CC66',
      borderDownColor: '#FF3333',
      wickUpColor: '#00CC66',
      wickDownColor: '#FF3333',
    });

    var vs = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    chart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
      visible: false,
    });

    var s20 = chart.addLineSeries({
      color: '#FF9500',
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    var s50 = chart.addLineSeries({
      color: '#0099FF',
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    var tip = document.getElementById('tip');
    chart.subscribeCrosshairMove(function(p) {
      if (!p.point || !p.time) { tip.style.display = 'none'; return; }
      var c = p.seriesData.get(cs);
      if (!c) return;
      var col = c.close >= c.open ? '#00CC66' : '#FF3333';
      tip.style.display = 'flex';
      tip.innerHTML =
        '<span><span class="tl">O</span><span style="color:'+col+'">'+c.open.toFixed(2)+'</span></span>' +
        '<span><span class="tl">H</span><span style="color:#00CC66">'+c.high.toFixed(2)+'</span></span>' +
        '<span><span class="tl">L</span><span style="color:#FF3333">'+c.low.toFixed(2)+'</span></span>' +
        '<span><span class="tl">C</span><span style="color:'+col+'">'+c.close.toFixed(2)+'</span></span>';
    });

    window.updateChart = function(candles, volumes, sma20d, sma50d) {
      cs.setData(candles);
      vs.setData(volumes);
      if (sma20d && sma20d.length > 0) s20.setData(sma20d);
      if (sma50d && sma50d.length > 0) s50.setData(sma50d);
      chart.timeScale().fitContent();
    };

    window.addEventListener('resize', function() {
      chart.applyOptions({ width: window.innerWidth, height: window.innerHeight });
    });

    // Signal ready
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
    }
  </script>
</body>
</html>`
}

export function TradingViewChart({
  data,
  sma20,
  sma50,
  isDark = false,
  height = 380,
}: TradingViewChartProps) {
  const webviewRef = useRef<WebView>(null)
  const loadedRef = useRef(false)
  const latestRef = useRef({ data, sma20, sma50 })

  useEffect(() => {
    latestRef.current = { data, sma20, sma50 }
  }, [data, sma20, sma50])

  const html = useMemo(() => buildHTML(isDark), [isDark])

  const injectData = useCallback((d: OHLCData[], s20?: (number | null)[], s50?: (number | null)[]) => {
    if (!webviewRef.current || d.length === 0) return
    const { candles, volumes, sma20Data, sma50Data } = formatChartPayload(d, s20, s50)
    const script = `
      if (typeof window.updateChart === 'function') {
        window.updateChart(
          ${JSON.stringify(candles)},
          ${JSON.stringify(volumes)},
          ${JSON.stringify(sma20Data)},
          ${JSON.stringify(sma50Data)}
        );
      }
      true;
    `
    webviewRef.current.injectJavaScript(script)
  }, [])

  const handleMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data)
      if (msg.type === 'ready') {
        loadedRef.current = true
        const { data: d, sma20: s20, sma50: s50 } = latestRef.current
        injectData(d, s20, s50)
      }
    } catch (_) {}
  }, [injectData])

  useEffect(() => {
    if (loadedRef.current) {
      injectData(data, sma20, sma50)
    }
  }, [data, sma20, sma50, injectData])

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webviewRef}
        source={{ html }}
        style={styles.webview}
        onMessage={handleMessage}
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

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
})