/* ============================================================
   TGC Rongai Campus Tracker — Render layer
   Pure DOM building from Store data. No data logic lives here.
   ============================================================ */

const COMMON_TIMEZONES = [
  "Africa/Nairobi", "Africa/Lagos", "Africa/Johannesburg", "Africa/Cairo",
  "Europe/London", "America/New_York", "America/Los_Angeles", "UTC",
];

function themePresetSwatchesHTML() {
  const current = (Store.data.settings && Store.data.settings.colorPreset) || "blue_purple";
  return Object.entries(THEME_PRESETS).map(([key, preset]) => {
    const selected = key === current;
    const dots = preset.swatch.map((c) => `<span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${c};border:1px solid rgba(0,0,0,0.1);margin-right:-6px;"></span>`).join("");
    return `
      <button onclick="chooseColorPreset('${key}')" style="cursor:pointer;text-align:left;border:2px solid ${selected ? "var(--blue)" : "var(--line)"};background:${selected ? "var(--sky-mid)" : "#fff"};border-radius:12px;padding:10px 14px;min-width:170px;">
        <div style="margin-bottom:6px;">${dots}</div>
        <div style="font-family:var(--font-display);font-size:.8rem;color:var(--navy);">${preset.label}${selected ? " ✓" : ""}</div>
      </button>
    `;
  }).join("");
}

function timezoneOptionsHTML() {
  const current = getAppTimezone();
  const zones = COMMON_TIMEZONES.includes(current) ? COMMON_TIMEZONES : [current, ...COMMON_TIMEZONES];
  return zones.map((tz) => `<option value="${tz}" ${tz === current ? "selected" : ""}>${tz}</option>`).join("");
}

function plugMeterHTML(stage, compact) {
  const idx = PLUG_STAGES.indexOf(stage);
  let nodes = "";
  PLUG_STAGES.forEach((s, i) => {
    if (i > 0) nodes += `<div class="plug-wire ${i <= idx ? "filled" : ""}"></div>`;
    nodes += `<div class="plug-node ${i <= idx ? "filled" : ""}" title="${s}"></div>`;
  });
  return `<div class="plug-meter">${nodes}${compact ? "" : `<span class="plug-label">${stage}</span>`}</div>`;
}

// Meter + explicit text label together — used wherever the Plug-In stage
// needs to be unambiguous at a glance (e.g. the Follow-Up Radar).
function plugMeterWithTextHTML(stage) {
  return `${plugMeterHTML(stage, true)}<span class="badge badge-blue" style="margin-top:4px;display:inline-block;">${stage}</span>`;
}

function severityClass(days, warnDays, dangerDays) {
  if (days === null || days >= dangerDays) return "sev-danger";
  if (days >= warnDays) return "sev-warn";
  return "sev-ok";
}

