/* ============================================================
   TGC Rongai Campus Tracker — Cloud sync (Supabase)
   Plain fetch() calls to Supabase's auto-generated REST API
   (PostgREST) — no SDK, no CDN, consistent with the rest of the
   app staying dependency-free.

   NOT tested against a live Supabase project by the assistant that
   wrote this (no network path to *.supabase.co in that environment).
   Verify it works for you: open the browser console for errors, add
   a record, refresh, and check it's still there; then open the same
   URL on a second device and confirm it shows up there too.
   ============================================================ */

const SUPABASE_URL = "https://augaghlseednhjuqvasl.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_3VFwswluV7T-HwjHBwKX_A_FU8tTT1a";

function supabaseHeaders(extra) {
  return Object.assign({
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  }, extra || {});
}

async function supabaseGetAll(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: supabaseHeaders(),
  });
  if (!res.ok) throw new Error(`Supabase GET ${table} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Insert-or-update by primary key, WITHOUT touching any row that isn't in
// `rows`. This is the safe, default sync path: a modification never erases
// data that exists remotely but isn't part of the current local payload
// (e.g. something another device saved that hasn't been pulled here yet).
async function supabaseUpsert(table, rows, pkColumn) {
  if (!rows.length) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${pkColumn}`, {
    method: "POST",
    headers: supabaseHeaders({ "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`Supabase UPSERT ${table} failed: ${res.status} ${await res.text()}`);
}

// Delete specific rows by id — used only for things the app explicitly
// deleted locally (tracked in Store._pendingDeletes), never inferred from
// "not present in the current payload."
async function supabaseDeleteIds(table, ids, pkColumn) {
  if (!ids || !ids.length) return;
  const list = ids.map((id) => encodeURIComponent(id)).join(",");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${pkColumn}=in.(${list})`, {
    method: "DELETE",
    headers: supabaseHeaders(),
  });
  if (!res.ok) throw new Error(`Supabase DELETE ${table} failed: ${res.status} ${await res.text()}`);
}

// Wipe every row in `table` (matched via "primary key is not null", which is
// always true) and re-insert `rows`. Reserved for deliberate, explicitly
// confirmed full-replace actions (Reset to demo data, Import, and the
// manual "Push local data to cloud now" button) — NOT used for ordinary
// saves, since it would erase anything remote not present locally.
// Wipe every row in `table` and re-insert `rows` — but SAFELY: the insert
// happens FIRST, and only rows no longer present locally are deleted
// afterward, and only once the insert has succeeded. This ordering matters:
// the previous version deleted first, so if the insert failed for any
// reason (e.g. a schema mismatch from a migration not yet applied), the
// table was left permanently empty with nothing to roll back to. Now a
// failed write just fails loudly — it can never wipe existing data.
async function supabaseReplaceAll(table, rows, pkColumn) {
  if (rows.length) {
    const insRes = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${pkColumn}`, {
      method: "POST",
      headers: supabaseHeaders({ "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify(rows),
    });
    if (!insRes.ok) throw new Error(`Supabase INSERT ${table} failed: ${insRes.status} ${await insRes.text()}`);

    // Now that the current rows are safely written, remove anything that's
    // no longer part of the local dataset.
    const ids = rows.map((r) => r[pkColumn]);
    const list = ids.map((id) => encodeURIComponent(id)).join(",");
    const delRes = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${pkColumn}=not.in.(${list})`, {
      method: "DELETE",
      headers: supabaseHeaders(),
    });
    if (!delRes.ok) throw new Error(`Supabase DELETE ${table} failed: ${delRes.status} ${await delRes.text()}`);
  } else {
    // Genuinely no local rows at all (e.g. a from-scratch reset) — only
    // then is a full wipe actually correct.
    const delRes = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${pkColumn}=not.is.null`, {
      method: "DELETE",
      headers: supabaseHeaders(),
    });
    if (!delRes.ok) throw new Error(`Supabase DELETE ${table} failed: ${delRes.status} ${await delRes.text()}`);
  }
}

// ---------------- Load: pull everything from Supabase, map to our JS shape ----------------
async function loadFromSupabase() {
  const [members, hotspots, soulRecords, churchMembers, settingsRows] = await Promise.all([
    supabaseGetAll("members"),
    supabaseGetAll("hotspots"),
    supabaseGetAll("soul_records"),
    supabaseGetAll("church_members"),
    supabaseGetAll("settings"),
  ]);

  // Fetched separately: if the `users` table doesn't exist yet (migration
  // 003 not run), that shouldn't prevent loading everything else.
  let userRows = [];
  try {
    userRows = await supabaseGetAll("users");
  } catch (e) {
    console.warn("Could not load users from Supabase — have you run supabase/migrations/003_users.sql yet?", e);
  }

  const settingsRow = settingsRows.find((r) => r.key === "app_settings");
  const settings = settingsRow && settingsRow.value ? settingsRow.value : {
    noteWarnDays: 3, noteDangerDays: 7, weeklyHotspotTarget: 10, previousSoulsWonByYear: {}, colorPreset: "blue_purple", logoDataUrl: null, archiveReasonCategories: ["Relocated", "Assigned to Another Branch/Pastor", "Lost Contact", "Personal Request", "Other"],
  };

  return {
    members: members.map((m) => ({ id: m.id, name: m.name })),
    hotspots: hotspots.map((h) => ({ id: h.id, name: h.name, leaderId: h.leader_id, capacity: h.capacity || 10 })),
    soulRecords: soulRecords.map((r) => ({
      id: r.id,
      name: r.name,
      wonById: r.won_by_id,
      dateOfOutreach: r.date_of_outreach,
      mobile: r.mobile || "",
      status: r.status,
      context: r.context || "",
      followUpId: r.follow_up_id,
      hotspotId: r.hotspot_id,
      plugInStage: r.plug_in_stage,
      hotspotAttendance: r.hotspot_attendance || [],
      churchAttendance: r.church_attendance || [],
      notes: r.notes || [],
      archived: !!r.archived,
      archiveReasonCategory: r.archive_reason_category || "",
      archiveReasonText: r.archive_reason_text || "",
      archivedAt: r.archived_at || null,
    })),
    churchMembers: churchMembers.map((c) => ({
      id: c.id,
      name: c.name,
      address: c.address || "",
      mobile: c.mobile || "",
      hotspotId: c.hotspot_id,
      isHotspotLeader: !!c.is_hotspot_leader,
      leaderOrDiscipler: c.leader_or_discipler || "",
      notes: c.notes || "",
      discipleIds: c.disciple_ids || [],
      archived: !!c.archived,
      archiveReasonCategory: c.archive_reason_category || "",
      archiveReasonText: c.archive_reason_text || "",
      archivedAt: c.archived_at || null,
    })),
    settings,
    users: userRows.map((u) => ({
      id: u.id, userType: u.user_type, name: u.name, passwordHash: u.password_hash, createdAt: u.created_at,
    })),
  };
}

// ---------------- Shared row mapping (JS shape -> Postgres columns) ----------------
function mapDataToRows(data) {
  return {
    memberRows: data.members.map((m) => ({ id: m.id, name: m.name })),
    hotspotRows: data.hotspots.map((h) => ({ id: h.id, name: h.name, leader_id: h.leaderId || null, capacity: h.capacity || 10 })),
    soulRows: data.soulRecords.map((r) => ({
      id: r.id,
      name: r.name,
      won_by_id: r.wonById || null,
      date_of_outreach: r.dateOfOutreach || null,
      mobile: r.mobile || "",
      status: r.status,
      context: r.context || "",
      follow_up_id: r.followUpId || null,
      hotspot_id: r.hotspotId || null,
      plug_in_stage: r.plugInStage,
      hotspot_attendance: r.hotspotAttendance || [],
      church_attendance: r.churchAttendance || [],
      notes: r.notes || [],
      archived: !!r.archived,
      archive_reason_category: r.archiveReasonCategory || "",
      archive_reason_text: r.archiveReasonText || "",
      archived_at: r.archivedAt || null,
    })),
    cmRows: data.churchMembers.map((c) => ({
      id: c.id,
      name: c.name,
      address: c.address || "",
      mobile: c.mobile || "",
      hotspot_id: c.hotspotId || null,
      is_hotspot_leader: !!c.isHotspotLeader,
      leader_or_discipler: c.leaderOrDiscipler || "",
      notes: c.notes || "",
      disciple_ids: c.discipleIds || [],
      archived: !!c.archived,
      archive_reason_category: c.archiveReasonCategory || "",
      archive_reason_text: c.archiveReasonText || "",
      archived_at: c.archivedAt || null,
    })),
    settingsRows: [{ key: "app_settings", value: data.settings }],
    userRows: (data.users || []).map((u) => ({
      id: u.id,
      user_type: u.userType,
      name: u.name,
      password_hash: u.passwordHash,
      created_at: u.createdAt,
    })),
  };
}

// ---------------- Save (safe, default path): upsert current rows, and
// delete ONLY the specific rows the app tracked as explicitly deleted.
// Never erases anything else, even if it's missing from `data` — e.g.
// because another device hasn't synced yet. ----------------
async function saveToSupabase(data, pendingDeletes) {
  const { memberRows, hotspotRows, soulRows, cmRows, settingsRows, userRows } = mapDataToRows(data);

  await Promise.all([
    supabaseUpsert("members", memberRows, "id"),
    supabaseUpsert("hotspots", hotspotRows, "id"),
    supabaseUpsert("soul_records", soulRows, "id"),
    supabaseUpsert("church_members", cmRows, "id"),
    supabaseUpsert("settings", settingsRows, "key"),
  ]);

  // Users sync is wrapped separately: if the `users` table doesn't exist yet
  // (migration 003 not run), that shouldn't make the rest of the sync report
  // as failed — the campus data above is what matters most.
  try {
    await supabaseUpsert("users", userRows, "id");
  } catch (e) {
    console.warn("Users table sync failed — have you run supabase/migrations/003_users.sql yet?", e);
  }

  const d = pendingDeletes || {};
  await Promise.all([
    supabaseDeleteIds("members", d.members, "id"),
    supabaseDeleteIds("hotspots", d.hotspots, "id"),
    supabaseDeleteIds("soul_records", d.soul_records, "id"),
    supabaseDeleteIds("church_members", d.church_members, "id"),
  ]);
  try {
    await supabaseDeleteIds("users", d.users, "id");
  } catch (e) {
    console.warn("Users table delete sync failed — have you run supabase/migrations/003_users.sql yet?", e);
  }
}

// ---------------- Explicit full replace: reserved for deliberate,
// user-confirmed "make the cloud exactly match this" actions (Reset to
// demo data, Import, and the manual Push button) — NOT the normal save path.
async function replaceAllInSupabase(data) {
  const { memberRows, hotspotRows, soulRows, cmRows, settingsRows, userRows } = mapDataToRows(data);

  await Promise.all([
    supabaseReplaceAll("members", memberRows, "id"),
    supabaseReplaceAll("hotspots", hotspotRows, "id"),
    supabaseReplaceAll("soul_records", soulRows, "id"),
    supabaseReplaceAll("church_members", cmRows, "id"),
    supabaseReplaceAll("settings", settingsRows, "key"),
  ]);

  try {
    await supabaseReplaceAll("users", userRows, "id");
  } catch (e) {
    console.warn("Users table sync failed — have you run supabase/migrations/003_users.sql yet?", e);
  }
}
