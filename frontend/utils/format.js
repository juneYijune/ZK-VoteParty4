export function shortAddress(addr) {
  if (!addr) return "";
  const s = String(addr);
  if (s.length <= 10) return s;
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
}
