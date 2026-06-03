/**
 * Generates realistic dummy sensor readings with a realistic correlation
 * between temperature/humidity and PM values (higher humidity → higher PM;
 * higher temp → slightly lower PM due to convection).
 *
 * Each reading is 5 minutes apart going back `count` steps from now.
 */
export function generateDummyReadings(count = 288) {
  const readings = [];
  const now = Date.now();
  const step = 5 * 60 * 1000; // 5 min

  // Base values
  let temp  = 24;
  let hum   = 62;
  let btemp = 26;
  let bhum  = 58;

  for (let i = count - 1; i >= 0; i--) {
    // Temperature drifts with a diurnal cycle + noise
    const hourOfDay = ((now - i * step) / 3600_000) % 24;
    const diurnal   = 4 * Math.sin((hourOfDay - 6) * Math.PI / 12); // peak ~18:00
    temp  = clamp(24 + diurnal + rand(-0.4, 0.4), 14, 42);
    hum   = clamp(70 - diurnal * 2.5 + rand(-1, 1), 25, 98); // inverse to temp
    btemp = clamp(temp + rand(1.5, 3), 16, 50);
    bhum  = clamp(hum  - rand(2, 6),   20, 95);

    // PM values: positively correlated with humidity, negatively with temp
    const humFactor  = (hum  - 60) * 0.35;   // higher hum → more PM
    const tempFactor = (temp - 24) * -0.25;   // higher temp → less PM
    const noise25    = rand(-2.5, 2.5);
    const pm25 = clamp(18 + humFactor + tempFactor + noise25, 2, 140);
    const pm1  = clamp(pm25 * rand(0.45, 0.62), 1, 90);
    const pm10 = clamp(pm25 * rand(1.55, 1.90), 3, 220);

    readings.push({
      id:          count - i,
      received_at: new Date(now - i * step).toISOString(),
      pm1_0:       +pm1.toFixed(1),
      pm2_5:       +pm25.toFixed(1),
      pm10:        +pm10.toFixed(1),
      shield_temp: +temp.toFixed(2),
      shield_hum:  +hum.toFixed(2),
      board_temp:  +btemp.toFixed(2),
      board_hum:   +bhum.toFixed(2),
    });
  }
  return readings;
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}
