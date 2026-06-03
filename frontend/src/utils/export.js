import html2canvas from "html2canvas";

/**
 * Export a DOM element as a PNG file.
 * @param {HTMLElement} el   - element to capture
 * @param {string}      name - filename without extension
 */
export async function exportPng(el, name = "chart") {
  const canvas = await html2canvas(el, {
    backgroundColor: "#0f1117", // match --bg
    scale: 2,                   // retina quality
    useCORS: true,
    logging: false,
  });
  const url  = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href     = url;
  link.download = `${name}.png`;
  link.click();
}

/**
 * Export an array of objects as a CSV file.
 * @param {object[]} rows    - data rows
 * @param {string[]} columns - keys to include (in order)
 * @param {object}   headers - { key: "Column Header" } overrides
 * @param {string}   name    - filename without extension
 */
export function exportCsv(rows, columns, headers = {}, name = "data") {
  if (!rows?.length) return;

  const headerRow = columns.map((c) => `"${headers[c] ?? c}"`).join(",");

  const dataRows = rows.map((r) =>
    columns
      .map((c) => {
        const v = r[c];
        if (v == null) return "";
        const s = String(v);
        // Quote if contains comma, newline, or double-quote
        return s.includes(",") || s.includes("\n") || s.includes('"')
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      })
      .join(",")
  );

  const csv  = [headerRow, ...dataRows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = `${name}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
