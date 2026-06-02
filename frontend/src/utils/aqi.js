/**
 * US EPA PM2.5 AQI breakpoints.
 */
export function getAqiLabel(pm2_5) {
  if (pm2_5 <= 12.0)  return "Good";
  if (pm2_5 <= 35.4)  return "Moderate";
  if (pm2_5 <= 55.4)  return "Unhealthy (Sensitive)";
  if (pm2_5 <= 150.4) return "Unhealthy";
  if (pm2_5 <= 250.4) return "Very Unhealthy";
  return "Hazardous";
}

export function getAqiColor(pm2_5) {
  if (pm2_5 <= 12.0)  return "#34d399"; // green
  if (pm2_5 <= 35.4)  return "#fbbf24"; // yellow
  if (pm2_5 <= 55.4)  return "#f97316"; // orange
  if (pm2_5 <= 150.4) return "#ef4444"; // red
  if (pm2_5 <= 250.4) return "#a855f7"; // purple
  return "#7f1d1d";                      // maroon
}
