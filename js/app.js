/* ============================================================
   TGC Rongai Campus Tracker — App bootstrap & interactions
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  showBootLoading(true);
  await Store.load();
  applyColorPreset(Store.data.settings.colorPreset || "blue_purple");
  applyBranding(Store.data.settings);
  showBootLoading(false);

  if (sessionIsValid()) {
    showApp();
  } else {
    clearSession();
    showLoginScreen();
  }
  wireKeyboardAccessibility();
});

// Escape closes any open modal/overlay — checks our own overlay's "open"
// class, and also clears any element using an "active" class as an
// overlay-open indicator, for robustness against future overlay patterns.
function wireKeyboardAccessibility() {
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" && e.key !== "Esc") return;
    const overlay = document.getElementById("modalOverlay");
    if (overlay && overlay.classList.contains("open")) {
      closeModal();
    }
    document.querySelectorAll(".overlay.active").forEach((el) => el.classList.remove("active"));
  });
}

function performUndo() {
  if (!Store.canUndo()) return;
  if (!confirm("Undo the last change? This reverts to how things were just before that edit or delete.")) return;
  Store.undo();
  renderAll();
}

function updateUndoButtonState() {
  const btn = document.getElementById("undoBtn");
  if (!btn) return;
  btn.style.display = Store.canUndo() ? "inline-flex" : "none";
}

function showBootLoading(isLoading) {
  let el = document.getElementById("bootLoading");
  if (isLoading) {
    if (!el) {
      el = document.createElement("div");
      el.id = "bootLoading";
      el.style.cssText = "position:fixed;inset:0;background:#EAF6FF;display:flex;align-items:center;justify-content:center;z-index:999;font-family:'Sora',sans-serif;color:#0F3352;font-size:0.95rem;";
      el.innerHTML = "Loading the campus database…";
      document.body.appendChild(el);
    }
  } else if (el) {
    el.remove();
  }
}

function wireTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.view).classList.add("active");
    });
  });
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("open");
  document.getElementById("modalRoot").innerHTML = "";
}

// ---------------- Won By: searchable combobox over Church Members + Sunday Guest ----------------
function wonByOptionsData() {
  const guest = {
    id: SUNDAY_GUEST_ID,
    label: "Sunday Guest — not met during outreach (invited to Sunday service, or came via social media)",
    shortLabel: "Sunday Guest",
  };
  const churchMembers = Store.data.churchMembers
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ id: c.id, label: c.name, shortLabel: c.name }));
  return [guest, ...churchMembers];
}

function filterWonByOptions() {
  const input = document.getElementById("f_wonBy_search");
  const listEl = document.getElementById("f_wonBy_options");
  const query = input.value.trim().toLowerCase();
  const options = wonByOptionsData().filter((o) => !query || o.label.toLowerCase().includes(query));

  listEl.innerHTML = options.length
    ? options.map((o) => `
        <div class="combobox-option" onmousedown="selectWonByOption('${o.id}', '${o.shortLabel.replace(/'/g, "\\'")}')">${o.label}</div>
      `).join("")
    : `<div class="combobox-option combobox-empty">No match — check the spelling, or they may need to be added as a Church Member first.</div>`;
  listEl.style.display = "block";
}

function selectWonByOption(id, label) {
  document.getElementById("f_wonBy").value = id;
  document.getElementById("f_wonBy_search").value = label;
  document.getElementById("f_wonBy_options").style.display = "none";
}

function hideWonByOptionsDelayed() {
  // Delay so a click on an option (onmousedown) fires before blur hides the list.
  setTimeout(() => {
    const listEl = document.getElementById("f_wonBy_options");
    if (listEl) listEl.style.display = "none";
  }, 150);
}

function memberOptionsHTML(selectedId) {
  return Store.data.members
    .map((m) => `<option value="${m.id}" ${m.id === selectedId ? "selected" : ""}>${m.name}</option>`)
    .join("");
}

function hotspotOptionsHTML(selectedId) {
  const noneSelected = !selectedId ? "selected" : "";
  const options = Store.data.hotspots
    .map((h) => `<option value="${h.id}" ${h.id === selectedId ? "selected" : ""}>${h.name}</option>`)
    .join("");
  return `<option value="" ${noneSelected}>(No hotspot yet)</option>` + options;
}

function stageOptionsHTML(selected) {
  return PLUG_STAGES.map((s) => `<option value="${s}" ${s === selected ? "selected" : ""}>${s}</option>`).join("");
}

// ---------------- Soul Record Modal ----------------
function openSoulModal(id) {
  const rec = id ? Store.data.soulRecords.find((r) => r.id === id) : null;
  const isNew = !rec;

  const chipRow = (dates, field) =>
    (dates || []).sort().map((d) => `
      <span class="chip">${d} <button onclick="removeAttendanceRow('${id}', '${field}', '${d}')">×</button></span>
    `).join("") || `<span class="sub" style="font-size:.76rem;">No dates logged yet</span>`;

  const notesHTML = rec && rec.notes.length
    ? rec.notes.slice().reverse().map((n, i) => {
        const originalIndex = rec.notes.length - 1 - i;
        return `<div class="entry"><div class="when">${formatDateTime(n.when)} <button onclick="removeNoteRow('${rec.id}', ${originalIndex})" title="Delete this note" style="background:none;border:none;color:var(--red-flag);cursor:pointer;float:right;">×</button></div>${n.text}</div>`;
      }).join("")
    : `<div class="sub" style="font-size:.8rem;">No follow-up notes yet.</div>`;

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal">
      <h3>${isNew ? "Log a Soul Won" : "Edit Soul Record"}</h3>
      <div class="sub">Capture the outreach details and where they are on their Plug-In journey.</div>
      <div class="form-grid">
        <div class="full"><label>Name</label><input id="f_name" value="${rec ? rec.name : ""}"></div>
        <div>
          <label>Won by</label>
          <div class="combobox" id="wonByCombobox">
            <input type="text" id="f_wonBy_search" autocomplete="off" placeholder="Search church members, or 'Sunday Guest'..."
              value="${rec && rec.wonById ? Store.wonByName(rec.wonById) : ""}"
              oninput="filterWonByOptions()" onfocus="filterWonByOptions()" onblur="hideWonByOptionsDelayed()">
            <input type="hidden" id="f_wonBy" value="${rec ? rec.wonById || "" : ""}">
            <div class="combobox-options" id="f_wonBy_options" style="display:none;"></div>
          </div>
        </div>
        <div><label>Date of outreach</label><input type="date" id="f_date" value="${rec ? rec.dateOfOutreach : todayISO()}"></div>
        <div><label>Mobile number</label><input id="f_mobile" value="${rec ? rec.mobile : ""}" placeholder="07xx xxx xxx"></div>
        <div><label>Status of winning</label>
          <select id="f_status">
            <option ${rec?.status === "New Soul" ? "selected" : ""}>New Soul</option>
            <option ${rec?.status === "Already Born Again" ? "selected" : ""}>Already Born Again</option>
            <option ${rec?.status === "Rededicated Their Life" ? "selected" : ""}>Rededicated Their Life</option>
          </select>
        </div>
        <div class="full"><label>Context</label><textarea id="f_context" placeholder="Something memorable — e.g. where they stay, how you met them">${rec ? rec.context : ""}</textarea></div>
        <div><label>Follow-up member</label><select id="f_followUp">${memberOptionsHTML(rec?.followUpId)}</select></div>
        <div><label>Hotspot assigned</label><select id="f_hotspot">${hotspotOptionsHTML(rec?.hotspotId)}</select></div>
        <div class="full"><label>Plug-In stage</label><select id="f_stage">${stageOptionsHTML(rec ? rec.plugInStage : "Guest")}</select></div>
      </div>

      ${!isNew ? `
      <div class="form-grid" style="margin-top:16px;">
        <div class="full">
          <label>Hotspot attendance</label>
          <div class="checklist-box">
            <div class="chip-row" id="chipsHotspot">${chipRow(rec.hotspotAttendance, "hotspotAttendance")}</div>
            <div class="add-date-row">
              <input type="date" id="dateHotspot">
              <button class="btn btn-yellow btn-sm" onclick="addAttendanceRow('${rec.id}', 'hotspotAttendance', 'dateHotspot')">+ Log attendance</button>
            </div>
          </div>
        </div>
        <div class="full">
          <label>Church attendance</label>
          <div class="checklist-box">
            <div class="chip-row" id="chipsChurch">${chipRow(rec.churchAttendance, "churchAttendance")}</div>
            <div class="add-date-row">
              <input type="date" id="dateChurch">
              <button class="btn btn-yellow btn-sm" onclick="addAttendanceRow('${rec.id}', 'churchAttendance', 'dateChurch')">+ Log attendance</button>
            </div>
          </div>
        </div>
        <div class="full">
          <label>Follow-up notes</label>
          <div class="sub" style="color:var(--red-flag);font-weight:600;margin-bottom:6px;">⚠ Do not log a note if you have not been able to reach the soul.</div>
          <div class="notes-log">${notesHTML}</div>
          <div class="add-date-row">
            <input type="text" id="newNoteText" placeholder="How did the last interaction go?">
            <button class="btn btn-yellow btn-sm" onclick="addNoteRow('${rec.id}')">+ Add note</button>
          </div>
        </div>
      </div>` : `<p class="sub" style="margin-top:14px;">Save the record first to start logging attendance dates and follow-up notes.</p>`}

      <div class="modal-actions">
        ${!isNew ? `<button class="btn btn-danger" style="margin-right:auto;" onclick="deleteSoulFromModal('${rec.id}')">Delete this record</button><button class="btn btn-yellow" onclick="openArchiveModal('soul', '${rec.id}')">Archive</button>` : ""}
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveSoulForm('${rec ? rec.id : ""}')">${isNew ? "Save soul won" : "Save changes"}</button>
      </div>
    </div>
  `;
  document.getElementById("modalOverlay").classList.add("open");
}

function saveSoulForm(id) {
  const payload = {
    name: document.getElementById("f_name").value.trim(),
    wonById: document.getElementById("f_wonBy").value,
    dateOfOutreach: document.getElementById("f_date").value,
    mobile: document.getElementById("f_mobile").value.trim(),
    status: document.getElementById("f_status").value,
    context: document.getElementById("f_context").value.trim(),
    followUpId: document.getElementById("f_followUp").value,
    hotspotId: document.getElementById("f_hotspot").value,
    plugInStage: document.getElementById("f_stage").value,
  };
  if (!payload.name) { alert("Please enter a name."); return; }
  if (!payload.wonById) { alert("Please select who won this soul — search a Church Member's name, or choose \"Sunday Guest\" if they weren't met during outreach."); return; }

  if (id) {
    if (!confirm(`Save changes to ${payload.name}'s record? This will overwrite the existing details (you can still Undo afterward).`)) return;
    Store.updateSoulRecord(id, payload);
  } else {
    Store.addSoulRecord(payload);
  }
  closeModal();
  renderAll();
}

function addAttendanceRow(soulId, field, inputId) {
  const date = document.getElementById(inputId).value;
  if (!date) { alert("Pick a date first."); return; }
  Store.addAttendance(soulId, field, date);
  openSoulModal(soulId);
}

function removeAttendanceRow(soulId, field, date) {
  Store.removeAttendance(soulId, field, date);
  openSoulModal(soulId);
}

function addNoteRow(soulId) {
  const el = document.getElementById("newNoteText");
  if (!el.value.trim()) return;
  Store.addNote(soulId, el.value.trim());
  openSoulModal(soulId);
}

function removeNoteRow(soulId, index) {
  if (!confirm("Delete this note? This can't be undone (though the rest of the record is untouched).")) return;
  Store.removeNote(soulId, index);
  openSoulModal(soulId);
}

function deleteSoulFromModal(id) {
  const rec = Store.data.soulRecords.find((r) => r.id === id);
  if (!confirm(`Remove ${rec ? rec.name : "this"} soul winning record entirely? This also removes them from every Dashboard count (in case this was added by mistake). This cannot be undone.`)) return;
  Store.removeSoulRecord(id);
  closeModal();
  renderAll();
}

function confirmDeleteSoul(id) {
  if (confirm("Remove this soul winning record? This cannot be undone.")) {
    Store.removeSoulRecord(id);
    renderAll();
  }
}

// ---------------- Notes-only quick modal (from Dashboard) ----------------
function openNotesModal(id) {
  openSoulModal(id);
}

// ---------------- Church Member Modal ----------------
function openChurchMemberModal(id) {
  const cm = id ? Store.data.churchMembers.find((c) => c.id === id) : null;
  const isNew = !cm;
  document.getElementById("modalRoot").innerHTML = `
    <div class="modal">
      <h3>${isNew ? "Add Church Member" : "Edit Church Member"}</h3>
      <div class="sub">${isNew ? "For someone joining directly as a member — souls won through outreach are added automatically once they reach Service Team." : cm.name}</div>
      <div class="form-grid">
        <div class="full"><label>Full name</label><input id="cm_name" value="${cm ? cm.name : ""}"></div>
        <div class="full"><label>Residential address</label><input id="cm_address" value="${cm ? cm.address || "" : ""}"></div>
        <div><label>Mobile number</label><input id="cm_mobile" value="${cm ? cm.mobile || "" : ""}"></div>
        <div><label>Hotspot</label><select id="cm_hotspot">${hotspotOptionsHTML(cm?.hotspotId)}</select></div>
        <div class="full">
          <label><input type="checkbox" id="cm_isLeader" ${cm && cm.isHotspotLeader ? "checked" : ""} style="width:auto;display:inline-block;margin-right:6px;"> This member is a hotspot leader</label>
        </div>
        <div class="full"><label id="lbl_leaderDiscipler">${cm && cm.isHotspotLeader ? "Discipler" : "Hotspot Leader"}</label><input id="cm_leaderDiscipler" value="${cm ? cm.leaderOrDiscipler || "" : ""}"></div>
        <div class="full"><label>Notes</label><textarea id="cm_notes">${cm ? cm.notes || "" : ""}</textarea></div>
      </div>
      <div class="modal-actions">
        ${!isNew ? `<button class="btn btn-danger" style="margin-right:auto;" onclick="confirmDeleteChurchMember('${cm.id}')">Delete</button><button class="btn btn-yellow" onclick="openArchiveModal('churchMember', '${cm.id}')">Archive</button>` : ""}
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveChurchMemberForm('${cm ? cm.id : ""}')">${isNew ? "Add church member" : "Save changes"}</button>
      </div>
    </div>
  `;
  document.getElementById("modalOverlay").classList.add("open");
}

function saveChurchMemberForm(id) {
  const name = document.getElementById("cm_name").value.trim();
  if (!name) { alert("Please enter a name."); return; }
  const payload = {
    name,
    address: document.getElementById("cm_address").value.trim(),
    mobile: document.getElementById("cm_mobile").value.trim(),
    hotspotId: document.getElementById("cm_hotspot").value,
    isHotspotLeader: document.getElementById("cm_isLeader").checked,
    leaderOrDiscipler: document.getElementById("cm_leaderDiscipler").value.trim(),
    notes: document.getElementById("cm_notes").value.trim(),
  };

  if (id) {
    if (!confirm("Save changes to this church member's record? This will overwrite the existing details (you can still Undo afterward).")) return;
    Store.updateChurchMember(id, payload);
  } else {
    Store.addChurchMember(payload);
  }
  closeModal();
  renderAll();
}

function confirmDeleteChurchMember(id) {
  if (confirm("Remove this church member record? This cannot be undone.")) {
    Store.removeChurchMember(id);
    renderAll();
  }
}

function openDisciplesModal(cmId) {
  const cm = Store.data.churchMembers.find((c) => c.id === cmId);
  if (!cm) return;
  const candidates = Store.data.churchMembers.filter((c) => c.id !== cmId);

  const rowsHTML = candidates.length
    ? candidates.map((c) => `
        <label style="display:flex;align-items:center;gap:8px;padding:7px 4px;border-bottom:1px dashed var(--sky-mid);font-size:.86rem;">
          <input type="checkbox" value="${c.id}" ${cm.discipleIds.includes(c.id) ? "checked" : ""} style="width:auto;">
          <span>${c.name}</span>
          <span class="sub" style="margin-left:auto;font-size:.74rem;">${Store.hotspotName(c.hotspotId)}</span>
        </label>`).join("")
    : `<div class="empty-state">No other church members yet to choose from.</div>`;

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal">
      <h3>Manage Disciples</h3>
      <div class="sub">Choose who ${cm.name} is discipling, from the Church Member Report.</div>
      <div class="checklist-box" id="disciplesChecklist" style="max-height:320px;overflow-y:auto;">${rowsHTML}</div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveDisciplesForm('${cm.id}')">Save disciples</button>
      </div>
    </div>
  `;
  document.getElementById("modalOverlay").classList.add("open");
}

function saveDisciplesForm(cmId) {
  const checked = Array.from(document.querySelectorAll("#disciplesChecklist input[type=checkbox]:checked")).map((el) => el.value);
  if (!confirm("Save this disciples list? This replaces the current list (you can still Undo afterward).")) return;
  Store.setDisciples(cmId, checked);
  closeModal();
  renderChurchMembers();
}

// ---------------- Attendance list (floating card from Radar stat cards) ----------------
function openAttendanceListModal(kind) {
  const counts = Store.attendanceCounts();
  const rows = kind === "hotspot" ? counts.hotspot : counts.church;
  const title = kind === "hotspot" ? "Souls Who've Attended Hotspot" : "Souls Who've Attended Church";

  const rowsHTML = rows.length
    ? rows.map(({ rec }) => {
        const lastNote = rec.notes.length ? rec.notes[rec.notes.length - 1].text : "<span class='sub'>No notes logged</span>";
        return `
          <tr>
            <td><strong>${rec.name}</strong></td>
            <td>${Store.memberName(rec.followUpId)}</td>
            <td>${rec.mobile}</td>
            <td style="max-width:260px;">${lastNote}</td>
          </tr>`;
      }).join("")
    : `<tr><td colspan="4"><div class="empty-state">No one yet.</div></td></tr>`;

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal" style="max-width:760px;">
      <h3>${title}</h3>
      <div class="sub">${rows.length} soul${rows.length === 1 ? "" : "s"} currently in follow-up.</div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Name</th><th>Follow-up member</th><th>Mobile</th><th>Last note</th></tr></thead>
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

// ---------------- Admin actions ----------------
function openEditMemberModal(id) {
  const m = Store.data.members.find((x) => x.id === id);
  if (!m) return;
  document.getElementById("modalRoot").innerHTML = `
    <div class="modal">
      <h3>Edit Hotspot Leader</h3>
      <div class="form-grid">
        <div class="full"><label>Full name</label><input id="editMemberName" value="${m.name}"></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveEditMember('${m.id}')">Save changes</button>
      </div>
    </div>
  `;
  document.getElementById("modalOverlay").classList.add("open");
}

function saveEditMember(id) {
  const name = document.getElementById("editMemberName").value.trim();
  if (!name) { alert("Please enter a name."); return; }
  if (!confirm("Save this name change? It updates everywhere this person is referenced (won by, follow-up, hotspot leader, discipler).")) return;
  Store.updateMember(id, name);
  closeModal();
  renderAll();
}

function openEditHotspotModal(id) {
  const h = Store.data.hotspots.find((x) => x.id === id);
  if (!h) return;
  document.getElementById("modalRoot").innerHTML = `
    <div class="modal">
      <h3>Edit Hotspot</h3>
      <div class="form-grid">
        <div class="full"><label>Hotspot name</label><input id="editHotspotName" value="${h.name}"></div>
        <div><label>Leader</label><select id="editHotspotLeader">${memberOptionsHTML(h.leaderId)}</select></div>
        <div><label>Capacity (max)</label><input type="number" id="editHotspotCapacity" value="${h.capacity || 10}" min="1"></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveEditHotspot('${h.id}')">Save changes</button>
      </div>
    </div>
  `;
  document.getElementById("modalOverlay").classList.add("open");
}

function saveEditHotspot(id) {
  const name = document.getElementById("editHotspotName").value.trim();
  if (!name) { alert("Please enter a hotspot name."); return; }
  const leaderId = document.getElementById("editHotspotLeader").value;
  const capacity = parseInt(document.getElementById("editHotspotCapacity").value, 10) || 10;
  if (!confirm("Save changes to this hotspot? This can change who its leader is.")) return;
  Store.updateHotspot(id, { name, leaderId, capacity });
  closeModal();
  renderAll();
}

function addMemberRow() {
  const input = document.getElementById("newMemberName");
  if (!input.value.trim()) return;
  Store.addMember(input.value.trim());
  renderAdmin();
  renderSoulRecords();
}

function removeMemberRow(id) {
  if (confirm("Remove this member from the roster?")) {
    Store.removeMember(id);
    renderAll();
  }
}

function addHotspotRow() {
  const name = document.getElementById("newHotspotName").value.trim();
  const leaderId = document.getElementById("newHotspotLeader").value;
  if (!name) return;
  Store.addHotspot(name, leaderId);
  renderAdmin();
  renderSoulRecords();
}

function removeHotspotRow(id) {
  if (confirm("Remove this hotspot?")) {
    Store.removeHotspot(id);
    renderAll();
  }
}

function saveThresholds() {
  if (!confirm("Save these Follow-Up Radar thresholds? This replaces the current settings.")) return;
  const warnDays = parseInt(document.getElementById("warnDays").value, 10) || 3;
  const dangerDays = parseInt(document.getElementById("dangerDays").value, 10) || 7;
  Store.data.settings.noteWarnDays = warnDays;
  Store.data.settings.noteDangerDays = dangerDays;
  Store.save();
  renderDashboard();
  alert("Thresholds updated.");
}

function manualPushToCloud() {
  if (!confirm("Push this device's current data to the cloud now? This makes the cloud EXACTLY match this device — anything in the cloud that isn't on this device (e.g. from another device that hasn't synced here yet) will be deleted. Only do this if you're sure this device has the data you want to keep.")) return;
  Store.pushToCloud()
    .then(() => { alert("Pushed to the cloud successfully."); renderAdmin(); })
    .catch((e) => { alert("Push failed — check your internet connection and Supabase settings. See the browser console for details."); console.error(e); renderAdmin(); });
}

function manualPullFromCloud() {
  if (!confirm("Pull the latest data from the cloud now? This overwrites anything unsaved on this device with what's in Supabase.")) return;
  showBootLoading(true);
  Store.pullFromCloud()
    .then(() => {
      showBootLoading(false);
      applyColorPreset(Store.data.settings.colorPreset || "blue_purple");
      applyBranding(Store.data.settings);
      renderAll();
      alert("Pulled the latest data from the cloud.");
    })
    .catch((e) => { showBootLoading(false); alert("Pull failed — check your internet connection and Supabase settings. See the browser console for details."); console.error(e); renderAdmin(); });
}

function uploadLogo(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  if (file.size > 800 * 1024) {
    if (!confirm(`That image is about ${Math.round(file.size / 1024)}KB — fairly large to store and sync. Use it anyway? (Under ~500KB is recommended.)`)) {
      evt.target.value = "";
      return;
    }
  }
  const reader = new FileReader();
  reader.onload = () => {
    Store.data.settings.logoDataUrl = reader.result;
    Store.save();
    applyBranding(Store.data.settings);
    renderAdmin();
  };
  reader.readAsDataURL(file);
}

function resetLogo() {
  if (!confirm("Reset to The Go Church's default logo? This replaces the current custom logo.")) return;
  Store.data.settings.logoDataUrl = null;
  Store.save();
  applyBranding(Store.data.settings);
  renderAdmin();
}

function chooseColorPreset(key) {
  Store.data.settings.colorPreset = key;
  Store.save();
  applyColorPreset(key);
  renderAdmin();
}

function changeAppTimezone(tz) {
  setAppTimezone(tz);
  renderAll();
}

function saveWeeklyTarget() {
  if (!confirm("Save this weekly hotspot target? This replaces the current setting.")) return;
  const target = parseInt(document.getElementById("weeklyTarget").value, 10);
  Store.data.settings.weeklyHotspotTarget = isNaN(target) ? 10 : target;
  Store.save();
  renderReportsTab();
  alert("Weekly target updated.");
}

// ---------------- Users (Super Admin only) ----------------
function openAddUserModal() {
  document.getElementById("modalRoot").innerHTML = `
    <div class="modal">
      <h3>Add User</h3>
      <div class="sub">They'll be able to log in immediately with these credentials.</div>
      <div class="form-grid">
        <div class="full">
          <label>User type</label>
          <select id="newUserType">
            <option value="Super Admin">Super Admin</option>
            <option value="Branch Admin">Branch Admin</option>
            <option value="Hotspot Leader" selected>Hotspot Leader</option>
          </select>
        </div>
        <div class="full"><label>Name</label><input id="newUserName" placeholder="Full name"></div>
        <div class="full"><label>Password</label><input type="text" id="newUserPassword" placeholder="Choose a password"></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveNewUser()">Add user</button>
      </div>
    </div>
  `;
  document.getElementById("modalOverlay").classList.add("open");
}

async function saveNewUser() {
  const userType = document.getElementById("newUserType").value;
  const name = document.getElementById("newUserName").value.trim();
  const password = document.getElementById("newUserPassword").value;
  if (!name || !password) { alert("Enter a name and password."); return; }
  if (password.length < 6) { alert("Use a password of at least 6 characters."); return; }
  await Store.addUser(userType, name, password);
  closeModal();
  renderAdmin();
}

function openEditUserModal(id) {
  const u = Store.data.users.find((x) => x.id === id);
  if (!u) return;
  document.getElementById("modalRoot").innerHTML = `
    <div class="modal">
      <h3>Edit User</h3>
      <div class="sub">Leave the password blank to keep it unchanged.</div>
      <div class="form-grid">
        <div class="full">
          <label>User type</label>
          <select id="editUserType">
            <option value="Super Admin" ${u.userType === "Super Admin" ? "selected" : ""}>Super Admin</option>
            <option value="Branch Admin" ${u.userType === "Branch Admin" ? "selected" : ""}>Branch Admin</option>
            <option value="Hotspot Leader" ${u.userType === "Hotspot Leader" ? "selected" : ""}>Hotspot Leader</option>
          </select>
        </div>
        <div class="full"><label>Name</label><input id="editUserName" value="${u.name}"></div>
        <div class="full"><label>New password (optional)</label><input type="text" id="editUserPassword" placeholder="Leave blank to keep current password"></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveEditUser('${u.id}')">Save changes</button>
      </div>
    </div>
  `;
  document.getElementById("modalOverlay").classList.add("open");
}

async function saveEditUser(id) {
  const userType = document.getElementById("editUserType").value;
  const name = document.getElementById("editUserName").value.trim();
  const password = document.getElementById("editUserPassword").value;
  if (!name) { alert("Enter a name."); return; }
  if (password && password.length < 6) { alert("Use a password of at least 6 characters, or leave it blank to keep the current one."); return; }
  if (!confirm("Save changes to this user?")) return;

  const patch = { userType, name };
  if (password) patch.plainPassword = password;
  await Store.updateUser(id, patch);

  // If editing yourself, keep the session's displayed name/type in sync.
  const me = currentUser();
  if (me && me.id === id) setSession({ id, name, userType });

  closeModal();
  renderAdmin();
  const loggedInAsEl = document.getElementById("loggedInAs");
  if (loggedInAsEl && me && me.id === id) loggedInAsEl.textContent = `${name} · ${userType}`;
}

function removeUserRow(id) {
  const u = Store.data.users.find((x) => x.id === id);
  if (!u) return;
  const me = currentUser();
  if (me && me.id === id) {
    if (!confirm("This is the account you're currently logged in as. Delete it anyway? You'll be logged out immediately.")) return;
  } else if (!confirm(`Delete the user "${u.name}"? They won't be able to log in anymore.`)) {
    return;
  }
  try {
    Store.removeUser(id);
  } catch (e) {
    alert(e.message);
    return;
  }
  if (me && me.id === id) {
    logout();
    return;
  }
  renderAdmin();
}

function addArchiveCategoryRow() {
  const input = document.getElementById("newArchiveCategory");
  if (!input.value.trim()) return;
  Store.addArchiveReasonCategory(input.value.trim());
  renderAdmin();
}

function removeArchiveCategoryRow(name) {
  if (!confirm(`Remove the "${name}" archive category? Records already using it keep the text, but it won't be offered for new archiving.`)) return;
  Store.removeArchiveReasonCategory(name);
  renderAdmin();
}

// ---------------- Archive / Unarchive ----------------
function openArchiveModal(type, id) {
  const rec = type === "soul" ? Store.data.soulRecords.find((r) => r.id === id) : Store.data.churchMembers.find((c) => c.id === id);
  if (!rec) return;
  const categories = Store.data.settings.archiveReasonCategories || [];
  const whereFrom = type === "soul" ? "the Follow-Up Radar" : "the Church Member Report";
  document.getElementById("modalRoot").innerHTML = `
    <div class="modal">
      <h3>Archive ${rec.name}</h3>
      <div class="sub">They'll move to the Archive tab and come off ${whereFrom} — nothing is deleted, every detail and history is kept, and this can be undone any time.</div>
      <div class="form-grid">
        <div class="full">
          <label>Archive reason category</label>
          <select id="archive_category">${categories.map((c) => `<option value="${c}">${c}</option>`).join("")}</select>
        </div>
        <div class="full">
          <label>Archive reason (details)</label>
          <textarea id="archive_reason_text" placeholder="e.g. Relocated to Nakuru, now under Pastor John at the Nakuru branch."></textarea>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-danger" onclick="confirmArchive('${type}', '${id}')">Archive</button>
      </div>
    </div>
  `;
  document.getElementById("modalOverlay").classList.add("open");
}

function confirmArchive(type, id) {
  const category = document.getElementById("archive_category").value;
  const reasonText = document.getElementById("archive_reason_text").value.trim();
  if (!confirm("Archive this record now?")) return;
  if (type === "soul") Store.archiveSoul(id, category, reasonText);
  else Store.archiveChurchMember(id, category, reasonText);
  closeModal();
  renderAll();
}

function unarchiveSoulRow(id) {
  if (!confirm("Bring this soul back onto the active Follow-Up Radar?")) return;
  Store.unarchiveSoul(id);
  renderAll();
}

function unarchiveChurchMemberRow(id) {
  if (!confirm("Bring this member back onto the active Church Member Report?")) return;
  Store.unarchiveChurchMember(id);
  renderAll();
}

function addPreviousSoulsWonRow() {
  const year = document.getElementById("prevYearInput").value.trim();
  const count = parseInt(document.getElementById("prevCountInput").value, 10);
  if (!year || year.length !== 4 || isNaN(count) || count < 0) {
    alert("Enter a valid 4-digit year and a souls-won count of 0 or more.");
    return;
  }
  const existing = Store.data.settings.previousSoulsWonByYear[year];
  if (existing != null && !confirm(`${year} already has ${existing} carried over. Replace it with ${count}?`)) return;
  Store.addOrUpdatePreviousSoulsWon(year, count);
  renderAdmin();
  renderReportsTab();
}

function removePreviousSoulsWonYear(year) {
  if (confirm(`Remove the carried-over count for ${year}? This can't be undone.`)) {
    Store.removePreviousSoulsWonYear(year);
    renderAdmin();
    renderReportsTab();
  }
}

function exportData() {
  const blob = new Blob([Store.exportJSON()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tgc-rongai-tracker-backup-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  if (!confirm(`Import "${file.name}"? This will replace ALL current data in this browser (you can Undo right after if it imports successfully).`)) {
    evt.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      showBootLoading(true);
      await Store.importJSON(reader.result);
      showBootLoading(false);
      applyColorPreset(Store.data.settings.colorPreset || "blue_purple");
      applyBranding(Store.data.settings);
      renderAll();
      alert("Data imported successfully.");
    } catch (e) {
      showBootLoading(false);
      alert("Could not read that file. Make sure it's a tracker backup .json file.");
    }
  };
  reader.readAsText(file);
}

// ---------------- Real SQLite (.sqlite / .db) export & import ----------------
function exportDatabaseFile() {
  const bytes = Store.exportDbBinary();
  const blob = new Blob([bytes], { type: "application/x-sqlite3" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tgc-rongai-tracker-${todayISO()}.sqlite`;
  a.click();
  URL.revokeObjectURL(url);
}

function importDatabaseFile(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  if (!confirm(`Import "${file.name}"? This will replace ALL current data in this browser (you can Undo right after if it imports successfully).`)) {
    evt.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      showBootLoading(true);
      await Store.importDbBinary(new Uint8Array(reader.result));
      showBootLoading(false);
      applyColorPreset(Store.data.settings.colorPreset || "blue_purple");
      applyBranding(Store.data.settings);
      renderAll();
      alert("Database imported successfully.");
    } catch (e) {
      showBootLoading(false);
      alert("Could not read that file. Make sure it's a valid .sqlite/.db file exported from this tracker.");
      console.error(e);
    }
  };
  reader.readAsArrayBuffer(file);
}

async function confirmReset() {
  if (confirm("This will erase all current data in this browser and reload the demo dataset. Continue?")) {
    showBootLoading(true);
    await Store.resetAll();
    showBootLoading(false);
    applyColorPreset(Store.data.settings.colorPreset || "blue_purple");
    applyBranding(Store.data.settings);
    renderAll();
  }
}
