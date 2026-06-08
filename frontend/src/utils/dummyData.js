/**
 * Generates realistic dummy sensor readings with a diurnal pattern and a
 * genuine correlation between humidity→PM and temperature→PM (inverse).
 * Each reading is 5 minutes apart going back `count` steps from now.
 */
export function generateDummyReadings(count = 288) {
  const readings = [];
  const now      = Date.now();
  const step     = 5 * 60 * 1000; // 5 min

  for (let i = count - 1; i >= 0; i--) {
    const ts        = now - i * step;
    const hourOfDay = (new Date(ts).getHours()) + new Date(ts).getMinutes() / 60;

    // Diurnal temperature cycle — peaks ~14:00
    const diurnal   = 4 * Math.sin((hourOfDay - 6) * Math.PI / 12);
    const temp      = clamp(24 + diurnal  + rand(-0.4, 0.4), 14, 42);
    const hum       = clamp(70 - diurnal * 2.5 + rand(-1, 1), 25, 98);
    const btemp     = clamp(temp + rand(1.5, 3), 16, 50);
    const bhum      = clamp(hum  - rand(2, 6),   20, 95);

    // PM correlated with humidity (positive) and temp (negative)
    const pm25 = clamp(18 + (hum - 60) * 0.35 + (temp - 24) * -0.25 + rand(-2.5, 2.5), 2, 140);
    const pm1  = clamp(pm25 * rand(0.45, 0.62), 1, 90);
    const pm10 = clamp(pm25 * rand(1.55, 1.90), 3, 220);

    readings.push({
      id:          count - i,
      imei:        "000000000000000",
      received_at: new Date(ts).toISOString(),
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

function rand(min, max) { return Math.random() * (max - min) + min; }
function clamp(v, mn, mx) { return Math.min(Math.max(v, mn), mx); }
