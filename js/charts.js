/* ============================================================
   TGC Rongai Campus Tracker — Charts
   Hand-rolled SVG bar/line charts. No charting library, no CDN —
   consistent with the rest of the app's offline-first design.
   ============================================================ */

// Registry of the data points currently shown for each report, so a click
// on a bar/marker can look up which soul IDs it represents.
window.__reportPoints = window.__reportPoints || {};

function renderChartSVG(reportId, points, type, options) {
  options = options || {};
  const target = options.target;
  window.__reportPoints[reportId] = points;

  if (!points || points.length === 0) {
    return `<div class="empty-state"><div class="glyph">📊</div>No data to show yet.</div>`;
  }

  const maxVal = Math.max(1, target || 0, ...points.map((p) => p.value));
  const height = 260;
  const marginTop = 24, marginBottom = 54, marginLeft = 40, marginRight = 20;
  const innerHeight = height - marginTop - marginBottom;
  const slot = points.length <= 6 ? 90 : 66;
  const innerWidth = Math.max(320, points.length * slot);
  const width = innerWidth + marginLeft + marginRight;
  const baseY = marginTop + innerHeight;

  const xAt = (i) => marginLeft + (i + 0.5) * (innerWidth / points.length);
  const yAt = (v) => marginTop + innerHeight - (v / maxVal) * innerHeight;

  let grid = "";
  [0, 0.25, 0.5, 0.75, 1].forEach((f) => {
    const y = marginTop + innerHeight - f * innerHeight;
    const val = Math.round(f * maxVal);
    grid += `<line x1="${marginLeft}" y1="${y}" x2="${marginLeft + innerWidth}" y2="${y}" class="chart-grid"/>`;
    grid += `<text x="${marginLeft - 8}" y="${y + 4}" class="chart-axislabel" text-anchor="end">${val}</text>`;
  });

  let labels = "";
  points.forEach((p, i) => {
    const x = xAt(i);
    const raw = String(p.label || "");
    const label = raw.length > 13 ? raw.slice(0, 12) + "…" : raw;
    labels += `<text x="${x}" y="${baseY + 20}" class="chart-label" text-anchor="middle"><title>${raw}</title>${label}</text>`;
  });

  let marks = "";
  if (type === "bar") {
    const barW = (innerWidth / points.length) * 0.55;
    points.forEach((p, i) => {
      const x = xAt(i) - barW / 2;
      const y = yAt(p.value);
      const h = baseY - y;
      marks += `<rect x="${x}" y="${y}" width="${barW}" height="${Math.max(h, 1)}" rx="4" class="chart-bar" onclick="handleChartClick('${reportId}', '${String(p.key).replace(/'/g, "\\'")}')"><title>${p.label}: ${p.value}</title></rect>`;
      marks += `<text x="${xAt(i)}" y="${y - 8}" class="chart-value" text-anchor="middle">${p.value}</text>`;
    });
  } else {
    const linePts = points.map((p, i) => `${xAt(i)},${yAt(p.value)}`).join(" ");
    marks += `<polyline points="${linePts}" class="chart-line"/>`;
    points.forEach((p, i) => {
      const x = xAt(i), y = yAt(p.value);
      marks += `<circle cx="${x}" cy="${y}" r="6" class="chart-dot" onclick="handleChartClick('${reportId}', '${String(p.key).replace(/'/g, "\\'")}')"><title>${p.label}: ${p.value}</title></circle>`;
      marks += `<text x="${x}" y="${y - 12}" class="chart-value" text-anchor="middle">${p.value}</text>`;
    });
  }

  let targetLine = "";
  if (target) {
    const ty = yAt(target);
    targetLine = `
      <line x1="${marginLeft}" y1="${ty}" x2="${marginLeft + innerWidth}" y2="${ty}" class="chart-target-line"/>
      <text x="${marginLeft + innerWidth - 4}" y="${ty - 6}" class="chart-target-label" text-anchor="end">Target: ${target}</text>
    `;
  }

  return `
    <div style="overflow-x:auto;">
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block;">
        ${grid}
        <line x1="${marginLeft}" y1="${baseY}" x2="${marginLeft + innerWidth}" y2="${baseY}" class="chart-axis"/>
        ${marks}
        ${targetLine}
        ${labels}
      </svg>
    </div>
  `;
}

