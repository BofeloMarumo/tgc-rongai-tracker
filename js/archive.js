/* ============================================================
   TGC Rongai Campus Tracker — Archive tab
   ============================================================ */

const ArchiveReportState = {
  souls: { granularity: "month", chartType: "line" },
  members: { granularity: "month", chartType: "bar" },
};

function renderArchiveTab() {
  const el = document.getElementById("view-archive");
  const archivedSouls = Store.archivedSouls();
  const archivedMembers = Store.archivedChurchMembers();

  // ---- Archived Souls table ----
  let soulRowsHTML = "";
  if (archivedSouls.length === 0) {
    soulRowsHTML = `<tr><td colspan="6"><div class="empty-state"><div class="glyph">🗄️</div>No archived souls yet.</div></td></tr>`;
  } else {
    archivedSouls.forEach((rec) => {
      const engagement = Store.lastPhysicalEngagement(rec);
      soulRowsHTML += `
        <tr>
          <td><strong>${rec.name}</strong></td>
          <td style="max-width:220px;">${rec.context || ""}</td>
          <td><span class="badge badge-yellow">${rec.archiveReasonCategory || "—"}</span></td>
          <td style="max-width:220px;">${rec.archiveReasonText || ""}</td>
          <td>${engagement.label}</td>
          <td><button class="btn btn-ghost btn-sm" onclick="unarchiveSoulRow('${rec.id}')">Unarchive</button></td>
        </tr>`;
    });
  }

  // ---- Archived Church Members table ----
  let memberRowsHTML = "";
  if (archivedMembers.length === 0) {
    memberRowsHTML = `<tr><td colspan="6"><div class="empty-state"><div class="glyph">🗄️</div>No archived church members yet.</div></td></tr>`;
  } else {
    archivedMembers.forEach((cm) => {
      memberRowsHTML += `
        <tr>
          <td><strong>${cm.name}</strong></td>
          <td style="max-width:220px;">${cm.notes || ""}</td>
          <td><span class="badge badge-yellow">${cm.archiveReasonCategory || "—"}</span></td>
          <td style="max-width:220px;">${cm.archiveReasonText || ""}</td>
          <td>${Store.hotspotName(cm.hotspotId)}</td>
          <td><button class="btn btn-ghost btn-sm" onclick="unarchiveChurchMemberRow('${cm.id}')">Unarchive</button></td>
        </tr>`;
    });
  }

  // ---- Reports: Archived Souls / Archived Members over time ----
  const soulSeries = Store.archivedSoulsSeries(ArchiveReportState.souls.granularity);
  const soulChart = renderChartSVG("archivedSouls", soulSeries, ArchiveReportState.souls.chartType);
  window.__reportDrilldownHandlers.archivedSouls = openArchivedSoulsDrilldown;

  const memberSeries = Store.archivedMembersSeries(ArchiveReportState.members.granularity);
  const memberChart = renderChartSVG("archivedMembers", memberSeries, ArchiveReportState.members.chartType);
  window.__reportDrilldownHandlers.archivedMembers = openArchivedMembersDrilldown;

  el.innerHTML = `
    <div class="stat-strip">
      <div class="stat warn"><div class="num">${archivedSouls.length}</div><div class="label">Archived souls</div></div>
      <div class="stat"><div class="num">${archivedMembers.length}</div><div class="label">Archived church members</div></div>
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <h2>Archived Souls</h2>
          <div class="sub">Removed from the active Follow-Up Radar — nothing here was deleted, and any of these can be unarchived at any time.</div>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Name</th><th>Context</th><th>Archive reason category</th><th>Archive reason</th><th>Last physical engagement</th><th></th></tr></thead>
          <tbody>${soulRowsHTML}</tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <h2>Archived Church Members</h2>
          <div class="sub">Removed from the active Church Member Report — nothing here was deleted.</div>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Name</th><th>Notes</th><th>Archive reason category</th><th>Archive reason</th><th>Hotspot</th><th></th></tr></thead>
          <tbody>${memberRowsHTML}</tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <h2>Archived Souls Over Time</h2>
          <div class="sub">When souls were archived, month by month or year by year. Click a bar/marker to see who and why.</div>
        </div>
        ${chartTypeToggleHTML("archivedSouls", ArchiveReportState.souls.chartType, "setArchivedSoulsChartType")}
      </div>
      <div class="report-controls">
        <select onchange="setArchivedSoulsGranularity(this.value)">
          <option value="month" ${ArchiveReportState.souls.granularity === "month" ? "selected" : ""}>Month on month</option>
          <option value="year" ${ArchiveReportState.souls.granularity === "year" ? "selected" : ""}>Year on year</option>
        </select>
      </div>
      ${soulChart}
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <h2>Archived Church Members Over Time</h2>
          <div class="sub">When church members were archived, month by month or year by year. Click a bar/marker to see who and why.</div>
        </div>
        ${chartTypeToggleHTML("archivedMembers", ArchiveReportState.members.chartType, "setArchivedMembersChartType")}
      </div>
      <div class="report-controls">
        <select onchange="setArchivedMembersGranularity(this.value)">
          <option value="month" ${ArchiveReportState.members.granularity === "month" ? "selected" : ""}>Month on month</option>
          <option value="year" ${ArchiveReportState.members.granularity === "year" ? "selected" : ""}>Year on year</option>
        </select>
      </div>
      ${memberChart}
    </div>
  `;
}

function setArchivedSoulsGranularity(val) { ArchiveReportState.souls.granularity = val; renderArchiveTab(); }
function setArchivedSoulsChartType(val) { ArchiveReportState.souls.chartType = val; renderArchiveTab(); }
function setArchivedMembersGranularity(val) { ArchiveReportState.members.granularity = val; renderArchiveTab(); }
function setArchivedMembersChartType(val) { ArchiveReportState.members.chartType = val; renderArchiveTab(); }

function openArchivedSoulsDrilldown(title, ids) {
  const rows = Store.archivedSoulDetailRows(ids);
  renderArchiveDrilldownModal(title, rows);
}

function openArchivedMembersDrilldown(title, ids) {
  const rows = Store.archivedMemberDetailRows(ids);
  renderArchiveDrilldownModal(title, rows);
}

function renderArchiveDrilldownModal(title, rows) {
  const rowsHTML = rows.length
    ? rows.map((r) => `
        <tr>
          <td><strong>${r.name}</strong></td>
          <td><span class="badge badge-yellow">${r.category}</span></td>
          <td style="max-width:320px;">${r.reasonText || "<span class='sub'>No details recorded</span>"}</td>
        </tr>`).join("")
    : `<tr><td colspan="3"><div class="empty-state">No one in this group.</div></td></tr>`;

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal" style="max-width:720px;">
      <h3>${title}</h3>
      <div class="sub">${rows.length} archived</div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Name</th><th>Archive reason category</th><th>Archive reason</th></tr></thead>
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
