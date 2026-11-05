/* CPU-projected 3D canvas fallback when WebGL is unavailable or disabled. */
window.KVStartFallback = function(canvas){
 'use strict';
 const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)return;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let width=0,height=0,dpr=1,scroll=0,mx=0,my=0,lastScroll=0;
 addEventListener('pointermove',e=>{mx=(e.clientX/innerWidth-.5)*2;my=(e.clientY/innerHeight-.5)*2},{passive:true});
 addEventListener('scroll',()=>{scroll=scrollY},{passive:true});
 function resize(){dpr=Math.min(devicePixelRatio||1,1.7);width=canvas.clientWidth;height=canvas.clientHeight;let w=Math.round(width*dpr),h=Math.round(height*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;ctx.setTransform(dpr,0,0,dpr,0,0)}}
 const norm=a=>{const l=Math.hypot(...a)||1;return a.map(x=>x/l)},sub=(a,b)=>a.map((v,i)=>v-b[i]);
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2]];
 const t=(1+Math.sqrt(5))/2;let vertices=[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]].map(x=>norm(x).map(v=>v*1.06));
 const I=[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1];
 const faces=[];for(let k=0;k<I.length;k+=3){let [a,b,c]=I.slice(k,k+3).map(i=>vertices[i]);const mid=(a,b)=>norm(a.map((v,i)=>(v+b[i])/2)).map(x=>x*1.06);const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);faces.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]);}
 const smooth=v=>v*v*(3-2*v),clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 function render(ms){requestAnimationFrame(render);if(document.hidden)return;resize();if(!width)return;ctx.clearRect(0,0,width,height);
 lastScroll+=(scroll-lastScroll)*.075;
 const progress=clamp((lastScroll-height*.12)/(height*1.85),0,1),fracture=reduce?0:smooth(clamp((progress-.06)/.69,0,1));
 const compact=width<760,cx=compact?width*.53:width*(.66-.37*smooth(progress)),cy=compact?height*.74:height*.49;
 const S=Math.min(width,height)*(compact?.245:.24)*(1-.18*progress);const time=reduce?0:ms*.001;
 const ax=-.27-my*.11+Math.sin(time*.18)*.06,ay=time*.15+mx*.2+progress*.8,az=.08;
 const transform=v=>{let [x,y,z]=v;let cy=Math.cos(ay),sy=Math.sin(ay),cx=Math.cos(ax),sx=Math.sin(ax),cz=Math.cos(az),sz=Math.sin(az);let x2=x*cy+z*sy,z2=-x*sy+z*cy;let y2=y*cx-z2*sx,z3=y*sx+z2*cx;return [x2*cz-y2*sz,x2*sz+y2*cz,z3]};
 const P=p=>{const a=transform(p),pers=5.5/(5.5-a[2]);return [cx+a[0]*S*pers,cy+a[1]*S*pers,a[2]]};
 ctx.save();ctx.globalAlpha=clamp((2.65*height-lastScroll)/(height*.65),0,1);if(ctx.globalAlpha<.01){ctx.restore();return}
 let glow=ctx.createRadialGradient(cx,cy,6,cx,cy,S*3.4);glow.addColorStop(0,'#ac162629');glow.addColorStop(.43,'#8b0c1720');glow.addColorStop(1,'#57040c00');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(cx,cy,S*3.4,0,Math.PI*2);ctx.fill();
 // Alternate orbital alignments, each rendered as an actual projected 3D path.
 function orbit(r,tube,rot,red=false,dash=false){const N=110,points=[];for(let i=0;i<=N;i++){let a=i/N*Math.PI*2,v=[Math.cos(a)*r,Math.sin(a)*r,0];let [x,y,z]=v;const [rx,ry,rz]=rot;let x1=x*Math.cos(ry)+z*Math.sin(ry),z1=-x*Math.sin(ry)+z*Math.cos(ry),y1=y*Math.cos(rx)-z1*Math.sin(rx),z2=y*Math.sin(rx)+z1*Math.cos(rx);points.push(P([x1*Math.cos(rz)-y1*Math.sin(rz),x1*Math.sin(rz)+y1*Math.cos(rz),z2]));}
  ctx.save();ctx.lineCap='round';ctx.lineWidth=tube*S/70;ctx.shadowColor=red?'#fd2445':'#bdafb7';ctx.shadowBlur=red?16:4;ctx.strokeStyle=red?'#ec253b':'#9996a6';ctx.globalAlpha*=red?.88:.6;ctx.beginPath();points.forEach((p,i)=>{if(!i)ctx.moveTo(p[0],p[1]);else ctx.lineTo(p[0],p[1])});ctx.stroke();if(dash){ctx.lineWidth=1;ctx.setLineDash([4,14]);ctx.strokeStyle='#ff5460';ctx.stroke()}ctx.restore();}
 orbit(1.95,.7,[.3,.7,.1],false,true);orbit(1.53,1.6,[.9,.1,.3],false);orbit(1.83,.75,[1.3,-.45,.4],true);orbit(1.3,1.0,[.1,1.2,.5],false);orbit(2.2,.45,[.5,-.45,.9],true);
 // Mechanical rotor: 24 individual radial blades and their red inlays.
 const bladePolys=[];for(let i=0;i<24;i++){const a=i*Math.PI*2/24,off=fracture*(.7+i%4*.15),z=Math.sin(i*1.4)*.22;
 let v=[[1.21,-.12,z],[2.13,-.055,z+.12],[1.56,.17,z+.1]].map(([x,y,z])=>[x*Math.cos(a)-y*Math.sin(a)+Math.cos(a)*off,x*Math.sin(a)+y*Math.cos(a)+Math.sin(a)*off,z+off*.25]);let pts=v.map(P);bladePolys.push({pts,z:pts.reduce((a,p)=>a+p[2],0)/3,i});}
 bladePolys.sort((a,b)=>a.z-b.z);for(const {pts,i} of bladePolys){ctx.beginPath();pts.forEach((p,j)=>j?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fillStyle=i%6===0?'#9e2638':i%3===0?'#4e505b':'#292b33';ctx.fill();ctx.strokeStyle='#77747e70';ctx.lineWidth=.75;ctx.stroke();}
 // Crystalline geodesic metal shell disassembles face by face as the user scrolls.
 let facets=faces.map((v,i)=>{let center=[0,1,2].map(k=>v.reduce((sum,p)=>sum+p[k],0)/3),dir=norm(center),offset=fracture*(.6+(i%6)*.15);const pts=v.map(p=>P(p.map((n,j)=>n+dir[j]*offset)));return {pts,dep:pts.reduce((n,p)=>n+p[2],0)/3,i}}).sort((a,b)=>a.dep-b.dep);
 for(const {pts,i,dep} of facets){let shade=Math.max(0,Math.min(1,(dep+1.3)/3));let R=Math.round(31+shade*96+(i%19===0?75:0)),G=Math.round(32+shade*92-(i%19===0?12:0)),B=Math.round(40+shade*104-(i%19===0?6:0));
  ctx.beginPath();pts.forEach((p,j)=>j?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fillStyle=i%19===0?`rgb(${Math.min(R,195)},${G*.38},${B*.52})`:`rgb(${R},${G},${B})`;ctx.fill();ctx.strokeStyle=i%19===0?'#c43a4b':'#89868d86';ctx.lineWidth=.7;ctx.stroke();}
 // Polished inner red reaction chamber.
 const c=P([0,0,0]),r=S*.37*(5.5/(5.5-c[2]));let redGlow=ctx.createRadialGradient(c[0]-r*.25,c[1]-r*.3,r*.04,c[0],c[1],r*1.1);redGlow.addColorStop(0,'#ff697b');redGlow.addColorStop(.16,'#f32740');redGlow.addColorStop(.43,'#951527');redGlow.addColorStop(.8,'#290d19');redGlow.addColorStop(1,'#19091000');ctx.fillStyle=redGlow;ctx.beginPath();ctx.arc(c[0],c[1],r*1.1,0,Math.PI*2);ctx.fill();
 // Splinter ring: precision highlights and detached metal nuts.
 orbit(.78,1.8,[.6,1.4,.35],true);orbit(.92,.5,[.32,.9,.4],false);
 for(let i=0;i<34;i++){let a=i*2.399,y=((i%11)-5)*.13,r=2.1+((i*7)%9)*.07,off=fracture*.45;
 let p=P([Math.cos(a)*(r+off),y,Math.sin(a)*(r+off)]),radius=i%4===0?2.2:1.2;ctx.fillStyle=i%4===0?'#ff4c65':'#8c7a87';ctx.globalAlpha*=1;ctx.fillRect(p[0],p[1],radius,radius)}
 ctx.restore();
 }
 requestAnimationFrame(render);
};
