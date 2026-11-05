import { MongoClient } from 'mongodb';

let client;
const encoder = new TextEncoder();
const json = (data, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
const fail = (message, status = 400) => json({ error: message }, status);

async function database(env) {
  if (!env.MONGODB_URI) throw new Error('MONGODB_URI secret is not configured');
  client ??= new MongoClient(env.MONGODB_URI, {
    maxPoolSize: 3,
    minPoolSize: 0,
    serverSelectionTimeoutMS: 7000,
    maxIdleTimeMS: 20000
  });
  await client.connect();
  return client.db('velostaff');
}

function clean(value, length = 300) {
  return String(value ?? '').trim().slice(0, length);
}
function validUrl(value) {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) ? url.href : '';
  } catch { return ''; }
}
function initialState() {
  return {
    _id: 'main',
    plugins: [],
    settings: { siteName: 'VELO STAFF', discordUrl: 'https://discord.gg/Yx5VaqPtFq', tagline: '', announcement: '' },
    emergency: { enabled: false, plugins: [] },
    requests: [],
    updatedAt: new Date().toISOString()
  };
}
async function stateDoc(db) {
  let doc = await db.collection('state').findOne({ _id: 'main' });
  if (!doc) {
    doc = initialState();
    await db.collection('state').insertOne(doc);
  }
  return doc;
}
function publicState(doc) {
  return {
    plugins: doc.emergency?.enabled ? (doc.emergency.plugins || []) : (doc.plugins || []),
    settings: doc.settings || {},
    emergency: !!doc.emergency?.enabled
  };
}
async function sign(value, secret) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
async function token(env) {
  const payload = btoa(JSON.stringify({ role: 'admin', exp: Date.now() + 1000 * 60 * 60 * 12 })).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  return `${payload}.${await sign(payload, env.AUTH_SECRET)}`;
}
async function authorised(request, env) {
  const raw = request.headers.get('authorization') || '';
  const [payload, signature] = raw.replace(/^Bearer\s+/i, '').split('.');
  if (!payload || !signature || !env.AUTH_SECRET) return false;
  if (signature !== await sign(payload, env.AUTH_SECRET)) return false;
  try { return JSON.parse(atob(payload.replaceAll('-', '+').replaceAll('_', '/'))).exp > Date.now(); } catch { return false; }
}
async function body(request) {
  try { return await request.json(); } catch { return {}; }
}
function normalPlugin(data, old = {}) {
  const platform = key => {
    const value = data.platforms?.[key] || old.platforms?.[key] || {};
    return { url: validUrl(value.url || ''), alternatives: (value.alternatives || []).map(validUrl).filter(Boolean) };
  };
  const mac = platform('mac'), windows = platform('windows');
  if (!clean(data.title, 120)) throw new Error('Plugin name is required');
  if (!mac.url && !windows.url) throw new Error('At least one download link is required');
  return {
    ...old,
    id: old.id || crypto.randomUUID(),
    title: clean(data.title, 120),
    version: clean(data.version || '1.0', 40),
    description: clean(data.description, 1200),
    category: clean(data.category || old.category || 'General', 80),
    platformCategories: {
      mac: clean(data.platformCategories?.mac || old.platformCategories?.mac || data.category || 'General', 80),
      windows: clean(data.platformCategories?.windows || old.platformCategories?.windows || data.category || 'General', 80)
    },
    platforms: { mac, windows },
    updatedAt: new Date().toISOString()
  };
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const method = request.method.toUpperCase();
  const part = Array.isArray(params.path) ? params.path.join('/') : (params.path || '');
  const path = '/' + part;
  try {
    const db = await database(env);
    const doc = await stateDoc(db);
    if (method === 'GET' && path === '/state') return json(publicState(doc));
    if (method === 'POST' && path === '/login') {
      const data = await body(request);
      if (!env.ADMIN_PASSWORD || clean(data.username, 60).toLowerCase() !== 'admin' || data.password !== env.ADMIN_PASSWORD) return fail('Invalid credentials', 401);
      return json({ token: await token(env), role: 'admin', name: 'Admin' });
    }
    if (method === 'POST' && path === '/requests') {
      const data = await body(request);
      const pluginName = clean(data.pluginName, 100), platform = clean(data.platform, 10).toLowerCase();
      if (!pluginName || !['mac', 'windows'].includes(platform)) return fail('Plugin name and platform are required');
      doc.requests.unshift({ id: crypto.randomUUID(), pluginName, platform, email: clean(data.email, 180), name: clean(data.name, 80), message: clean(data.message, 1200), notify: !!data.notify, createdAt: new Date().toISOString() });
      doc.updatedAt = new Date().toISOString();
      await db.collection('state').replaceOne({ _id: 'main' }, doc);
      return json({ ok: true }, 201);
    }
    if (!await authorised(request, env)) return fail('Sign in required', 401);
    if (method === 'GET' && path === '/admin/bootstrap') return json({ plugins: doc.plugins, settings: doc.settings, emergency: doc.emergency, requests: doc.requests });
    if (method === 'POST' && path === '/admin/plugins') {
      const plugin = normalPlugin(await body(request));
      doc.plugins.unshift(plugin); doc.updatedAt = new Date().toISOString();
      await db.collection('state').replaceOne({ _id: 'main' }, doc);
      return json({ plugin }, 201);
    }
    const pluginMatch = path.match(/^\/admin\/plugins\/([\w-]+)$/);
    if (pluginMatch && method === 'PUT') {
      const index = doc.plugins.findIndex(p => p.id === pluginMatch[1]);
      if (index < 0) return fail('Plugin not found', 404);
      doc.plugins[index] = normalPlugin(await body(request), doc.plugins[index]); doc.updatedAt = new Date().toISOString();
      await db.collection('state').replaceOne({ _id: 'main' }, doc);
      return json({ plugin: doc.plugins[index] });
    }
    if (pluginMatch && method === 'DELETE') {
      doc.plugins = doc.plugins.filter(p => p.id !== pluginMatch[1]); doc.updatedAt = new Date().toISOString();
      await db.collection('state').replaceOne({ _id: 'main' }, doc);
      return json({ ok: true });
    }
    if (method === 'POST' && path === '/admin/emergency/toggle') {
      doc.emergency.enabled = !!(await body(request)).enabled; doc.updatedAt = new Date().toISOString();
      await db.collection('state').replaceOne({ _id: 'main' }, doc);
      return json({ emergency: doc.emergency });
    }
    if (method === 'POST' && path === '/admin/settings') {
      const data = await body(request);
      doc.settings = { ...doc.settings, siteName: clean(data.siteName, 100) || 'VELO STAFF', discordUrl: validUrl(data.discordUrl || doc.settings.discordUrl), tagline: clean(data.tagline, 260), announcement: clean(data.announcement, 120) };
      doc.updatedAt = new Date().toISOString();
      await db.collection('state').replaceOne({ _id: 'main' }, doc);
      return json({ settings: doc.settings });
    }
    return fail('Route not found', 404);
  } catch (error) {
    console.error(error);
    const message = String(error?.message || '');
    const safe = message.includes('MONGODB_URI') ? 'Mongo secret missing' : message.match(/auth|password|authentication/i) ? 'Mongo authentication failed' : message.match(/server selection|timed out|ENOTFOUND|network/i) ? 'Mongo network access failed' : 'Mongo server setup error';
    const detail = message.replace(/mongodb(?:\+srv)?:\/\/[^@\s]+@/gi, 'mongodb://***@').slice(0, 220);
    return json({ error: safe, code: String(error?.name || 'UnknownError'), detail }, 500);
  }
}
