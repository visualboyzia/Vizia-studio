// VIZIA Finanzas — capa de datos (backend)
// CLOUD (Supabase) si config.js tiene url + anonKey; si no, LOCAL (este dispositivo).
window.Store = (function () {
  const cfg = window.VIZIA_CONFIG || {};
  const CLOUD = !!(cfg.url && cfg.anonKey && /^https?:\/\//.test(cfg.url));
  const LS = 'vizia_fin_v1';
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

  // ---------- LOCAL helpers ----------
  function lsRead() { try { return JSON.parse(localStorage.getItem(LS)); } catch (e) { return null; } }
  function lsWrite(d) { localStorage.setItem(LS, JSON.stringify(d)); }

  // ---------- LOAD ----------
  async function fetchAll(seed) {
    if (!CLOUD) {
      let d = lsRead();
      if (!d) { d = seed; lsWrite(d); }
      return d;
    }
    const [p, tx, tm, rc, st] = await Promise.all([
      sb.from('projects').select('*').order('created_at'),
      sb.from('transactions').select('*').order('date', { ascending: false }),
      sb.from('team').select('*').order('id'),
      sb.from('recurring').select('*').order('day'),
      sb.from('settings').select('*').eq('id', 1).maybeSingle(),
    ]);
    const err = [p, tx, tm, rc, st].find(r => r.error);
    if (err) throw new Error(err.error.message);
    const s = st.data || {};
    return {
      projects: (p.data || []).map(r => ({ id: r.id, nm: r.nm, cl: r.cl, total: +r.total, cobrado: +r.cobrado, status: r.status })),
      tx: (tx.data || []).map(r => ({ id: r.id, t: r.t, amt: +r.amt, cur: r.cur, origAmt: r.orig_amt != null ? +r.orig_amt : Math.abs(+r.amt), desc: r.descr, proj: r.proj, paidFrom: r.paid_from, status: r.status, ic: r.ic, date: r.date })),
      team: (tm.data || []).map(r => ({ nm: r.nm, role: r.role, type: r.type, share: +r.share, pay: +r.pay, av: r.av })),
      recurring: (rc.data || []).map(r => ({ nm: r.nm, amt: +r.amt, cur: r.cur, day: r.day, ic: r.ic })),
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

  return { init, isCloud, signIn, signOut, fetchAll, addTx, saveSettings, persistLocal, onChange, resetLocal };
})();
