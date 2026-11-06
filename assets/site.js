(() => {
 'use strict';
 const $=q=>document.querySelector(q),$$=q=>Array.from(document.querySelectorAll(q));
 const catalog=window.KV_CATALOG||{plugins:[],settings:{}};let directCatalog=null;try{directCatalog=JSON.parse(localStorage.getItem('velostaff-direct-admin-v3')||'')}catch{}const fallback=location.protocol==='file:'&&directCatalog?{plugins:directCatalog.emergency?.enabled?directCatalog.emergency.plugins:directCatalog.plugins,settings:directCatalog.settings||catalog.settings}:{...catalog};
 let plugins=Array.isArray(fallback.plugins)?fallback.plugins:[], settings=fallback.settings||{};if(location.protocol==='file:'&&directCatalog?.emergency?.enabled)document.body.classList.add('emergency-active');
 let platform='windows',category='All',query='';
 const allSystemsButton=document.querySelector('[data-platform="all"]');if(allSystemsButton)allSystemsButton.remove();document.querySelector('[data-platform="windows"]')?.classList.add('active');
 const toast=(msg)=>{const e=$('#toast');e.textContent=msg;e.classList.add('show');clearTimeout(window.toastClock);window.toastClock=setTimeout(()=>e.classList.remove('show'),3300)};
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const validUrl=s=>{try{let u=new URL(s);return ['http:','https:'].includes(u.protocol)?u.href:null}catch{return null}};
 const categoryFor=(p,os)=>p.platformCategories?.[os]||p.category||'General';
 function show(){
  const cats=['All',...new Set(plugins.filter(p=>platform==='all'||p.platforms?.[platform]?.url||p.platforms?.[platform]?.fileKey).map(p=>categoryFor(p,platform)))];if(!cats.includes(category))category='All';
  $('#categoryFilters').innerHTML=cats.map(c=>`<button type="button" class="${category===c?'active':''}" data-cat="${escape(c)}">${escape(c).toUpperCase()}</button>`).join('');
  const found=plugins.filter(p=>(platform==='all'||(p.platforms?.[platform]&&(p.platforms[platform].url||p.platforms[platform].fileKey)))&&(category==='All'||categoryFor(p,platform)===category)&&(!query||[p.title,p.description,categoryFor(p,platform),p.version].some(x=>String(x||'').toLowerCase().includes(query))));
  $('#totalPlugins').textContent=String(plugins.length).padStart(2,'0');
  $('#emptyState').style.display=found.length?'none':'flex';
  if(!found.length){$('#pluginGrid').innerHTML='';if(plugins.length){$('#emptyState').querySelector('h3').innerHTML='NO MATCHES<br><em>FOUND.</em>';$('#emptyState').querySelector('p').textContent='Try another category, system, or search term.'}return}
  $('#pluginGrid').innerHTML=found.map((p,i)=>{
   let systems=['windows','mac'].filter(os=>p.platforms?.[os]?.url||p.platforms?.[os]?.fileKey);
   const btns=systems.filter(os=>platform==='all'||os===platform).flatMap(os=>[p.platforms[os].url,...(p.platforms[os].alternatives||[])].filter(Boolean).map((_,linkIndex)=>`<button class="download-btn" type="button" data-id="${escape(p.id)}" data-os="${os}" data-link="${linkIndex}" aria-label="Download ${escape(p.title)} for ${os==='mac'?'macOS':'Windows'}">${os==='mac'?'MAC':'WIN'}${linkIndex?` ${linkIndex+1}`:''} <span>↓</span></button>`)).join('');
   return `<article class="plugin-card"><div class="card-top"><div class="card-icon">${escape(p.icon||'✦')}</div><div class="card-meta">${String(i+1).padStart(3,'0')} / ${escape(categoryFor(p,platform)||'TOOLS').toUpperCase()}<br>V${escape(p.version||'1.0')}</div></div><h3 title="${escape(p.title)}">${escape(p.title)}</h3><p>${escape(p.description)}</p><div class="card-bottom"><span class="plugin-version" title="Version ${escape(p.version||'1.0')}">V${escape(p.version||'1.0')}</span><div class="downloads">${btns}</div></div></article>`;
  }).join('');
 }
 $$('.os-filters button').forEach(btn=>btn.addEventListener('click',()=>{platform=btn.dataset.platform;$$('.os-filters button').forEach(b=>b.classList.toggle('active',b===btn));show()}));
 $('#categoryFilters').addEventListener('click',e=>{const btn=e.target.closest('[data-cat]');if(btn){category=btn.dataset.cat;show()}});
 $('#searchInput').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();show()});
 $('#pluginGrid').addEventListener('click',e=>{const b=e.target.closest('[data-id][data-os]');if(!b)return;const p=plugins.find(x=>String(x.id)===b.dataset.id);const os=b.dataset.os;let a=p?.platforms?.[os];if(!a)return;
  const linkIndex=Number(b.dataset.link||0),candidate=[a.url,...(a.alternatives||[])][linkIndex],link=validUrl(candidate);
  if(!link){toast('This download link is unavailable.');return}
  const el=document.createElement('a');el.href=link;el.target='_blank';el.rel='noopener noreferrer';document.body.appendChild(el);el.click();el.remove();toast('Opening download · '+p.title);
 });
 function applyState(data){if(!data||!Array.isArray(data.plugins))return;plugins=data.plugins;settings=data.settings||settings;document.body.classList.toggle('emergency-active',!!data.emergency);applySettings();show()}
 function applySettings(){const a=settings.accent;if(/^#[0-9a-fA-F]{6}$/.test(a||''))document.documentElement.style.setProperty('--red',a);if(settings.tagline)$('#heroSubtitle').textContent=settings.tagline;if(settings.announcement){$('#announcementLabel').textContent=settings.announcement;$('#announcementLabel').title=settings.announcement}if(settings.siteName){document.getElementById('brandName').textContent=settings.siteName;document.getElementById('footerBrand').textContent=settings.siteName;document.title=settings.siteName+' — Creator Tools'}if(validUrl(settings.discordUrl))$('#discordLink').href=settings.discordUrl;}
 if(location.protocol!=='file:')fetch('/api/state',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{if(data){window.KV_MODE='online';applyState(data)}}).catch(()=>{});
 const birds=$('#birds'),ctx=birds.getContext('2d',{alpha:true});let w=0,h=0,birdsData=[],clickFlock=[],mouse={x:-1000,y:-1000},sx=0,sy=0;
 function resize(){let scale=Math.min(devicePixelRatio||1,1.5);w=innerWidth;h=innerHeight;birds.width=Math.round(w*scale);birds.height=Math.round(h*scale);ctx.setTransform(scale,0,0,scale,0,0)}
 resize();addEventListener('resize',resize,{passive:true});
 // Independent silhouetted birds travel in small responsive flocks, not a bitmap texture.
 for(let i=0;i<28;i++)birdsData.push({x:(i*67.3)%1800,y:(i*31.9)%1000,phase:i*1.45,v:.25+(i%7)*.08,size:2+(i%4)*1.25,offset:i%5});
 addEventListener('pointermove',e=>{mouse.x=e.clientX;mouse.y=e.clientY},{passive:true});
 addEventListener('click',e=>{if(e.target.closest('a,button,input,textarea,select,label'))return;const now=performance.now();for(let i=0;i<12;i++){const side=i%2?-1:1;clickFlock.push({x:e.clientX+side*(16+(i%4)*9),y:e.clientY+(i%3-1)*10,side,born:now,delay:(i%6)*36,size:3+(i%4)*.9,phase:i*1.7})}});
 const core=$('#cursorCore'),ring=$('#cursorRing');let cx=-100,cy=-100;
 if(matchMedia('(hover:hover) and (pointer:fine)').matches){
  addEventListener('pointermove',e=>{core.style.left=e.clientX+'px';core.style.top=e.clientY+'px'},{passive:true});
  document.addEventListener('pointerover',e=>ring.classList.toggle('is-hover',!!e.target.closest('a,button,input')));
  (function cursorFrame(){cx+=(mouse.x-cx)*.15;cy+=(mouse.y-cy)*.15;ring.style.left=cx+'px';ring.style.top=cy+'px';requestAnimationFrame(cursorFrame)})();
 }
 const progress=$('#progressBar'),readout=$('.readout-line>div');let smoothY=0;
 addEventListener('scroll',()=>{sx=scrollY},{passive:true});
 function frame(time){if(document.hidden){requestAnimationFrame(frame);return}
  smoothY+=(scrollY-smoothY)*.1;const frac=Math.min(1,scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight));progress.style.width=(frac*100).toFixed(2)+'%';
  const f=Math.max(0,Math.min(1,(smoothY-innerHeight*.13)/(innerHeight*1.5)));if(readout)readout.style.width=(f*100)+'%';
  ctx.clearRect(0,0,w,h);if(w>0&&h>0&&(!matchMedia('(prefers-reduced-motion: reduce)').matches)){
    ctx.save();for(let i=0;i<birdsData.length;i++){
      const b=birdsData[i],t=time*.001,speed=b.v*.42,driftX=(time*.018*speed+(b.x%1800))%(w+120)-60,
      driftY=(b.y%h)*.83+30+Math.sin(t*.45+b.phase)*14;
      let x=driftX,y=driftY;
      const dx=x-mouse.x,dy=y-mouse.y,dist=Math.hypot(dx,dy);
      if(dist<150){const force=(150-dist)/150;x+=(dx/(dist||1))*force*62;y+=(dy/(dist||1))*force*54}
      const wing=Math.sin(t*4.1+b.phase)*b.size*.45;
      const alpha=.17+(i%4)*.045;
      ctx.globalAlpha=alpha;ctx.strokeStyle=i%5===0?'#c4424c':'#9d6971';ctx.lineWidth=.95;
      ctx.beginPath();ctx.moveTo(x-b.size*1.6,y-wing*.4);ctx.quadraticCurveTo(x-b.size*.7,y-b.size*.85-wing,x,y);ctx.quadraticCurveTo(x+b.size*.7,y-b.size*.85+wing,x+b.size*1.6,y-wing*.4);ctx.stroke();
    }for(let i=clickFlock.length-1;i>=0;i--){const b=clickFlock[i],age=time-b.born-b.delay;if(age<0)continue;if(age>1050){clickFlock.splice(i,1);continue}const p=age/1050,x=b.x+b.side*(32+p*p*245),y=b.y+Math.sin(p*Math.PI*2.5+b.phase)*18-p*58,wing=Math.sin(time*.018+b.phase)*b.size*.8;ctx.globalAlpha=(1-p)*.8;ctx.strokeStyle=b.side<0?'#d44a58':'#d7b1b8';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-b.size*1.6,y);ctx.quadraticCurveTo(x-b.size*.7,y-b.size-wing,x,y);ctx.quadraticCurveTo(x+b.size*.7,y-b.size+wing,x+b.size*1.6,y);ctx.stroke()}ctx.restore();
  }
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
 const visitorKey='velostaff-visitor-id';let visitorId=localStorage.getItem(visitorKey);if(!/^[a-z0-9-]{16,80}$/i.test(visitorId||'')){visitorId=crypto.randomUUID?.()||(Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,18));localStorage.setItem(visitorKey,visitorId)}
 const track=event=>fetch('/api/track',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({event,visitorId}),keepalive:true}).catch(()=>{});
 if(location.protocol!=='file:'){track('pageview');setInterval(()=>{if(!document.hidden)track('heartbeat')},30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)track('heartbeat')})}
 const feedbackToggle=$('#feedbackToggle'),feedbackForm=$('#feedbackForm');feedbackToggle.addEventListener('click',()=>feedbackForm.classList.toggle('hidden'));feedbackForm.addEventListener('submit',async e=>{e.preventDefault();const payload={pluginName:$('#feedbackPlugin').value.trim(),platform:$('#feedbackPlatform').value,email:$('#feedbackEmail').value.trim(),name:$('#feedbackName').value.trim(),message:$('#feedbackMessage').value.trim(),notify:$('#feedbackNotify').checked};try{if(!payload.pluginName)throw Error('Enter the plugin name');if(location.protocol==='file:'||window.KV_MODE!=='online')throw Error('Requests need the live Velostaff server');const r=await fetch('/api/requests',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});if(!r.ok)throw Error((await r.json()).error||'Could not send request');feedbackForm.reset();feedbackForm.classList.add('hidden');toast('Request sent — thank you!')}catch(err){toast(err.message||'Could not send request. Please try again.')}});
 document.getElementById('year').textContent=new Date().getFullYear();applySettings();show();
})();
