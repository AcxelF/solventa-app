function parseHex(hex) {
  const clean = String(hex).replace("#", "");
  const value =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function tint(hex, factor) {
  const { r, g, b } = parseHex(hex);
  const to = (c) => Math.max(0, Math.min(255, Math.round(c * factor)));
  return `rgb(${to(r)}, ${to(g)}, ${to(b)})`;
}

export function readableOn(hex) {
  if (!hex) return "#FFFFFF";
  const { r, g, b } = parseHex(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (luminance > 0.62) return tint(hex, 0.4);
  return "#FFFFFF";
}
