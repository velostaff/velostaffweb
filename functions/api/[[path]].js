const json = (data, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
const fail = (message, status = 400) => json({ error: message }, status);

function clean(value, length = 300) { return String(value ?? '').trim().slice(0, length); }
function validUrl(value) { try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? url.href : ''; } catch { return ''; } }
function initialState() { return { plugins: [], settings: { siteName: 'VELO STAFF', discordUrl: 'https://discord.gg/Yx5VaqPtFq', tagline: '', announcement: '' }, emergency: { enabled: false, plugins: [] }, requests: [], sessions: [], moderators: [], adminAccount: null, analytics: { presence: {}, pageViews: [], daily: {}, bucketMigrated: false }, updatedAt: new Date().toISOString() }; }
async function database(env) {
  if (!env.VELO_DB) throw new Error('VELO_DB D1 binding is not configured');
  await env.VELO_DB.exec('CREATE TABLE IF NOT EXISTS velostaff_state (id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS velostaff_visitors (visitor_id TEXT PRIMARY KEY, last_seen INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS velostaff_pageviews (id INTEGER PRIMARY KEY AUTOINCREMENT, visited_at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS idx_velostaff_visitors_seen ON velostaff_visitors(last_seen); CREATE INDEX IF NOT EXISTS idx_velostaff_pageviews_at ON velostaff_pageviews(visited_at);');
  return env.VELO_DB;
}
async function persist(db, doc) { await db.prepare('INSERT INTO velostaff_state (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data').bind('main', JSON.stringify(doc)).run(); }
async function stateDoc(db) {
  const row = await db.prepare('SELECT data FROM velostaff_state WHERE id = ?').bind('main').first();
  if (row?.data) try { return { ...initialState(), ...JSON.parse(row.data) }; } catch { /* reset unreadable state */ }
  const doc = initialState(); await persist(db, doc); return doc;
}
function publicState(doc) { return { plugins: doc.emergency?.enabled ? (doc.emergency.plugins || []) : (doc.plugins || []), settings: doc.settings || {}, emergency: !!doc.emergency?.enabled }; }
function dateKey(value) { return new Date(value).toISOString().slice(0, 10); }
function analyticsSeries(analytics, period) {
  const now = new Date(), sumDays = (start, days) => {
    let value = 0;
    for (let offset = 0; offset < days; offset++) { const day = new Date(start); day.setUTCDate(day.getUTCDate() + offset); value += analytics.daily[dateKey(day)] || 0; }
    return value;
  };
  if (period === 'week') return Array.from({ length: 12 }, (_, index) => { const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (11 - index) * 7 - 6)); return { label: start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }), value: sumDays(start, 7) }; });
  if (period === 'month') return Array.from({ length: 12 }, (_, index) => { const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - index), 1)), end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)); return { label: start.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }), value: sumDays(start, Math.round((end - start) / 86400000)) }; });
  if (period === 'year') return Array.from({ length: 5 }, (_, index) => { const year = now.getUTCFullYear() - (4 - index), start = new Date(Date.UTC(year, 0, 1)), end = new Date(Date.UTC(year + 1, 0, 1)); return { label: String(year), value: sumDays(start, Math.round((end - start) / 86400000)) }; });
  return Array.from({ length: 30 }, (_, index) => { const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (29 - index))); return { label: String(day.getUTCDate()), value: analytics.daily[dateKey(day)] || 0 }; });
}
async function analyticsSummary(db, period = 'day') {
  const now = Date.now(), activeSince = now - 90 * 1000, historySince = Date.UTC(new Date().getUTCFullYear() - 4, 0, 1);
  await db.prepare('DELETE FROM velostaff_visitors WHERE last_seen < ?').bind(activeSince).run();
  const [liveRow, viewRows] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS total FROM velostaff_visitors WHERE last_seen >= ?').bind(activeSince).first(),
    db.prepare('SELECT visited_at FROM velostaff_pageviews WHERE visited_at >= ? ORDER BY visited_at ASC').bind(historySince).all()
  ]);
  const visits = viewRows.results || [], analytics = { daily: {} };
  for (const visit of visits) { const key = dateKey(visit.visited_at); analytics.daily[key] = (analytics.daily[key] || 0) + 1; }
  const recentDays = analyticsSeries(analytics, 'day'), series = analyticsSeries(analytics, period), daySince = now - 86400000;
  return { liveVisitors: Number(liveRow?.total || 0), pageViews24h: visits.filter(item => item.visited_at >= daySince).length, views30d: recentDays.reduce((sum, item) => sum + item.value, 0), period, series };
}
async function passwordRecord(password) {
  const salt = crypto.randomUUID();
  const bytes = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return { salt, hash: [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('') };
}
async function passwordMatches(password, account) {
  if (!account?.salt || !account?.hash) return false;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${account.salt}:${password}`));
  const candidate = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return candidate === account.hash;
}
function createSession(doc, role, username) {
  const value = `${crypto.randomUUID()}${crypto.randomUUID()}`, now = Date.now();
  const active = (doc.sessions || []).filter(session => session?.expiresAt > now);
  active.push({ value, role, username, expiresAt: now + 1000 * 60 * 60 * 12 }); doc.sessions = active.slice(-20); return value;
}
function authorised(request, doc) {
  const value = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''), now = Date.now();
  doc.sessions = (doc.sessions || []).filter(session => session?.expiresAt > now);
  return value ? doc.sessions.find(session => session.value === value) || null : null;
}
async function body(request) { try { return await request.json(); } catch { return {}; } }
function normalPlugin(data, old = {}) {
  const platform = key => { const value = data.platforms?.[key] || old.platforms?.[key] || {}; return { url: validUrl(value.url || ''), alternatives: (value.alternatives || []).map(validUrl).filter(Boolean) }; };
  const mac = platform('mac'), windows = platform('windows');
  if (!clean(data.title, 120)) throw new Error('Plugin name is required');
  if (!mac.url && !windows.url) throw new Error('At least one download link is required');
  return { ...old, id: old.id || crypto.randomUUID(), title: clean(data.title, 120), version: clean(data.version || '1.0', 40), description: clean(data.description, 1200), category: clean(data.category || old.category || 'General', 80), platformCategories: { mac: clean(data.platformCategories?.mac || old.platformCategories?.mac || data.category || 'General', 80), windows: clean(data.platformCategories?.windows || old.platformCategories?.windows || data.category || 'General', 80) }, platforms: { mac, windows }, updatedAt: new Date().toISOString() };
}
function emergencyPlugin(data) {
  const platform = key => {
    const value = data.platforms?.[key] || {};
    return { url: validUrl(value.url || ''), alternatives: (value.alternatives || []).map(validUrl).filter(Boolean) };
  };
  const mac = platform('mac'), windows = platform('windows');
  if (!clean(data.title, 120)) throw new Error('Plugin name is required');
  if (!mac.url && !windows.url) throw new Error('At least one download link is required');
  return { id: crypto.randomUUID(), title: clean(data.title, 120), version: clean(data.version || '1.0', 40), description: clean(data.description, 1200), platforms: { mac, windows }, createdAt: new Date().toISOString() };
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const method = request.method.toUpperCase(), part = Array.isArray(params.path) ? params.path.join('/') : (params.path || ''), path = '/' + part;
  try {
    const db = await database(env), doc = await stateDoc(db);
    if (method === 'GET' && path === '/state') return json(publicState(doc));
    if (method === 'POST' && path === '/track') {
      const data = await body(request), visitorId = clean(data.visitorId, 80);
      if (!/^[a-z0-9-]{16,80}$/i.test(visitorId)) return fail('Invalid visitor');
      const now = Date.now();
      await db.prepare('INSERT INTO velostaff_visitors (visitor_id, last_seen) VALUES (?, ?) ON CONFLICT(visitor_id) DO UPDATE SET last_seen = excluded.last_seen').bind(visitorId, now).run();
      if (data.event === 'pageview') await db.prepare('INSERT INTO velostaff_pageviews (visited_at) VALUES (?)').bind(now).run();
      return json({ ok: true, analytics: await analyticsSummary(db) });
    }
    if (method === 'POST' && path === '/login') {
      const data = await body(request);
      const username = clean(data.username, 60);
      const adminLogin = username.toLowerCase() === 'admin' && (!!env.ADMIN_PASSWORD && data.password === env.ADMIN_PASSWORD || await passwordMatches(data.password, doc.adminAccount));
      const moderator = !adminLogin && (doc.moderators || []).find(item => item.username.toLowerCase() === username.toLowerCase());
      const moderatorLogin = moderator && await passwordMatches(data.password, moderator);
      if (!adminLogin && !moderatorLogin) return fail('Invalid credentials', 401);
      const role = adminLogin ? 'admin' : 'moderator', name = adminLogin ? 'Admin' : moderator.username;
      const loginToken = createSession(doc, role, name); await persist(db, doc); return json({ token: loginToken, role, name });
    }
    if (method === 'POST' && path === '/requests') {
      const data = await body(request), pluginName = clean(data.pluginName, 100), platform = clean(data.platform, 10).toLowerCase();
      if (!pluginName || !['mac', 'windows'].includes(platform)) return fail('Plugin name and platform are required');
      doc.requests.unshift({ id: crypto.randomUUID(), pluginName, platform, email: clean(data.email, 180), name: clean(data.name, 80), message: clean(data.message, 1200), notify: !!data.notify, createdAt: new Date().toISOString() });
      doc.updatedAt = new Date().toISOString(); await persist(db, doc); return json({ ok: true }, 201);
    }
    const actor = authorised(request, doc);
    if (!actor) return fail('Sign in required', 401);
    const isAdmin = actor.role === 'admin';
    if (method === 'GET' && path === '/admin/bootstrap') return json({ plugins: doc.plugins, settings: doc.settings, emergency: doc.emergency, requests: doc.requests, moderators: isAdmin ? doc.moderators : [], actor: { role: actor.role, name: actor.username }, analytics: await analyticsSummary(db) });
    if (method === 'GET' && path === '/admin/analytics') { if (!isAdmin) return fail('Admin permission required', 403); const period = new URL(request.url).searchParams.get('period') || 'day'; return json({ analytics: await analyticsSummary(db, ['day','week','month','year'].includes(period) ? period : 'day') }); }
    if (method === 'POST' && path === '/admin/plugins') { const plugin = normalPlugin(await body(request)); doc.plugins.unshift(plugin); doc.updatedAt = new Date().toISOString(); await persist(db, doc); return json({ plugin }, 201); }
    const pluginMatch = path.match(/^\/admin\/plugins\/([\w-]+)$/);
    if (pluginMatch && method === 'PUT') { const index = doc.plugins.findIndex(p => p.id === pluginMatch[1]); if (index < 0) return fail('Plugin not found', 404); doc.plugins[index] = normalPlugin(await body(request), doc.plugins[index]); doc.updatedAt = new Date().toISOString(); await persist(db, doc); return json({ plugin: doc.plugins[index] }); }
    if (pluginMatch && method === 'DELETE') { if (!isAdmin) return fail('Admin permission required', 403); doc.plugins = doc.plugins.filter(p => p.id !== pluginMatch[1]); doc.updatedAt = new Date().toISOString(); await persist(db, doc); return json({ ok: true }); }
    if (method === 'POST' && path === '/admin/emergency/toggle') { if (!isAdmin) return fail('Admin permission required', 403); doc.emergency.enabled = !!(await body(request)).enabled; doc.updatedAt = new Date().toISOString(); await persist(db, doc); return json({ emergency: doc.emergency }); }
    if (method === 'POST' && path === '/admin/emergency/plugins') {
      if (!isAdmin) return fail('Admin permission required', 403);
      const plugin = emergencyPlugin(await body(request)); doc.emergency.plugins.unshift(plugin); doc.updatedAt = new Date().toISOString(); await persist(db, doc); return json({ plugin }, 201);
    }
    const emergencyPluginMatch = path.match(/^\/admin\/emergency\/plugins\/([\w-]+)$/);
    if (emergencyPluginMatch && method === 'DELETE') {
      if (!isAdmin) return fail('Admin permission required', 403);
      doc.emergency.plugins = doc.emergency.plugins.filter(plugin => plugin.id !== emergencyPluginMatch[1]); doc.updatedAt = new Date().toISOString(); await persist(db, doc); return json({ ok: true });
    }
    if (method === 'POST' && path === '/admin/settings') { if (!isAdmin) return fail('Admin permission required', 403); const data = await body(request); doc.settings = { ...doc.settings, siteName: clean(data.siteName, 100) || 'VELO STAFF', discordUrl: validUrl(data.discordUrl || doc.settings.discordUrl), tagline: clean(data.tagline, 260), announcement: clean(data.announcement, 120) }; doc.updatedAt = new Date().toISOString(); await persist(db, doc); return json({ settings: doc.settings }); }
    if (method === 'POST' && path === '/admin/security/admin-password') {
      if (!isAdmin) return fail('Admin permission required', 403);
      const data = await body(request), password = String(data.password || '');
      if (password.length < 8) return fail('Admin password needs at least 8 characters');
      doc.adminAccount = { ...await passwordRecord(password), updatedAt: new Date().toISOString() }; doc.updatedAt = new Date().toISOString(); await persist(db, doc); return json({ ok: true });
    }
    if (method === 'POST' && path === '/admin/moderators') {
      if (!isAdmin) return fail('Admin permission required', 403);
      const data = await body(request), username = clean(data.username, 40), password = String(data.password || '');
      if (!/^[a-z0-9._-]{3,40}$/i.test(username) || username.toLowerCase() === 'admin') return fail('Use a unique moderator username (3–40 letters, numbers, . _ or -)');
      if (password.length < 8) return fail('Moderator password needs at least 8 characters');
      if ((doc.moderators || []).some(item => item.username.toLowerCase() === username.toLowerCase())) return fail('That moderator username already exists');
      doc.moderators.push({ id: crypto.randomUUID(), username, ...await passwordRecord(password), createdAt: new Date().toISOString() }); doc.updatedAt = new Date().toISOString(); await persist(db, doc); return json({ moderators: doc.moderators });
    }
    const moderatorMatch = path.match(/^\/admin\/moderators\/([\w-]+)$/);
    if (moderatorMatch && method === 'PUT') {
      if (!isAdmin) return fail('Admin permission required', 403);
      const data = await body(request), password = String(data.password || ''), index = (doc.moderators || []).findIndex(item => item.id === moderatorMatch[1]);
      if (index < 0) return fail('Moderator not found', 404); if (password.length < 8) return fail('Moderator password needs at least 8 characters');
      doc.moderators[index] = { ...doc.moderators[index], ...await passwordRecord(password), updatedAt: new Date().toISOString() }; doc.updatedAt = new Date().toISOString(); await persist(db, doc); return json({ moderators: doc.moderators });
    }
    if (moderatorMatch && method === 'DELETE') { if (!isAdmin) return fail('Admin permission required', 403); doc.moderators = doc.moderators.filter(item => item.id !== moderatorMatch[1]); doc.updatedAt = new Date().toISOString(); await persist(db, doc); return json({ ok: true }); }
    return fail('Route not found', 404);
  } catch (error) {
    console.error(error); const message = String(error?.message || '');
    return json({ error: message.includes('VELO_DB') ? 'Database binding is not configured yet' : 'Database server error' }, 500);
  }
}
