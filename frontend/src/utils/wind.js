const DIRS = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];

export function degreesToCompass(deg) {
  if (deg == null) return "—";
  const idx = Math.round(deg / 22.5) % 16;
  return DIRS[idx];
}

export function windBeaufort(kph) {
  if (kph == null) return { scale: "—", label: "—" };
  if (kph < 1)   return { scale: 0, label: "Calm" };
  if (kph < 6)   return { scale: 1, label: "Light air" };
  if (kph < 12)  return { scale: 2, label: "Light breeze" };
  if (kph < 20)  return { scale: 3, label: "Gentle breeze" };
  if (kph < 29)  return { scale: 4, label: "Moderate breeze" };
  if (kph < 39)  return { scale: 5, label: "Fresh breeze" };
  if (kph < 50)  return { scale: 6, label: "Strong breeze" };
  if (kph < 62)  return { scale: 7, label: "Near gale" };
  if (kph < 75)  return { scale: 8, label: "Gale" };
  if (kph < 89)  return { scale: 9, label: "Severe gale" };
  if (kph < 103) return { scale: 10, label: "Storm" };
  if (kph < 117) return { scale: 11, label: "Violent storm" };
  return { scale: 12, label: "Hurricane" };
}
