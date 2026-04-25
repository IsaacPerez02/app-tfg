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

/** Convierte formato GDELT (YYYYMMDDHHMMSS) o ISO a Date. Devuelve null si inválido. */
export function parseNewsDate(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  let iso = raw;
  if (raw.length >= 14 && !raw.includes('T') && !raw.includes('-')) {
    iso = `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}T${raw.slice(8,10)}:${raw.slice(10,12)}:${raw.slice(12,14)}Z`;
  }
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export function timeAgo(date: Date | string | null | undefined): string {
  const d = date instanceof Date ? date : parseNewsDate(date as string);
  if (!d) return '';
  const seconds = Math.floor((new Date().getTime() - d.getTime()) / 1000);
  if (seconds < 60) return 'now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + 'm ago';

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';

  const days = Math.floor(hours / 24);
  if (days < 7) return days + 'd ago';

  return d.toLocaleDateString();
}
