export function formatDelay(seconds: number, options: { signed?: boolean } = {}): string {
  const { signed = false } = options;
  const isNegative = seconds < 0;
  const abs = Math.abs(Math.round(seconds));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const time = `${m}:${s.toString().padStart(2, "0")}`;
  if (signed) {
    return `${isNegative ? "-" : "+"}${time}`;
  }
  return isNegative ? `-${time}` : time;
}
