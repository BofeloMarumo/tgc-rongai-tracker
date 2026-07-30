/* ============================================================
   TGC Rongai Campus Tracker — Dashboard (custom reports) tab
   ============================================================ */

const ReportState = {
  soulsWon: { granularity: "month", chartType: "line" },
  topWinners: { chartType: "bar", year: "", month: "" },
  followUpLoad: { chartType: "bar" },
  hotspotWeekly: { date: todayISO(), chartType: "bar" },
  custom: { groupBy: "month", chartType: "bar", year: "", month: "" },
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function yearOptionsHTML(selected) {
  const years = Store.availableYears();
  return `<option value="">All years</option>` +
    years.map((y) => `<option value="${y}" ${String(selected) === y ? "selected" : ""}>${y}</option>`).join("");
}

function monthOptionsHTML(selected) {
  return `<option value="">All months</option>` +
    MONTH_NAMES.map((name, i) => {
      const val = String(i + 1).padStart(2, "0");
      return `<option value="${val}" ${String(selected) === val ? "selected" : ""}>${name}</option>`;
    }).join("");
}

function groupByOptionsHTML(selected) {
  const opts = [
    ["month", "Month won"],
    ["year", "Year won"],
    ["hotspot", "Hotspot"],
    ["plugInStage", "Plug-In stage"],
    ["status", "Status of winning"],
    ["wonBy", "Won by"],
    ["followUp", "Follow-up member"],
  ];
  return opts.map(([val, label]) => `<option value="${val}" ${selected === val ? "selected" : ""}>${label}</option>`).join("");
}

function renderReportsTab() {
  const el = document.getElementById("view-reports");

  // ---- Report 1: Souls Won Over Time (New Souls vs Already Born Again) ----
  const swBuckets = Store.soulsWonSeries(ReportState.soulsWon.granularity);
  const swChart = renderComparisonChartSVG("soulsWon", swBuckets, ReportState.soulsWon.chartType);
  const allTime = Store.totalSoulsWonAllTime();

  // ---- Report 2: Top Person Winning Souls ----
  const twPoints = Store.topSoulWinners({ year: ReportState.topWinners.year, month: ReportState.topWinners.month }).slice(0, 10);
  const twChart = renderChartSVG("topWinners", twPoints, ReportState.topWinners.chartType);

  // ---- Report 3: Souls Won by Follow-Up Person ----
  const flPoints = Store.followUpLoad();
  const flChart = renderChartSVG("followUpLoad", flPoints, ReportState.followUpLoad.chartType);

  // ---- Report 4: Souls Won by Hotspot, Per Week (Mon–Sun), with target ----
  const weekly = Store.hotspotWeeklyCounts(ReportState.hotspotWeekly.date);
  const hwChart = renderChartSVG("hotspotWeekly", weekly.points, ReportState.hotspotWeekly.chartType, { target: weekly.target });

  // ---- Custom report builder ----
  const customPoints = Store.customReport({
    groupBy: ReportState.custom.groupBy,
    year: ReportState.custom.year,
    month: ReportState.custom.month,
  });
  const customChart = renderChartSVG("custom", customPoints, ReportState.custom.chartType);

  el.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div>
          <h2>1. Souls Won Over Time</h2>
          <div class="sub">Total People Reached, split into New Souls Won (New Soul + Rededicated Their Life) vs Already Born Again (saved already, but without a church home). Click any bar/marker to see who's behind it.</div>
        </div>
        ${chartTypeToggleHTML("soulsWon", ReportState.soulsWon.chartType, "setSoulsWonChartType")}
      </div>
      <div class="stat-strip" style="margin-bottom:14px;">
        <div class="stat good"><div class="num">${allTime.total}</div><div class="label">Total Souls Won (all-time)</div></div>
        <div class="stat"><div class="num">${allTime.recorded}</div><div class="label">Recorded in this system</div></div>
        <div class="stat warn"><div class="num">${allTime.previous}</div><div class="label">Previously recorded (carried over)</div></div>
      </div>
      <div class="report-controls">
        <select onchange="setSoulsWonGranularity(this.value)">
          <option value="month" ${ReportState.soulsWon.granularity === "month" ? "selected" : ""}>Month on month</option>
          <option value="year" ${ReportState.soulsWon.granularity === "year" ? "selected" : ""}>Year on year</option>
        </select>
      </div>
      <div class="sub" style="margin-bottom:10px;">${allTime.previous > 0 ? `Carried-over totals are tracked per year (Members &amp; Settings) and only ever count toward their own year — they show up as a grey segment when viewing "Year on year" for that specific year, and never in "Month on month" or in other years.` : ""}</div>
      ${swChart}
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <h2>2. Top Person Winning Souls</h2>
          <div class="sub">Who has won the most souls, filterable by month and year.</div>
        </div>
        ${chartTypeToggleHTML("topWinners", ReportState.topWinners.chartType, "setTopWinnersChartType")}
      </div>
      <div class="report-controls">
        <select onchange="setTopWinnersYear(this.value)">${yearOptionsHTML(ReportState.topWinners.year)}</select>
        <select onchange="setTopWinnersMonth(this.value)">${monthOptionsHTML(ReportState.topWinners.month)}</select>
      </div>
      ${twChart}
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <h2>3. Souls Won by Follow-Up Person</h2>
          <div class="sub">How many people each Hotspot Leader currently has to follow up with (excludes those already on the Service Team).</div>
        </div>
        ${chartTypeToggleHTML("followUpLoad", ReportState.followUpLoad.chartType, "setFollowUpLoadChartType")}
      </div>
      ${flChart}
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <h2>4. Souls Won by Hotspot, Per Week</h2>
          <div class="sub">Week of <strong>${weekly.mondayISO}</strong> (Mon) – <strong>${weekly.sundayISO}</strong> (Sun). Counted by the hotspot of whoever <em>won</em> each soul (their own hotspot as a leader), not the hotspot the new convert was assigned to. Dashed line marks the weekly target of ${weekly.target} souls per hotspot — adjust it in Members &amp; Settings. Click a bar to see who was won.</div>
        </div>
        ${chartTypeToggleHTML("hotspotWeekly", ReportState.hotspotWeekly.chartType, "setHotspotWeeklyChartType")}
      </div>
      <div class="report-controls">
        <button class="btn btn-ghost btn-sm" onclick="shiftHotspotWeek(-7)">‹ Previous week</button>
        <input type="date" value="${ReportState.hotspotWeekly.date}" onchange="setHotspotWeekDate(this.value)">
        <button class="btn btn-ghost btn-sm" onclick="shiftHotspotWeek(7)">Next week ›</button>
      </div>
      ${hwChart}
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <h2>Build a Custom Report</h2>
          <div class="sub">Group every soul won by whichever field matters right now, with optional month/year filtering.</div>
        </div>
        ${chartTypeToggleHTML("custom", ReportState.custom.chartType, "setCustomChartType")}
      </div>
      <div class="report-controls">
        <select onchange="setCustomGroupBy(this.value)">${groupByOptionsHTML(ReportState.custom.groupBy)}</select>
        <select onchange="setCustomYear(this.value)">${yearOptionsHTML(ReportState.custom.year)}</select>
        <select onchange="setCustomMonth(this.value)">${monthOptionsHTML(ReportState.custom.month)}</select>
      </div>
      ${customChart}
    </div>
  `;
}

// ---------------- State setters (each just updates state + re-renders) ----------------
function setSoulsWonGranularity(val) { ReportState.soulsWon.granularity = val; renderReportsTab(); }
function setSoulsWonChartType(val) { ReportState.soulsWon.chartType = val; renderReportsTab(); }

function setTopWinnersYear(val) { ReportState.topWinners.year = val; renderReportsTab(); }
function setTopWinnersMonth(val) { ReportState.topWinners.month = val; renderReportsTab(); }
function setTopWinnersChartType(val) { ReportState.topWinners.chartType = val; renderReportsTab(); }

function setFollowUpLoadChartType(val) { ReportState.followUpLoad.chartType = val; renderReportsTab(); }

function setHotspotWeekDate(val) { ReportState.hotspotWeekly.date = val; renderReportsTab(); }
function setHotspotWeeklyChartType(val) { ReportState.hotspotWeekly.chartType = val; renderReportsTab(); }
function shiftHotspotWeek(days) {
  const d = new Date(ReportState.hotspotWeekly.date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  ReportState.hotspotWeekly.date = d.toISOString().slice(0, 10);
  renderReportsTab();
}

function setCustomGroupBy(val) { ReportState.custom.groupBy = val; renderReportsTab(); }
function setCustomYear(val) { ReportState.custom.year = val; renderReportsTab(); }
function setCustomMonth(val) { ReportState.custom.month = val; renderReportsTab(); }
function setCustomChartType(val) { ReportState.custom.chartType = val; renderReportsTab(); }

// ---------------- Click-to-drill-down floating card ----------------
// Registry letting other tabs (e.g. Archive) plug in their own drill-down
// renderer for a given reportId, since not every chart's markers represent
// soul records with the same fields. Falls back to the standard soul-based
// drill-down used by every report on this tab.
window.__reportDrilldownHandlers = window.__reportDrilldownHandlers || {};

function handleChartClick(reportId, key) {
  const points = window.__reportPoints[reportId] || [];
  const point = points.find((p) => String(p.key) === String(key));
  if (!point) return;
  const handler = window.__reportDrilldownHandlers[reportId] || openReportDrilldownModal;
  handler(point.label, point.soulIds);
}

function openReportDrilldownModal(title, soulIds) {
  const rows = Store.soulDetailRows(soulIds);
  const contactLabel = (days) => {
    if (days === null) return `<span class="badge badge-red">Never contacted</span>`;
    if (days === 0) return `<span class="badge badge-green">Today</span>`;
    return `${days} day${days === 1 ? "" : "s"} ago`;
  };

  const rowsHTML = rows.length
    ? rows.map((r) => `
        <tr>
          <td><strong>${r.name}</strong><br><span class="sub" style="font-size:.72rem;">${r.plugInStage}</span></td>
          <td>${contactLabel(r.daysSinceNote)}</td>
          <td>${r.followUp}</td>
          <td>${r.mobile}</td>
          <td style="max-width:240px;">${r.lastNote || "<span class='sub'>No notes logged</span>"}</td>
        </tr>`).join("")
    : `<tr><td colspan="5"><div class="empty-state">No one in this group.</div></td></tr>`;

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal" style="max-width:820px;">
      <h3>${title}</h3>
      <div class="sub">${rows.length} soul${rows.length === 1 ? "" : "s"}</div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Name / Stage</th><th>Last contacted</th><th>Follow-up person</th><th>Mobile</th><th>Last note</th></tr></thead>
          <tbody>${rowsHTML}</tbody>
        </table>
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" onclick="closeModal()">Close</button>
      </div>
    </div>
  `;
  document.getElementById("modalOverlay").classList.add("open");
}
