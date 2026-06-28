/** Parse a single latitude or longitude field (decimal degrees). Rejects partial/garbage suffixes. */
export function parseCoordField(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(',', '.');
  if (!/^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) return null;
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}
