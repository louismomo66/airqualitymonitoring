/**
 * Pearson correlation coefficient between two numeric arrays.
 * Returns null if fewer than 3 valid paired points.
 */
export function pearson(xs, ys) {
  const pairs = xs
    .map((x, i) => [x, ys[i]])
    .filter(([x, y]) => x != null && y != null && !isNaN(x) && !isNaN(y));

  const n = pairs.length;
  if (n < 3) return null;

  const mx = pairs.reduce((s, [x]) => s + x, 0) / n;
  const my = pairs.reduce((s, [, y]) => s + y, 0) / n;

  let num = 0, dx2 = 0, dy2 = 0;
  for (const [x, y] of pairs) {
    const dx = x - mx;
    const dy = y - my;
    num  += dx * dy;
    dx2  += dx * dx;
    dy2  += dy * dy;
  }

  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? null : num / denom;
}

/**
 * Human-readable interpretation of a Pearson r value.
 */
export function interpretR(r) {
  if (r === null) return { label: "Insufficient data", color: "#64748b" };
  const abs = Math.abs(r);
  const dir = r > 0 ? "positive" : "negative";
  if (abs >= 0.7)  return { label: `Strong ${dir}`,   color: r > 0 ? "#ef4444" : "#60a5fa" };
  if (abs >= 0.4)  return { label: `Moderate ${dir}`, color: r > 0 ? "#f97316" : "#818cf8" };
  if (abs >= 0.2)  return { label: `Weak ${dir}`,     color: r > 0 ? "#fbbf24" : "#a78bfa" };
  return { label: "No correlation", color: "#64748b" };
}

/**
 * Simple linear regression — returns { slope, intercept }.
 */
export function linearRegression(xs, ys) {
  const pairs = xs
    .map((x, i) => [x, ys[i]])
    .filter(([x, y]) => x != null && y != null && !isNaN(x) && !isNaN(y));

  const n = pairs.length;
  if (n < 2) return null;

  const mx = pairs.reduce((s, [x]) => s + x, 0) / n;
  const my = pairs.reduce((s, [, y]) => s + y, 0) / n;

  let num = 0, den = 0;
  for (const [x, y] of pairs) {
    num += (x - mx) * (y - my);
    den += (x - mx) ** 2;
  }

  const slope     = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  return { slope, intercept };
}

/**
 * Generate regression line points spanning [minX, maxX].
 */
export function regressionLine(xs, ys, steps = 50) {
  const reg = linearRegression(xs, ys);
  if (!reg) return [];

  const valid = xs.filter((x, i) => x != null && ys[i] != null);
  const minX  = Math.min(...valid);
  const maxX  = Math.max(...valid);
  const range = maxX - minX;

  return Array.from({ length: steps }, (_, k) => {
    const x = minX + (range * k) / (steps - 1);
    return { x: +x.toFixed(2), y: +(reg.slope * x + reg.intercept).toFixed(2) };
  });
}