function daysLabel(days) {
  if (days === null) return `<span class="badge badge-red">Never attended</span>`;
  if (days === 0) return `<span class="badge badge-green">Today</span>`;
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function statusBadge(status) {
  const map = {
    "New Soul": "badge-yellow",
    "Already Born Again": "badge-blue",
    "Rededicated Their Life": "badge-green",
  };
  return `<span class="badge ${map[status] || "badge-blue"}">${status}</span>`;
}

// ---------------- Dashboard ----------------
function renderDashboard() {
  const el = document.getElementById("view-dashboard");
  const warnDays = Store.data.settings.noteWarnDays;
  const dangerDays = Store.data.settings.noteDangerDays;

  // (a) Not contacted in `warnDays`+ days, using the last note as reference.
  const notContacted = Store.notContactedRows();

  // (b) Attendance counts, click-to-expand.
  const counts = Store.attendanceCounts();

  // (c) All souls, most recently won first.
  const byDate = Store.soulsByDateWon();

  // (d) Anyone still without a hotspot assigned.
  const needsHotspot = Store.soulsNeedingHotspot();

  const contactLabel = (days) => {
    if (days === null) return `<span class="badge badge-red">Never contacted</span>`;
    if (days === 0) return `<span class="badge badge-green">Today</span>`;
    return `${days} day${days === 1 ? "" : "s"} ago`;
  };

  // ---- (a) Not Contacted table ----
  let notContactedHTML = "";
  if (notContacted.length === 0) {
    notContactedHTML = `<tr><td colspan="6"><div class="empty-state"><div class="glyph">✅</div>Everyone has had a note logged within the last ${warnDays} days.</div></td></tr>`;
  } else {
    notContacted.forEach(({ rec, daysSinceNote }) => {
      notContactedHTML += `
        <tr class="${severityClass(daysSinceNote, warnDays, dangerDays)}">
          <td><strong>${rec.name}</strong><br>${plugMeterWithTextHTML(rec.plugInStage)}</td>
          <td>${contactLabel(daysSinceNote)}</td>
          <td>${Store.memberName(rec.followUpId)}</td>
          <td>${Store.hotspotLeaderName(rec.hotspotId)}</td>
          <td>${rec.mobile}</td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="openNotesModal('${rec.id}')">Notes (${rec.notes.length})</button>
            <button class="btn btn-ghost btn-sm" onclick="openSoulModal('${rec.id}')">Open</button>
          </td>
        </tr>`;
    });
  }

  // ---- (d) Needs a Hotspot table ----
  let needsHotspotHTML = "";
  if (needsHotspot.length === 0) {
    needsHotspotHTML = `<tr><td colspan="5"><div class="empty-state"><div class="glyph">🏠</div>Everyone currently in follow-up has a hotspot assigned.</div></td></tr>`;
  } else {
    needsHotspot.forEach(({ rec }) => {
      needsHotspotHTML += `
        <tr class="sev-warn">
          <td><strong>${rec.name}</strong><br>${plugMeterWithTextHTML(rec.plugInStage)}</td>
          <td style="max-width:260px;">${rec.context || "<span class='sub'>No context recorded — find out where they stay.</span>"}</td>
          <td>${Store.memberName(rec.followUpId)}</td>
          <td>${rec.mobile}</td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="openNotesModal('${rec.id}')">Notes (${rec.notes.length})</button>
            <button class="btn btn-primary btn-sm" onclick="openSoulModal('${rec.id}')">Assign hotspot</button>
          </td>
        </tr>`;
    });
  }

  // ---- (c) All souls by date won ----
  let byDateHTML = "";
  if (byDate.length === 0) {
    byDateHTML = `<tr><td colspan="8"><div class="empty-state"><div class="glyph">🕊️</div>No souls won logged yet.</div></td></tr>`;
  } else {
    byDate.forEach(({ rec, daysChurch, daysHotspot }) => {
      byDateHTML += `
        <tr>
          <td>${rec.dateOfOutreach || "—"}</td>
          <td><strong>${rec.name}</strong><br>${plugMeterWithTextHTML(rec.plugInStage)}</td>
          <td>${daysLabel(daysChurch)}</td>
          <td>${daysLabel(daysHotspot)}</td>
          <td>${Store.memberName(rec.followUpId)}</td>
          <td>${Store.hotspotLeaderName(rec.hotspotId)}</td>
          <td>${rec.mobile}</td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="openNotesModal('${rec.id}')">Notes (${rec.notes.length})</button>
            <button class="btn btn-ghost btn-sm" onclick="openSoulModal('${rec.id}')">Open</button>
          </td>
        </tr>`;
    });
  }

  el.innerHTML = `
    <div class="stat-strip">
      <div class="stat danger" style="cursor:default;"><div class="num">${notContacted.length}</div><div class="label">Not contacted in ${warnDays}+ days</div></div>
      <div class="stat warn" style="cursor:default;"><div class="num">${needsHotspot.length}</div><div class="label">Needs a hotspot assigned</div></div>
      <div class="stat good" style="cursor:pointer;" onclick="openAttendanceListModal('hotspot')" title="Click to see the list"><div class="num">${counts.hotspot.length}</div><div class="label">Souls who've attended hotspot ▸</div></div>
      <div class="stat" style="cursor:pointer;" onclick="openAttendanceListModal('church')" title="Click to see the list"><div class="num">${counts.church.length}</div><div class="label">Souls who've attended church ▸</div></div>
      <div class="stat"><div class="num">${byDate.length}</div><div class="label">Total souls in follow-up</div></div>
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <h2>Needs a Hotspot</h2>
          <div class="sub">Hotspots are assigned based on where someone stays — anyone here still needs a follow-up call to find that out and get them placed.</div>
        </div>
        <button class="btn btn-primary" onclick="openSoulModal()">+ Log a Soul Won</button>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>Name / Plug-In stage</th>
              <th>Context</th>
              <th>Follow-up member</th>
              <th>Mobile</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${needsHotspotHTML}</tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <h2>Not Contacted Recently</h2>
          <div class="sub">Anyone whose last logged note is ${warnDays}+ days old (or who has never had a note logged) — the clock runs from the last note, not from attendance.</div>
        </div>
        <button class="btn btn-primary" onclick="openSoulModal()">+ Log a Soul Won</button>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>Name / Plug-In stage</th>
              <th>Last contacted</th>
              <th>Follow-up member</th>
              <th>Hotspot leader</th>
              <th>Mobile</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${notContactedHTML}</tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <h2>All Souls Won, By Date</h2>
          <div class="sub">Every soul currently in follow-up, most recently won first, with the same fields as the rest of the Radar.</div>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>Date won</th>
              <th>Name / Plug-In stage</th>
              <th>Since church</th>
              <th>Since hotspot</th>
              <th>Follow-up member</th>
              <th>Hotspot leader</th>
              <th>Mobile</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${byDateHTML}</tbody>
        </table>
      </div>
    </div>
  `;
}

// ---------------- Soul Records ----------------
function renderSoulRecords() {
  const el = document.getElementById("view-souls");
  const stageFilter = document.getElementById("filterStage")?.value || "";
  const hotspotFilter = document.getElementById("filterHotspot")?.value || "";

  let records = Store.data.soulRecords.filter((r) => !r.archived);
  if (stageFilter) records = records.filter((r) => r.plugInStage === stageFilter);
  if (hotspotFilter) records = records.filter((r) => r.hotspotId === hotspotFilter);

  let rowsHTML = "";
  if (records.length === 0) {
    rowsHTML = `<tr><td colspan="8"><div class="empty-state"><div class="glyph">📋</div>No soul winning records match this filter yet.</div></td></tr>`;
  } else {
    records.forEach((r) => {
      rowsHTML += `
        <tr>
          <td><strong>${r.name}</strong><div class="sub" style="font-size:.72rem;color:#5A7C99;max-width:220px;">${r.context || ""}</div></td>
          <td>${Store.wonByName(r.wonById)}</td>
          <td>${r.dateOfOutreach || "—"}</td>
          <td>${r.mobile}</td>
          <td>${statusBadge(r.status)}</td>
          <td>${plugMeterHTML(r.plugInStage)}</td>
          <td>${Store.hotspotName(r.hotspotId)}</td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="openSoulModal('${r.id}')">Edit</button>
            <button class="btn btn-yellow btn-sm" onclick="openArchiveModal('soul', '${r.id}')">Archive</button>
            <button class="btn btn-danger btn-sm" onclick="confirmDeleteSoul('${r.id}')">Delete</button>
          </td>
        </tr>`;
    });
  }

  const hotspotOptions = Store.data.hotspots.map((h) => `<option value="${h.id}">${h.name}</option>`).join("");

  el.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div>
          <h2>Soul Winning Records</h2>
          <div class="sub">Every soul ever won at Rongai Campus, and where they are in their Plug-In journey.</div>
        </div>
        <button class="btn btn-primary" onclick="openSoulModal()">+ Log a Soul Won</button>
      </div>
      <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
        <select id="filterStage" onchange="renderSoulRecords()" style="max-width:220px;">
          <option value="">All Plug-In stages</option>
          ${PLUG_STAGES.map((s) => `<option value="${s}">${s}</option>`).join("")}
        </select>
        <select id="filterHotspot" onchange="renderSoulRecords()" style="max-width:220px;">
          <option value="">All hotspots</option>
          ${hotspotOptions}
        </select>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>Name / Context</th><th>Won By</th><th>Outreach date</th><th>Mobile</th>
              <th>Status</th><th>Plug-In stage</th><th>Hotspot</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>${rowsHTML}</tbody>
        </table>
      </div>
    </div>
  `;
  // restore filter selections
  if (stageFilter) document.getElementById("filterStage").value = stageFilter;
  if (hotspotFilter) document.getElementById("filterHotspot").value = hotspotFilter;
}

// ---------------- Church Members ----------------
function renderChurchMembers() {
  const el = document.getElementById("view-members-report");
  const cms = Store.data.churchMembers.filter((c) => !c.archived);

  let rowsHTML = "";
  if (cms.length === 0) {
    rowsHTML = `<tr><td colspan="6"><div class="empty-state"><div class="glyph">⛪</div>No church members yet. They're added automatically once a soul reaches Service Team, or you can add one directly.</div></td></tr>`;
  } else {
    cms.forEach((cm) => {
      const disciplesHTML = cm.discipleIds.length
        ? cm.discipleIds.map((did) => `<span class="chip">${Store.churchMemberName(did)}</span>`).join("")
        : `<span class="sub" style="font-size:.76rem;">No disciples assigned</span>`;

      rowsHTML += `
        <tr>
          <td><strong>${cm.name}</strong></td>
          <td>${cm.mobile}</td>
          <td>${Store.hotspotName(cm.hotspotId)}</td>
          <td>${cm.isHotspotLeader ? "Discipler: " : "Leader: "}${cm.leaderOrDiscipler || "—"}</td>
          <td style="max-width:200px;">${cm.notes || ""}</td>
          <td>
            <div class="chip-row">${disciplesHTML}</div>
            <button class="btn btn-yellow btn-sm" onclick="openDisciplesModal('${cm.id}')">Manage disciples</button>
            <div style="margin-top:8px;">
              <button class="btn btn-ghost btn-sm" onclick="openChurchMemberModal('${cm.id}')">Open / Edit</button>
              <button class="btn btn-yellow btn-sm" onclick="openArchiveModal('churchMember', '${cm.id}')">Archive</button>
              <button class="btn btn-danger btn-sm" onclick="confirmDeleteChurchMember('${cm.id}')">Delete</button>
            </div>
          </td>
        </tr>`;
    });
  }

  el.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div>
          <h2>Church Member Report</h2>
          <div class="sub">Everyone who has reached Service Team — the campus's bar for membership. Residential address and other details are in each member's card (Open / Edit) rather than the table below.</div>
        </div>
        <button class="btn btn-primary" onclick="openChurchMemberModal()">+ Add Church Member</button>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>Name</th><th>Mobile</th><th>Hotspot</th>
              <th>Leader / Discipler</th><th>Notes</th><th>Disciples</th>
            </tr>
          </thead>
          <tbody>${rowsHTML}</tbody>
        </table>
      </div>
    </div>
  `;
}

// ---------------- Admin (Members & Hotspots) ----------------
function renderAdmin() {
  const el = document.getElementById("view-admin");

  const memberRows = Store.data.members.map((m) => `
    <tr><td>${m.name}</td><td><button class="btn btn-ghost btn-sm" onclick="openEditMemberModal('${m.id}')">Edit</button> <button class="btn btn-danger btn-sm" onclick="removeMemberRow('${m.id}')">Remove</button></td></tr>
  `).join("") || `<tr><td colspan="2"><div class="empty-state">No members yet.</div></td></tr>`;

  const hotspotRows = Store.data.hotspots.map((h) => {
    const occ = Store.hotspotOccupancy(h.id);
    const cap = h.capacity || 10;
    const full = occ >= cap;
    const atTarget = occ >= 6;
    const badgeClass = full ? "badge-red" : atTarget ? "badge-yellow" : "badge-green";
    return `
    <tr>
      <td>${h.name}</td>
      <td>${Store.memberName(h.leaderId)}</td>
      <td><span class="badge ${badgeClass}">${occ} / ${cap}</span></td>
      <td><button class="btn btn-ghost btn-sm" onclick="openEditHotspotModal('${h.id}')">Edit</button> <button class="btn btn-danger btn-sm" onclick="removeHotspotRow('${h.id}')">Remove</button></td>
    </tr>`;
  }).join("") || `<tr><td colspan="4"><div class="empty-state">No hotspots yet.</div></td></tr>`;

  const memberOptions = Store.data.members.map((m) => `<option value="${m.id}">${m.name}</option>`).join("");

  const previousYearRows = Object.entries(Store.data.settings.previousSoulsWonByYear || {})
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, count]) => `
      <tr><td>${year}</td><td>${count}</td><td><button class="btn btn-danger btn-sm" onclick="removePreviousSoulsWonYear('${year}')">Remove</button></td></tr>
    `).join("") || `<tr><td colspan="3"><div class="empty-state">No carried-over years added yet.</div></td></tr>`;

  el.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div><h2>Hotspot Leaders</h2><div class="sub">The current members roster — feeds every dropdown campus-wide (won by, follow-up, hotspot leader, discipler).</div></div>
      </div>
      <div class="add-date-row" style="margin-bottom:14px;max-width:420px;">
        <input type="text" id="newMemberName" placeholder="Full name">
        <button class="btn btn-primary btn-sm" onclick="addMemberRow()">+ Add hotspot leader</button>
      </div>
      <div class="table-wrap"><table class="data"><thead><tr><th>Name</th><th></th></tr></thead><tbody>${memberRows}</tbody></table></div>
    </div>

    <div class="card">
      <div class="card-head">
        <div><h2>Hotspots</h2><div class="sub">Hotspot families and their leaders.</div></div>
      </div>
      <div class="form-grid" style="max-width:520px;margin-bottom:14px;">
        <input type="text" id="newHotspotName" placeholder="Hotspot name">
        <select id="newHotspotLeader"><option value="">Select leader</option>${memberOptions}</select>
      </div>
      <button class="btn btn-primary btn-sm" style="margin-bottom:14px;" onclick="addHotspotRow()">+ Add hotspot</button>
      <div class="table-wrap"><table class="data"><thead><tr><th>Hotspot</th><th>Leader</th><th>Members (target 6, max 10)</th><th></th></tr></thead><tbody>${hotspotRows}</tbody></table></div>
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <h2>Branding</h2>
          <div class="sub">Swap in a different church's logo, and pick a color scheme. Both sync across every device using this tracker.</div>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:18px;">
        <div class="brand-mark-badge" style="width:64px;height:64px;">
          <img src="${Store.data.settings.logoDataUrl || "assets/logo-default.png"}" alt="Current logo" style="width:100%;height:100%;object-fit:contain;">
        </div>
        <div>
          <label class="btn btn-primary btn-sm" style="cursor:pointer;">
            ⬆ Upload a logo
            <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" style="display:none;" onchange="uploadLogo(event)">
          </label>
          <button class="btn btn-ghost btn-sm" onclick="resetLogo()">Reset to The Go Church logo</button>
          <div class="sub" style="margin-top:6px;">PNG, JPG, WebP, or SVG. Keep it under ~500KB — it's stored with your synced data.</div>
        </div>
      </div>

      <div class="sub" style="margin-bottom:8px;font-family:var(--font-display);color:var(--blue-deep);text-transform:uppercase;font-size:.72rem;letter-spacing:.04em;">Color scheme</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        ${themePresetSwatchesHTML()}
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <h2>Cloud Sync</h2>
          <div class="sub">Backed by Supabase, so changes made on one device reach every other device on next load or sync.</div>
        </div>
        <span class="badge ${Store.cloudStatus === "connected" ? "badge-green" : Store.cloudStatus === "offline" ? "badge-red" : Store.cloudStatus === "pending" ? "badge-yellow" : "badge-blue"}">
          ${Store.cloudStatus === "connected" ? "● Connected" : Store.cloudStatus === "offline" ? "● Offline — using local copy" : Store.cloudStatus === "pending" ? "● Syncing shortly…" : "● Checking…"}
        </span>
      </div>
      <p class="sub" style="margin-bottom:12px;">
        Every change saves to this device instantly, then syncs to the cloud about 5 seconds later (rapid edits batch into one sync instead of one per click). Syncing only adds or updates records — it never erases anything that only exists in the cloud so far, and deletions only remove exactly what you deleted here.
        <br><br>
        <strong>"Push local data to cloud now"</strong> is different: it forces the cloud to exactly match this device, deleting anything in the cloud not present here. Use it only to deliberately overwrite the cloud — e.g. right after restoring a backup, or resolving two devices that drifted out of sync.
      </p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="manualPushToCloud()">⬆ Push local data to cloud now</button>
        <button class="btn btn-ghost" onclick="manualPullFromCloud()">⬇ Pull latest from cloud now</button>
      </div>
      <p class="sub" style="margin-top:10px;">
        ⚠️ This app uses Supabase's public anon key with open read/write access (no login) — anyone with the project URL and key can read or change this data.
        Treat the Supabase project URL as sensitive, and consider adding real Supabase Auth if this campus needs stronger protection for converts' names and phone numbers.
      </p>
    </div>

    <div class="card">
      <div class="card-head"><div><h2>Timezone</h2><div class="sub">Every "days since" calculation and displayed timestamp uses this timezone, so results stay consistent no matter which device or location someone opens the tracker from.</div></div></div>
      <div class="form-grid" style="max-width:340px;">
        <select id="appTimezone" onchange="changeAppTimezone(this.value)">${timezoneOptionsHTML()}</select>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div><h2>Follow-Up Radar thresholds</h2><div class="sub">Based on days since the last note was logged — when a soul turns amber or red on the dashboard.</div></div></div>
      <div class="form-grid" style="max-width:420px;">
        <div>
          <label>Flag as "not contacted" after (days)</label>
          <input type="number" id="warnDays" value="${Store.data.settings.noteWarnDays}" min="1">
        </div>
        <div>
          <label>Red / urgent after (days)</label>
          <input type="number" id="dangerDays" value="${Store.data.settings.noteDangerDays}" min="1">
        </div>
      </div>
      <button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="saveThresholds()">Save thresholds</button>
    </div>

    <div class="card">
      <div class="card-head"><div><h2>Weekly Hotspot Target</h2><div class="sub">The soul-winning target line shown on the Dashboard's "Souls Won by Hotspot, Per Week" report.</div></div></div>
      <div class="form-grid" style="max-width:300px;">
        <div>
          <label>Souls per hotspot, per week</label>
          <input type="number" id="weeklyTarget" value="${Store.data.settings.weeklyHotspotTarget}" min="0">
        </div>
      </div>
      <button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="saveWeeklyTarget()">Save target</button>
    </div>

    <div class="card">
      <div class="card-head"><div><h2>Archive Reason Categories</h2><div class="sub">The dropdown options offered when archiving a soul or church member. Add or remove categories to match how your campus talks about it.</div></div></div>
      <div class="add-date-row" style="margin-bottom:14px;max-width:420px;">
        <input type="text" id="newArchiveCategory" placeholder="e.g. Moved abroad">
        <button class="btn btn-primary btn-sm" onclick="addArchiveCategoryRow()">+ Add category</button>
      </div>
      <div class="chip-row">
        ${(Store.data.settings.archiveReasonCategories || []).map((c) => `
          <span class="chip">${c} <button onclick="removeArchiveCategoryRow('${c.replace(/'/g, "\\'")}')" title="Remove">×</button></span>
        `).join("") || `<span class="sub">No categories yet.</span>`}
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div><h2>Previously Recorded Souls Won</h2><div class="sub">Adopting this tracker partway through the year? Add how many souls your campus already won in earlier years, one year at a time — each is added to that specific year's total on the Dashboard, and never bleeds into other years or the month-on-month view.</div></div></div>
      <div class="form-grid" style="max-width:420px;margin-bottom:14px;">
        <input type="number" id="prevYearInput" placeholder="Year, e.g. 2025" min="2000" max="2100">
        <input type="number" id="prevCountInput" placeholder="Souls won that year" min="0">
      </div>
      <button class="btn btn-primary btn-sm" style="margin-bottom:14px;" onclick="addPreviousSoulsWonRow()">+ Add / update year</button>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Year</th><th>Souls won (carried over)</th><th></th></tr></thead>
          <tbody>${previousYearRows}</tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div><h2>Database</h2><div class="sub">This tracker runs on a real SQLite database, kept in this browser. Export it any time — the file opens in DB Browser for SQLite, Excel (via import), or any SQLite-compatible tool.</div></div></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
        <button class="btn btn-primary" onclick="exportDatabaseFile()">⬇ Export database (.sqlite)</button>
        <label class="btn btn-ghost" style="cursor:pointer;">
          ⬆ Import database (.sqlite)
          <input type="file" accept=".sqlite,.db,application/x-sqlite3" style="display:none;" onchange="importDatabaseFile(event)">
        </label>
      </div>
      <div class="sub" style="margin-top:6px;">Prefer plain JSON? Use the export/import below — same data, human-readable format.</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;">
        <button class="btn btn-yellow" onclick="exportData()">⬇ Export data (.json)</button>
        <label class="btn btn-ghost" style="cursor:pointer;">
          ⬆ Import data (.json)
          <input type="file" accept="application/json" style="display:none;" onchange="importData(event)">
        </label>
      </div>
      <button class="btn btn-danger" style="margin-top:12px;" onclick="confirmReset()">Reset to demo data</button>
    </div>
  `;
}

function renderAll() {
  renderDashboard();
  renderSoulRecords();
  renderChurchMembers();
  renderAdmin();
  renderReportsTab();
  renderArchiveTab();
  if (typeof updateUndoButtonState === "function") updateUndoButtonState();
}
