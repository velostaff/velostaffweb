(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const key = 'velostaff-direct-admin-v3';
  const backup = window.KV_CATALOG || {plugins: [], settings: {}};
  let state, page = 'overview', editor = null;
  const online = location.protocol !== 'file:';
  let token = sessionStorage.getItem('velostaff-api-token') || '';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const title = os => os === 'mac' ? 'MAC' : 'WINDOWS';

  async function api(path, method = 'GET', payload) {
    const headers = token ? { authorization: `Bearer ${token}` } : {};
    if (payload !== undefined) headers['content-type'] = 'application/json';
    const response = await fetch(`/api${path}`, { method, headers, body: payload === undefined ? undefined : JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Server error');
    return data;
  }
  async function loadOnline() {
    const data = await api('/admin/bootstrap');
    state = { plugins:data.plugins || [], settings:data.settings || {}, emergency:data.emergency || {enabled:false,plugins:[]}, requests:data.requests || [] };
    state.plugins.forEach(p => { p.platformCategories ??= {}; p.platformCategories.mac ??= p.category || 'General'; p.platformCategories.windows ??= p.category || 'General'; });
  }
  function load() {
    try { state = JSON.parse(localStorage.getItem(key) || ''); } catch (_) {}
    state ??= {plugins: backup.plugins || [], settings: backup.settings || {}, emergency: {enabled:false,plugins:[]}, requests:[]};
    state.plugins ??= []; state.requests ??= [];
    state.emergency ??= {enabled:false,plugins:[]}; state.emergency.plugins ??= [];
    // Old shared categories are copied once, then Mac and Windows stay independent.
    state.plugins.forEach(p => {
      p.platformCategories ??= {};
      p.platformCategories.mac ??= p.category || 'General';
      p.platformCategories.windows ??= p.category || 'General';
    });
    save();
  }
  function save() { if (!online) localStorage.setItem(key, JSON.stringify(state)); }
  function toast(msg) { const el = $('#toast'); if (!el) return; el.textContent = msg; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2300); }
  function cat(p, os) { return p.platformCategories?.[os] || p.category || 'General'; }
  function nav() {
    const links = [['overview','◇','OVERVIEW'],['plugins','▦','PLUGINS'],['messages','✉','MESSAGES'],['emergency','!','EMERGENCY'],['settings','◎','SETTINGS'],['security','⌘','SECURITY']];
    return `<aside class="sidebar"><div class="side-brand"><div class="brand-square">VS</div><div>VELO STAFF<small>DIRECT HTML MODE</small></div></div><div class="sidebar-label">WORKSPACE</div><nav class="side-nav">${links.map(([id,i,n]) => `<button data-page="${id}" class="${page===id?'active':''}"><i>${i}</i>${n}</button>`).join('')}</nav><div class="side-spacer"></div><a class="outside-link" href="index.html" target="_blank">OPEN WEBSITE ↗</a></aside>`;
  }
  function alt(v='') { return `<div class="link-row"><input type="url" value="${esc(v)}" placeholder="Alternative link"><button class="secondary compact" type="button" data-remove>REMOVE</button></div>`; }
  function pluginRow(p, os) {
    const n = 1 + (p.platforms?.[os]?.alternatives || []).filter(Boolean).length;
    return `<div class="plugin-row"><div><strong>${esc(p.title)}</strong><small>v${esc(p.version||'1.0')} · ${n} link${n===1?'':'s'}</small></div><div><button class="table-action" data-edit="${esc(p.id)}" data-os="${os}">EDIT</button><button class="table-action danger" data-delete="${esc(p.id)}">DELETE</button></div></div>`;
  }
  function categories(os) {
    const names = [...new Set(state.plugins.filter(p => p.platforms?.[os]?.url).map(p => cat(p,os)))].sort((a,b)=>a.localeCompare(b));
    if (!names.length) return '<div class="empty">No plugins yet. Add your first plugin above.</div>';
    return names.map(name => {
      const items = state.plugins.filter(p => p.platforms?.[os]?.url && cat(p,os) === name);
      return `<details class="plugin-category" open><summary><span>${esc(name)}</span><b>${items.length}</b><button class="category-pencil" type="button" title="Rename ${title(os)} category" data-rename-category="${esc(name)}" data-os="${os}">✎</button><i>⌄</i></summary>${items.map(p=>pluginRow(p,os)).join('')}</details>`;
    }).join('');
  }
  function form(os) {
    if (!editor || editor.os !== os) return '';
    const p = editor.plugin || {title:'',version:'1.0',platforms:{[os]:{url:'',alternatives:[]}}};
    const d = p.platforms?.[os] || {};
    const options = [...new Set(state.plugins.filter(x=>x.platforms?.[os]?.url).map(x=>cat(x,os)))].sort();
    return `<form class="inline-plugin-form" data-form data-os="${os}"><div class="inline-head">${editor.plugin?'EDIT':'ADD'} ${title(os)} PLUGIN</div><div class="inline-fields"><label>PLUGIN NAME<input name="pluginTitle" required value="${esc(p.title)}"></label><label>VERSION<input name="version" required value="${esc(p.version||'1.0')}"></label><label>CATEGORY<input name="category" list="category-${os}" required value="${esc(cat(p,os))}"><datalist id="category-${os}">${options.map(x=>`<option value="${esc(x)}">`).join('')}</datalist></label><label>PRIMARY LINK<input name="url" type="url" required value="${esc(d.url||'')}"></label></div><label class="alt-title">ALTERNATIVE LINKS</label><div class="alternatives">${(d.alternatives||[]).map(alt).join('')}</div><button class="secondary compact" type="button" data-add>+ ADD MORE</button><button class="primary inline-save">${editor.plugin?'UPDATE':'ADD'} ${title(os)} PLUGIN</button></form>`;
  }
  function panel(os) {
    const count = state.plugins.filter(p=>p.platforms?.[os]?.url).length;
    return `<section class="platform-card"><div class="platform-title"><h4>${title(os)}</h4><span>${count} PLUGIN${count===1?'':'S'}</span></div><button class="primary" data-start="${os}">+ ADD ${title(os)} PLUGIN</button>${form(os)}<div class="plugin-list categorized-list">${categories(os)}</div></section>`;
  }
  function plugins() { return `<div class="section-row"><div><div class="red-label">ORGANISED LIBRARY</div><h3>PLUGINS<span>.</span></h3><p>Mac and Windows categories are separate. Editing one never changes the other.</p></div></div><div class="platform-columns">${panel('mac')}${panel('windows')}</div>`; }
  function overview() {
    const p = state.plugins, m = p.filter(x=>x.platforms?.mac?.url).length, w = p.filter(x=>x.platforms?.windows?.url).length;
    return `<div class="intro"><div><div class="red-label">SYSTEM OVERVIEW</div><h3>COMMAND<br><em>CENTER.</em></h3><p>Manage your plugin library from one workspace.</p></div><div class="intro-mark">V<span>S</span></div></div><div class="stats"><article><span>ALL PLUGINS</span><strong>${String(p.length).padStart(2,'0')}</strong><small>Saved plugins</small></article><article><span>WINDOWS PLUGINS</span><strong>${String(w).padStart(2,'0')}</strong><small>Windows records</small></article><article><span>MAC PLUGINS</span><strong>${String(m).padStart(2,'0')}</strong><small>Mac records</small></article></div>`;
  }
  function messages() { return `<div class="section-row"><div><div class="red-label">VISITOR REQUESTS</div><h3>MESSAGES<span>.</span></h3></div></div><div class="content-box">${state.requests.length ? state.requests.map(r=>`<div class="request-row"><div><strong>${esc(r.pluginName||r.name)}</strong><small>${esc(r.platform||'')} · ${esc(r.email||'')}</small></div></div>`).join('') : '<div class="empty">No plugin requests yet.</div>'}</div>`; }
  function emergency() { const e=state.emergency; return `<div class="section-row"><div><div class="red-label">ADMIN ONLY</div><h3>EMERGENCY<span>.</span></h3></div></div><div class="danger-box"><div class="red-label">CURRENT MODE</div><div class="emergency-state">${e.enabled?'ON':'OFF'}</div><p>Normal plugins are hidden only while this mode is active. Emergency plugins remain available.</p><button id="toggleEmergency" class="primary">${e.enabled?'DEACTIVATE':'ACTIVATE'} EMERGENCY MODE</button></div>`; }
  function settings() { const s=state.settings; return `<div class="section-row"><div><div class="red-label">PUBLIC WEBSITE</div><h3>SETTINGS<span>.</span></h3></div></div><form id="settingsForm" class="content-box admin-form"><label>SITE NAME<input name="siteName" value="${esc(s.siteName||'VELO STAFF')}"></label><label>DISCORD LINK<input name="discordUrl" value="${esc(s.discordUrl||'')}"></label><label>TAGLINE<input name="tagline" value="${esc(s.tagline||'')}"></label><label>HEADER ANNOUNCEMENT<input name="announcement" value="${esc(s.announcement||'')}"></label><button class="primary">SAVE SETTINGS</button></form>`; }
  function security() { return '<div class="section-row"><div><div class="red-label">SECURITY</div><h3>SECURITY<span>.</span></h3></div></div><div class="content-box"><h4>DIRECT HTML MODE</h4><p>Admin and moderator access can be configured here for this browser.</p></div>'; }
  function render() {
    const view={overview,plugins,messages,emergency,settings,security}[page]();
    $('#app').innerHTML = `${nav()}<div class="admin-main"><header class="admin-top"><div><span class="red-label">VELO STAFF / MANAGEMENT</span><h2>${page[0].toUpperCase()+page.slice(1)}</h2></div><button id="quickAdd" class="primary">+ ADD PLUGIN</button></header><div class="app-content">${view}</div><footer class="admin-footer"><span>VELO STAFF</span><span>${online?'MONGODB LIVE SYNC':'DIRECT BROWSER STORAGE'}</span></footer></div>`;
    $('#app').classList.remove('hidden'); $('#login').classList.add('hidden');
    $('#quickAdd').onclick=()=>{page='plugins';editor={os:'windows',plugin:null};render()};
    if(page==='settings') $('#settingsForm').onsubmit=async e=>{e.preventDefault();const next={...state.settings,...Object.fromEntries(new FormData(e.currentTarget))};try{if(online){state.settings=(await api('/admin/settings','POST',next)).settings}else{state.settings=next;save()}toast('Settings saved')}catch(error){toast(error.message)}};
    if(page==='emergency') $('#toggleEmergency').onclick=async()=>{try{const enabled=!state.emergency.enabled;if(online){state.emergency=(await api('/admin/emergency/toggle','POST',{enabled})).emergency}else{state.emergency.enabled=enabled;save()}render();toast('Emergency Mode updated')}catch(error){toast(error.message)}};
  }
  $('#app').addEventListener('click', e => {
    const pageBtn=e.target.closest('[data-page]');
    if(pageBtn){page=pageBtn.dataset.page;editor=null;render();return}
    const b=e.target.closest('[data-start],[data-add],[data-remove],[data-edit],[data-delete],[data-rename-category]');
    if(!b)return;
    if(b.dataset.start){editor={os:b.dataset.start,plugin:null};render();return}
    if(b.hasAttribute('data-add')){b.previousElementSibling.insertAdjacentHTML('beforeend',alt());return}
    if(b.hasAttribute('data-remove')){b.closest('.link-row')?.remove();return}
    if(b.dataset.edit){editor={os:b.dataset.os,plugin:state.plugins.find(p=>p.id===b.dataset.edit)};render();return}
    if(b.dataset.delete){if(!confirm('Delete this plugin?'))return;if(online){api(`/admin/plugins/${encodeURIComponent(b.dataset.delete)}`,'DELETE').then(loadOnline).then(()=>{render();toast('Plugin deleted')}).catch(error=>toast(error.message))}else{state.plugins=state.plugins.filter(p=>p.id!==b.dataset.delete);save();render();toast('Plugin deleted')}return}
    if(b.dataset.renameCategory){
      e.preventDefault();e.stopPropagation();
      const old=b.dataset.renameCategory, os=b.dataset.os, next=prompt(`Rename ${title(os)} category`,old)?.trim();
      if(!next||next===old)return;
      state.plugins.forEach(p=>{if(p.platforms?.[os]?.url&&cat(p,os)===old){p.platformCategories??={};p.platformCategories[os]=next}});
      if(online){Promise.all(state.plugins.filter(p=>p.platforms?.[os]?.url&&cat(p,os)===old).map(p=>api(`/admin/plugins/${encodeURIComponent(p.id)}`,'PUT',p))).then(loadOnline).then(()=>{render();toast(`${title(os)} category renamed`)}).catch(error=>toast(error.message))}else{save();render();toast(`${title(os)} category renamed`)}
    }
  });
  $('#app').addEventListener('submit', async e => {
    const f=e.target;if(!f.matches('[data-form]'))return;e.preventDefault();
    const os=f.dataset.os, fd=new FormData(f), old=editor?.plugin;
    const p=old?structuredClone(old):{id:crypto.randomUUID(),platforms:{mac:{},windows:{}},createdAt:new Date().toISOString(),updatedBy:'Admin'};
    p.title=fd.get('pluginTitle').trim();p.version=fd.get('version').trim();p.description??='';
    p.platforms??={mac:{},windows:{}};p.platforms[os]={url:fd.get('url').trim(),alternatives:[...f.querySelectorAll('.alternatives input')].map(x=>x.value.trim()).filter(Boolean)};
    p.platformCategories??={};p.platformCategories[os]=fd.get('category').trim()||'General';p.category??=p.platformCategories[os];p.updatedAt=new Date().toISOString();
    try{if(online){await api(old?`/admin/plugins/${encodeURIComponent(old.id)}`:'/admin/plugins',old?'PUT':'POST',p);await loadOnline()}else{if(old)state.plugins[state.plugins.findIndex(x=>x.id===old.id)]=p;else state.plugins.unshift(p);save()}editor=null;render();toast(online?'Plugin saved — live now':'Plugin saved — refresh index.html')}catch(error){toast(error.message)}
  });
  async function startOnline(){
    const login=$('#login'), app=$('#app'), form=$('#loginForm');
    async function enter(){try{await loadOnline();render()}catch(_){app.classList.add('hidden');login.classList.remove('hidden')}}
    if(token){await enter();if(!app.classList.contains('hidden'))return}
    app.classList.add('hidden');login.classList.remove('hidden');
    form.addEventListener('submit',async event=>{event.preventDefault();const error=$('#loginError');error.textContent='';try{const data=await api('/login','POST',{username:$('#username').value.trim(),password:$('#password').value});token=data.token;sessionStorage.setItem('velostaff-api-token',token);await loadOnline();render();$('#password').value=''}catch(err){error.textContent=err.message}});
  }
  if(online)startOnline();else{load();render()}
})();
