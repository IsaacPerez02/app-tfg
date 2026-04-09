export function formatPrice(price: number, decimals: number = 2): string {
  return '$' + price.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(percent: number): string {
  const sign = percent > 0 ? '+' : '';
  return sign + percent.toFixed(2) + '%';
}

export function formatVolume(volume: number): string {
  if (volume >= 1e9) return '$' + (volume / 1e9).toFixed(2) + 'B';
  if (volume >= 1e6) return '$' + (volume / 1e6).toFixed(2) + 'M';
  if (volume >= 1e3) return '$' + (volume / 1e3).toFixed(2) + 'K';
  return '$' + volume.toFixed(2);
}

export function formatMarketCap(cap: number): string {
  if (cap >= 1e12) return '$' + (cap / 1e12).toFixed(2) + 'T';
  if (cap >= 1e9) return '$' + (cap / 1e9).toFixed(2) + 'B';
  if (cap >= 1e6) return '$' + (cap / 1e6).toFixed(2) + 'M';
  return '$' + cap.toFixed(2);
}

export function getChangeColor(change: number, isDark: boolean): string {
  if (change > 0) return '#00CC66';
  if (change < 0) return '#FF3333';
  return isDark ? '#CCCCCC' : '#666666';
}

export function timeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + 'm ago';

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';

  const days = Math.floor(hours / 24);
  if (days < 7) return days + 'd ago';

  return date.toLocaleDateString();
}