// Dual-series comparison chart: New Souls Won vs Already Born Again (with
// Total People Reached implicit as the stacked height / a third line).
// Each series' bars/dots register their own clickable sub-point so the
// existing handleChartClick() drill-down works unchanged.
function renderComparisonChartSVG(reportId, buckets, type) {
  const clickPoints = [];
  buckets.forEach((b) => {
    clickPoints.push({ key: `${b.key}::new`, label: `New Souls Won — ${b.label}`, value: b.newSouls, soulIds: b.newSoulIds });
    clickPoints.push({ key: `${b.key}::aba`, label: `Already Born Again — ${b.label}`, value: b.aba, soulIds: b.abaIds });
    clickPoints.push({ key: `${b.key}::total`, label: `Total People Reached — ${b.label}`, value: b.total, soulIds: b.totalIds });
  });
  window.__reportPoints[reportId] = clickPoints;

  if (!buckets || buckets.length === 0) {
    return `<div class="empty-state"><div class="glyph">📊</div>No data to show yet.</div>`;
  }

  const maxVal = Math.max(1, ...buckets.map((b) => b.total));
  const height = 280;
  const marginTop = 24, marginBottom = 54, marginLeft = 40, marginRight = 20;
  const innerHeight = height - marginTop - marginBottom;
  const slot = buckets.length <= 6 ? 100 : 74;
  const innerWidth = Math.max(320, buckets.length * slot);
  const width = innerWidth + marginLeft + marginRight;
  const baseY = marginTop + innerHeight;

  const xAt = (i) => marginLeft + (i + 0.5) * (innerWidth / buckets.length);
  const yAt = (v) => marginTop + innerHeight - (v / maxVal) * innerHeight;
  const esc = (s) => String(s).replace(/'/g, "\\'");

  let grid = "";
  [0, 0.25, 0.5, 0.75, 1].forEach((f) => {
    const y = marginTop + innerHeight - f * innerHeight;
    const val = Math.round(f * maxVal);
    grid += `<line x1="${marginLeft}" y1="${y}" x2="${marginLeft + innerWidth}" y2="${y}" class="chart-grid"/>`;
    grid += `<text x="${marginLeft - 8}" y="${y + 4}" class="chart-axislabel" text-anchor="end">${val}</text>`;
  });

  let labels = "";
  buckets.forEach((b, i) => {
    const x = xAt(i);
    const raw = String(b.label || "");
    const label = raw.length > 13 ? raw.slice(0, 12) + "…" : raw;
    labels += `<text x="${x}" y="${baseY + 20}" class="chart-label" text-anchor="middle"><title>${raw}</title>${label}</text>`;
  });

  let marks = "";
  if (type === "bar") {
    const barW = (innerWidth / buckets.length) * 0.5;
    buckets.forEach((b, i) => {
      const x = xAt(i) - barW / 2;
      const newTop = yAt(b.newSouls);
      const newH = baseY - newTop;
      const abaTopVal = b.newSouls + b.aba;
      const abaTop = yAt(abaTopVal);
      const abaH = newTop - abaTop;
      const totalTop = yAt(b.total);
      const carriedH = abaTop - totalTop;

      marks += `<rect x="${x}" y="${newTop}" width="${barW}" height="${Math.max(newH, 0.5)}" class="chart-bar" onclick="handleChartClick('${reportId}', '${esc(b.key)}::new')"><title>New Souls Won — ${b.label}: ${b.newSouls}</title></rect>`;
      if (b.aba > 0) {
        marks += `<rect x="${x}" y="${abaTop}" width="${barW}" height="${Math.max(abaH, 0.5)}" class="chart-bar-aba" onclick="handleChartClick('${reportId}', '${esc(b.key)}::aba')"><title>Already Born Again — ${b.label}: ${b.aba}</title></rect>`;
      }
      if (b.carriedOver > 0) {
        marks += `<rect x="${x}" y="${totalTop}" width="${barW}" height="${Math.max(carriedH, 0.5)}" class="chart-bar-carried"><title>Carried Over (before adopting this system) — ${b.label}: ${b.carriedOver}. Recorded in aggregate only, no individual details available.</title></rect>`;
      }
      marks += `<text x="${xAt(i)}" y="${totalTop - 8}" class="chart-value" text-anchor="middle">${b.total}</text>`;
    });
  } else {
    const totalPts = buckets.map((b, i) => `${xAt(i)},${yAt(b.total)}`).join(" ");
    const newPts = buckets.map((b, i) => `${xAt(i)},${yAt(b.newSouls)}`).join(" ");
    const abaPts = buckets.map((b, i) => `${xAt(i)},${yAt(b.aba)}`).join(" ");
    marks += `<polyline points="${totalPts}" class="chart-line-total"/>`;
    marks += `<polyline points="${newPts}" class="chart-line"/>`;
    marks += `<polyline points="${abaPts}" class="chart-line-aba"/>`;
    buckets.forEach((b, i) => {
      const x = xAt(i);
      marks += `<circle cx="${x}" cy="${yAt(b.total)}" r="5" class="chart-dot-total" onclick="handleChartClick('${reportId}', '${esc(b.key)}::total')"><title>Total People Reached — ${b.label}: ${b.total}</title></circle>`;
      marks += `<circle cx="${x}" cy="${yAt(b.newSouls)}" r="5" class="chart-dot" onclick="handleChartClick('${reportId}', '${esc(b.key)}::new')"><title>New Souls Won — ${b.label}: ${b.newSouls}</title></circle>`;
      marks += `<circle cx="${x}" cy="${yAt(b.aba)}" r="5" class="chart-dot-aba" onclick="handleChartClick('${reportId}', '${esc(b.key)}::aba')"><title>Already Born Again — ${b.label}: ${b.aba}</title></circle>`;
      if (b.carriedOver > 0) {
        marks += `<text x="${x}" y="${yAt(b.total) - 14}" class="chart-carried-label" text-anchor="middle">+${b.carriedOver} c/o</text>`;
      }
    });
  }

  const anyCarriedOver = buckets.some((b) => b.carriedOver > 0);

  return `
    <div class="chart-legend">
      <span><i class="legend-swatch legend-total"></i> Total People Reached</span>
      <span><i class="legend-swatch legend-new"></i> New Souls Won (New Soul + Rededicated)</span>
      <span><i class="legend-swatch legend-aba"></i> Already Born Again (no church home)</span>
      ${anyCarriedOver ? `<span><i class="legend-swatch legend-carried"></i> Carried over (before adopting this system)</span>` : ""}
    </div>
    <div style="overflow-x:auto;">
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block;">
        ${grid}
        <line x1="${marginLeft}" y1="${baseY}" x2="${marginLeft + innerWidth}" y2="${baseY}" class="chart-axis"/>
        ${marks}
        ${labels}
      </svg>
    </div>
  `;
}

// Small reusable chart-type toggle (Line / Bar), used by every report card.
function chartTypeToggleHTML(reportId, current, onChangeFn) {
  return `
    <div class="chart-toggle">
      <button class="btn btn-sm ${current === "line" ? "btn-primary" : "btn-ghost"}" onclick="${onChangeFn}('line')">Line</button>
      <button class="btn btn-sm ${current === "bar" ? "btn-primary" : "btn-ghost"}" onclick="${onChangeFn}('bar')">Bar</button>
    </div>
  `;
}
