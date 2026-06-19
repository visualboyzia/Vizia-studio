// VIZIA Finanzas — capa de datos (backend)
// CLOUD (Supabase) si config.js tiene url + anonKey; si no, LOCAL (este dispositivo).
window.Store = (function () {
  const cfg = window.VIZIA_CONFIG || {};
  const CLOUD = !!(cfg.url && cfg.anonKey && /^https?:\/\//.test(cfg.url));
  const LS = 'vizia_fin_v1';
  const DATA_VERSION = 7; // súbelo cuando cambie la estructura → limpia datos viejos guardados
  let sb = null;

  function init() {
    if (CLOUD && window.supabase) sb = window.supabase.createClient(cfg.url, cfg.anonKey);
    return CLOUD;
  }
  const isCloud = () => CLOUD;

  // ---------- AUTH ----------
  async function signIn(userId, password) {
    if (!CLOUD) { localStorage.setItem('vizia_user', userId || ''); return { ok: true }; }
    const u = (cfg.users || []).find(x => x.id === userId);
    if (!u || !u.email) return { ok: false, error: 'Falta el correo de este usuario en config.js' };
    if (!password) return { ok: false, error: 'Ingresa tu contraseña' };
    const { error } = await sb.auth.signInWithPassword({ email: u.email, password });
    if (error) return { ok: false, error: error.message };
    localStorage.setItem('vizia_user', userId);
    return { ok: true };
  }
  async function signOut() { if (CLOUD && sb) await sb.auth.signOut(); }

  // Detecta si llegamos desde un link de invitación / recuperación (Franco crea su clave)
  async function getInviteSession() {
    if (!CLOUD || !sb) return null;
    const hash = window.location.hash || '';
    if (!/type=(invite|recovery|signup)/.test(hash)) return null;
    for (let i = 0; i < 12; i++) {
      const { data } = await sb.auth.getSession();
      if (data && data.session) return data.session;
      await new Promise(r => setTimeout(r, 150));
    }
    return null;
  }
  async function setPassword(pw) {
    if (!CLOUD || !sb) return { ok: false, error: 'Sin conexión' };
    const { error } = await sb.auth.updateUser({ password: pw });
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  async function currentEmail() {
    if (!CLOUD || !sb) return null;
    const { data } = await sb.auth.getUser();
    return data && data.user ? data.user.email : null;
  }

  // ---------- LOCAL helpers ----------
  function lsRead() { try { return JSON.parse(localStorage.getItem(LS)); } catch (e) { return null; } }
  function lsWrite(d) { d.__v = DATA_VERSION; localStorage.setItem(LS, JSON.stringify(d)); }

  // ---------- LOAD ----------
  async function fetchAll(seed) {
    if (!CLOUD) {
      let d = lsRead();
      if (!d || d.__v !== DATA_VERSION) { d = seed; lsWrite(d); } // datos viejos → reinicia limpio
      return d;
    }
    const [p, tx, tm, rc, st, ac] = await Promise.all([
      sb.from('projects').select('*').order('created_at'),
      sb.from('transactions').select('*').order('date', { ascending: false }),
      sb.from('team').select('*').order('id'),
      sb.from('recurring').select('*').order('day'),
      sb.from('settings').select('*').eq('id', 1).maybeSingle(),
      sb.from('activity').select('*').order('created_at', { ascending: false }).limit(80),
    ]);
    const err = [p, tx, tm, rc, st, ac].find(r => r.error);
    if (err) throw new Error(err.error.message);
    const s = st.data || {};
    return {
      activity: (ac.data || []).map(r => ({ id: r.id, who: r.who, action: r.action, detail: r.detail, created_at: r.created_at })),
      projects: (p.data || []).map(r => ({ id: r.id, nm: r.nm, cl: r.cl, total: +r.total, cobrado: +r.cobrado, status: r.status, items: r.items || [] })),
      tx: (tx.data || []).map(r => ({ id: r.id, t: r.t, amt: +r.amt, cur: r.cur, origAmt: r.orig_amt != null ? +r.orig_amt : Math.abs(+r.amt), desc: r.descr, proj: r.proj, paidFrom: r.paid_from, status: r.status, voided: !!r.voided, voidedBy: r.voided_by, edited: !!r.edited, editedBy: r.edited_by, editNote: r.edit_note, ic: r.ic, date: r.date })),
      team: (tm.data || []).map(r => ({ nm: r.nm, role: r.role, type: r.type, share: +r.share, pay: +r.pay, av: r.av, paidMonth: r.paid_month || null })),
      recurring: (rc.data || []).map(r => ({ id: r.id, nm: r.nm, amt: +r.amt, cur: r.cur, day: r.day, ic: r.ic, active: r.active !== false, thisMonth: r.this_month || null })),
      settings: {
        display: s.display || seed.settings.display,
        rate: s.rate != null ? +s.rate : seed.settings.rate,
        igv: { on: !!s.igv_on, rate: s.igv_rate != null ? +s.igv_rate : 0.18 },
        meta: s.meta != null ? +s.meta : seed.settings.meta,
        accounts: s.accounts || seed.settings.accounts,
        inflow: seed.settings.inflow,   // flujo histórico ilustrativo (agregación real: pendiente)
        outflow: seed.settings.outflow,
      },
    };
  }

  // ---------- MUTATIONS ----------
  async function addTx(row) {
    if (!CLOUD) {
      const d = lsRead() || {}; d.tx = d.tx || [];
      row.id = row.id || ('t' + Date.now());
      d.tx.unshift(row); lsWrite(d); return row;
    }
    const me = (cfg.users || []).find(u => u.id === localStorage.getItem('vizia_user'));
    const ins = {
      t: row.t, amt: row.amt, cur: row.cur, orig_amt: row.origAmt, descr: row.desc,
      proj: row.proj, paid_from: row.paidFrom, status: row.status, ic: row.ic, date: row.date,
      created_by: me ? me.name : null,
    };
    const { data, error } = await sb.from('transactions').insert(ins).select().single();
    if (error) throw new Error(error.message);
    return { id: data.id, t: data.t, amt: +data.amt, cur: data.cur, origAmt: data.orig_amt != null ? +data.orig_amt : Math.abs(+data.amt), desc: data.descr, proj: data.proj, paidFrom: data.paid_from, status: data.status, ic: data.ic, date: data.date };
  }

  async function addProject(row) {
    if (!CLOUD) {
      const d = lsRead() || {}; d.projects = d.projects || [];
      row.id = row.id || ('p' + Date.now());
      d.projects.push(row); lsWrite(d); return row;
    }
    const ins = { nm: row.nm, cl: row.cl, total: row.total, cobrado: row.cobrado, status: row.status };
    const { data, error } = await sb.from('projects').insert(ins).select().single();
    if (error) throw new Error(error.message);
    return { id: data.id, nm: data.nm, cl: data.cl, total: +data.total, cobrado: +data.cobrado, status: data.status };
  }

  async function addRecurring(row) {
    if (!CLOUD) {
      const d = lsRead() || {}; d.recurring = d.recurring || [];
      row.id = row.id || ('r' + Date.now());
      d.recurring.push(row); lsWrite(d); return row;
    }
    const ins = { nm: row.nm, amt: row.amt, cur: row.cur, day: row.day, ic: row.ic, active: row.active !== false, this_month: row.thisMonth || null };
    const { data, error } = await sb.from('recurring').insert(ins).select().single();
    if (error) throw new Error(error.message);
    return { id: data.id, nm: data.nm, amt: +data.amt, cur: data.cur, day: data.day, ic: data.ic, active: data.active !== false, thisMonth: data.this_month || null };
  }

  async function updateRecurring(id, patch) {
    if (!CLOUD) {
      const d = lsRead() || {}; (d.recurring || []).forEach(r => { if (String(r.id) === String(id)) Object.assign(r, patch); }); lsWrite(d); return;
    }
    const up = {};
    if (patch.nm != null) up.nm = patch.nm;
    if (patch.amt != null) up.amt = patch.amt;
    if (patch.cur != null) up.cur = patch.cur;
    if (patch.day != null) up.day = patch.day;
    if (patch.active != null) up.active = patch.active;
    if (patch.thisMonth !== undefined) up.this_month = patch.thisMonth;
    const { error } = await sb.from('recurring').update(up).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async function updateTeam(nm, patch) {
    if (!CLOUD) {
      const d = lsRead() || {}; (d.team || []).forEach(m => { if (m.nm === nm) Object.assign(m, patch); }); lsWrite(d); return;
    }
    const up = {};
    if (patch.paidMonth !== undefined) up.paid_month = patch.paidMonth;
    if (patch.pay != null) up.pay = patch.pay;
    if (patch.share != null) up.share = patch.share;
    const { error } = await sb.from('team').update(up).eq('nm', nm);
    if (error) throw new Error(error.message);
  }

  async function logActivity(e) {
    if (!CLOUD) {
      const d = lsRead() || {}; d.activity = d.activity || [];
      d.activity.unshift({ id: 'a' + Date.now(), who: e.who, action: e.action, detail: e.detail, created_at: e.at });
      if (d.activity.length > 100) d.activity.length = 100;
      lsWrite(d); return;
    }
    const { error } = await sb.from('activity').insert({ who: e.who, action: e.action, detail: e.detail });
    if (error) throw new Error(error.message);
  }

  async function updateTx(id, patch) {
    if (!CLOUD) {
      const d = lsRead() || {}; (d.tx || []).forEach(t => { if (String(t.id) === String(id)) Object.assign(t, patch); }); lsWrite(d); return;
    }
    const up = {};
    if (patch.amt != null) up.amt = patch.amt;
    if (patch.cur != null) up.cur = patch.cur;
    if (patch.origAmt != null) up.orig_amt = patch.origAmt;
    if (patch.desc != null) up.descr = patch.desc;
    if (patch.proj != null) up.proj = patch.proj;
    if (patch.paidFrom != null) up.paid_from = patch.paidFrom;
    if (patch.status != null) up.status = patch.status;
    if (patch.date != null) up.date = patch.date;
    if (patch.edited != null) up.edited = patch.edited;
    if (patch.editedBy != null) up.edited_by = patch.editedBy;
    if (patch.editNote !== undefined) up.edit_note = patch.editNote;
    const { error } = await sb.from('transactions').update(up).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async function updateProject(id, patch) {
    if (!CLOUD) {
      const d = lsRead() || {}; (d.projects || []).forEach(p => { if (String(p.id) === String(id)) Object.assign(p, patch); }); lsWrite(d); return;
    }
    const up = {};
    if (patch.total != null) up.total = patch.total;
    if (patch.cobrado != null) up.cobrado = patch.cobrado;
    if (patch.status != null) up.status = patch.status;
    if (patch.items != null) up.items = patch.items;
    const { error } = await sb.from('projects').update(up).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async function voidTx(id, who) {
    if (!CLOUD) {
      const d = lsRead() || {}; (d.tx || []).forEach(t => { if (String(t.id) === String(id)) { t.voided = true; t.voidedBy = who; } }); lsWrite(d); return;
    }
    const { error } = await sb.from('transactions').update({ voided: true, voided_by: who }).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async function saveSettings(partial) {
    if (!CLOUD) {
      const d = lsRead() || {}; d.settings = Object.assign({}, d.settings, partial); lsWrite(d); return;
    }
    const up = { id: 1 };
    if (partial.display != null) up.display = partial.display;
    if (partial.rate != null) up.rate = partial.rate;
    if (partial.igv != null) { up.igv_on = partial.igv.on; up.igv_rate = partial.igv.rate; }
    if (partial.meta != null) up.meta = partial.meta;
    if (partial.accounts != null) up.accounts = partial.accounts;
    const { error } = await sb.from('settings').upsert(up);
    if (error) throw new Error(error.message);
  }

  // Guarda el snapshot completo (solo modo local; conserva flujo mensual tras editar en memoria)
  async function persistLocal(snap) { if (!CLOUD) lsWrite(snap); }

  // ---------- REALTIME ----------
  function onChange(cb) {
    if (!CLOUD) return;
    sb.channel('vizia-fin')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => cb())
      .subscribe();
  }

  function resetLocal() { localStorage.removeItem(LS); }

  return { init, isCloud, signIn, signOut, getInviteSession, setPassword, currentEmail, fetchAll, addTx, addProject, updateTx, updateProject, voidTx, addRecurring, updateRecurring, updateTeam, logActivity, saveSettings, persistLocal, onChange, resetLocal };
})();
