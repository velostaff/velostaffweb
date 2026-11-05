/* Raw WebGL, no dependencies: original procedural metallic orbital sculpture. */
(() => {
 'use strict';
 const canvas = document.querySelector('#sculpture');
 if (!canvas) return;
 const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'high-performance' });
 const scrollCue = document.getElementById('disassemblyCount');
 const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
 if (!gl) { document.documentElement.classList.add('no-webgl'); window.KVStartFallback?.(canvas); return; }
 const vert = `#version 300 es
 precision highp float;
 in vec3 a_position; in vec3 a_normal;
 uniform mat4 u_projection,u_view,u_model;
 out vec3 v_normal,v_position;
 void main(){vec4 p=u_model*vec4(a_position,1.);v_position=p.xyz;v_normal=mat3(u_model)*a_normal;gl_Position=u_projection*u_view*p;}`;
 const frag = `#version 300 es
 precision highp float;
 in vec3 v_normal,v_position;
 uniform vec3 u_color; uniform float u_emission; uniform vec3 u_camera;
 out vec4 outColor;
 void main(){
 vec3 n=normalize(v_normal); vec3 v=normalize(u_camera-v_position);
 vec3 l=normalize(vec3(-.55,1.4,2.7));vec3 l2=normalize(vec3(2.,-.9,-1.));
 float d=max(dot(n,l),0.);float d2=max(dot(n,l2),0.);
 vec3 h=normalize(l+v);float spec=pow(max(dot(n,h),0.),60.);
 float fres=pow(1.-abs(dot(n,v)),2.3);
 vec3 col=u_color*(.12+1.05*d+.22*d2);
 col+=vec3(.88,.9,.95)*spec*.85;
 col+=vec3(.33,.35,.43)*fres*.33;
 col+=vec3(1.,.045,.095)*u_emission*(.48+.42*d+.9*fres);
 outColor=vec4(col,1.);
 }`;
 function shader(kind,src){const sh=gl.createShader(kind);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh}
 const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vert));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,frag));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 gl.useProgram(program);
 const loc={position:gl.getAttribLocation(program,'a_position'),normal:gl.getAttribLocation(program,'a_normal'),projection:gl.getUniformLocation(program,'u_projection'),view:gl.getUniformLocation(program,'u_view'),model:gl.getUniformLocation(program,'u_model'),color:gl.getUniformLocation(program,'u_color'),emission:gl.getUniformLocation(program,'u_emission'),camera:gl.getUniformLocation(program,'u_camera')};
 const mat=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
 function mul(a,b){const c=new Float32Array(16);for(let i=0;i<4;i++)for(let j=0;j<4;j++)c[j*4+i]=a[0*4+i]*b[j*4+0]+a[1*4+i]*b[j*4+1]+a[2*4+i]*b[j*4+2]+a[3*4+i]*b[j*4+3];return c}
 const translate=(x,y,z)=>{let a=mat();a[12]=x;a[13]=y;a[14]=z;return a};
 const scale=(x,y,z)=>{let a=mat();a[0]=x;a[5]=y;a[10]=z;return a};
 const rotX=a=>{let m=mat(),s=Math.sin(a),c=Math.cos(a);m[5]=c;m[6]=s;m[9]=-s;m[10]=c;return m};
 const rotY=a=>{let m=mat(),s=Math.sin(a),c=Math.cos(a);m[0]=c;m[2]=-s;m[8]=s;m[10]=c;return m};
 const rotZ=a=>{let m=mat(),s=Math.sin(a),c=Math.cos(a);m[0]=c;m[1]=s;m[4]=-s;m[5]=c;return m};
 const norm=(v)=>{const d=Math.hypot(...v)||1;return v.map(x=>x/d)};
 const subtract=(a,b)=>a.map((x,i)=>x-b[i]);
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 function geometry(){return {p:[],n:[]}}
 function face(g,a,b,c){const n=norm(cross(subtract(b,a),subtract(c,a)));for(const v of [a,b,c]){g.p.push(...v);g.n.push(...n)}}
 function quad(g,a,b,c,d){face(g,a,b,c);face(g,a,c,d)}
 function prism(g,a,b,c,depth=.07){const n=norm(cross(subtract(b,a),subtract(c,a))),offset=v=>v.map((x,i)=>x+n[i]*depth);const A=offset(a),B=offset(b),C=offset(c);face(g,A,B,C);face(g,c,b,a);quad(g,a,b,B,A);quad(g,b,c,C,B);quad(g,c,a,A,C)}
 function boxGeo(w=1,h=1,d=1){const g=geometry(),x=w/2,y=h/2,z=d/2;quad(g,[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]);quad(g,[x,-y,-z],[-x,-y,-z],[-x,y,-z],[x,y,-z]);quad(g,[-x,-y,-z],[-x,-y,z],[-x,y,z],[-x,y,-z]);quad(g,[x,-y,z],[x,-y,-z],[x,y,-z],[x,y,z]);quad(g,[-x,y,z],[x,y,z],[x,y,-z],[-x,y,-z]);quad(g,[-x,-y,-z],[x,-y,-z],[x,-y,z],[-x,-y,z]);return g}
 function torusGeo(R=.9,r=.02,major=72,minor=10,arc=Math.PI*2){const g=geometry();for(let i=0;i<major;i++){const a=i/major*arc,b=(i+1)/major*arc;for(let j=0;j<minor;j++){const c=j/minor*Math.PI*2,d=(j+1)/minor*Math.PI*2;const point=(u,v)=>[(R+r*Math.cos(v))*Math.cos(u),(R+r*Math.cos(v))*Math.sin(u),r*Math.sin(v)];quad(g,point(a,c),point(b,c),point(b,d),point(a,d))}}return g}
 function sphereGeo(R=.58,rows=20,cols=30){const g=geometry();for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const p=(i,j)=>{let a=i/cols*Math.PI*2,b=j/rows*Math.PI;return [R*Math.sin(b)*Math.cos(a),R*Math.cos(b),R*Math.sin(b)*Math.sin(a)]};quad(g,p(x,y),p(x+1,y),p(x+1,y+1),p(x,y+1))}return g}
 function icoFaces(radius=1){const t=(1+Math.sqrt(5))/2,V=[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]].map(v=>norm(v).map(x=>x*radius)),I=[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1];let faces=[];for(let k=0;k<I.length;k+=3){let [a,b,c]=I.slice(k,k+3).map(i=>V[i]),ab=norm(a.map((x,i)=>x+b[i])).map(x=>x*radius),bc=norm(b.map((x,i)=>x+c[i])).map(x=>x*radius),ca=norm(c.map((x,i)=>x+a[i])).map(x=>x*radius);faces.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca])}return faces}
 const objects=[];function add(g,color,emission=0,pos=[0,0,0],rot=[0,0,0],out=[0,0,0],factor=1,group='shell'){
 const vao=gl.createVertexArray();gl.bindVertexArray(vao);const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);const floats=new Float32Array(g.p.length*2);for(let i=0,j=0;i<g.p.length;i+=3){floats.set(g.p.slice(i,i+3),j);floats.set(g.n.slice(i,i+3),j+3);j+=6}gl.bufferData(gl.ARRAY_BUFFER,floats,gl.STATIC_DRAW);gl.enableVertexAttribArray(loc.position);gl.vertexAttribPointer(loc.position,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(loc.normal);gl.vertexAttribPointer(loc.normal,3,gl.FLOAT,false,24,12);gl.bindVertexArray(null);objects.push({vao,n:g.p.length/3,color,emission,pos,rot,out,factor,group});}
 const gray=[.24,.265,.31], dark=[.105,.115,.145],chrome=[.48,.52,.6],red=[.62,.065,.11],deep=[.28,.028,.055],silver=[.76,.77,.8];
 add(sphereGeo(.77),deep,.5,[0,0,0],[0,0,0],[0,0,0],.22,'core');
 add(sphereGeo(.49),[.9,.075,.1],2,[0,0,0],[0,0,0],[0,0,0],.15,'core');
 // A tessellated exoskeleton made of individual detachable plates.
 icoFaces(1.1).forEach((vertices,i)=>{
  let centroid=[0,1,2].map(k=>(vertices[0][k]+vertices[1][k]+vertices[2][k])/3),local=vertices.map(p=>subtract(p,centroid)),g=geometry();prism(g,...local,.038);
  const direction=norm(centroid),t=i%13===0?red:i%7===0?chrome:i%3===0?gray:dark;
  add(g,t,i%13===0?.7:0,centroid,[0,0,0],direction,1+(i%5)*.19,'plate');
 });
 // Outer asymmetric orbital rings and machined collars.
 add(torusGeo(1.58,.025),chrome,0,[0,0,0],[.25,.5,.13],[.1,.8,0],.37,'ring');
 add(torusGeo(1.82,.012),red,.7,[0,0,0],[1.2,-.44,.24],[.6,.2,.4],.8,'ring');
 add(torusGeo(1.37,.052),gray,.1,[0,0,0],[.82,.23,-.25],[.1,0,.7],.22,'ring');
 add(torusGeo(1.98,.009),silver,.35,[0,0,0],[.12,.78,-.72],[0,.5,-.5],.8,'ring');
 add(torusGeo(1.68,.028,64,9,Math.PI*1.48),dark,0,[0,0,0],[1.4,.18,.8],[0,-1,.5],.9,'ring');
 add(torusGeo(.72,.04),chrome,0,[0,0,0],[.6,.1,.3],[0,0,0],.2,'core');
 add(torusGeo(.83,.022),red,1,[0,0,0],[.2,1.2,.65],[0,0,0],.3,'core');
 // Radial rotor blades with exposed geometry and individual metal struts.
 const fin=geometry();prism(fin,[1.16,-.16,0],[2.15,-.055,.06],[1.45,.22,-.08],.055);
 const vane=geometry();prism(vane,[1.25,-.065,0],[1.98,-.032,.02],[1.56,.1,-.05],.009);
 for(let i=0;i<18;i++){
  const a=i*Math.PI*2/18,d=[Math.cos(a),Math.sin(a),Math.sin(i*.95)*.48];
  add(fin,i%5===0?gray:dark,0,[0,0,0],[.2*Math.sin(a*3),.27*Math.cos(a*2),a],d,.72,'fin');
  if(i%2===0)add(vane,i%3===0?red:chrome,i%3===0?.7:0,[0,0,0],[.2*Math.sin(a*3),.27*Math.cos(a*2),a],d,.72,'fin');
 }
 // Radial precision studs, floating rivets, segmented telemetry arcs.
 const bolt=boxGeo(.1,.12,.11);
 for(let i=0;i<24;i++){
  const a=i/24*Math.PI*2,p=[Math.cos(a)*2.06,Math.sin(a)*2.06,Math.sin(a*4)*.08],out=norm([p[0],p[1],p[2]]);
  add(bolt,i%6===0?red:gray,i%6===0?1.2:0,p,[0,0,a],out,.95,'fin');
 }
 for(let i=0;i<30;i++){
  const a=i*2.3999,y=((i%11)-5)*.13,r=2.2+((i*7)%9)*.09,p=[Math.cos(a)*r,y,Math.sin(a)*r];
  add(boxGeo(.028,.08,.028),i%4===0?red:chrome,i%4===0?.5:0,p,[i*.13,i*.1,a],norm(p),1.4,'debris');
 }
 const perspective=(fov,aspect,near,far)=>{let f=1/Math.tan(fov/2),a=new Float32Array(16);a[0]=f/aspect;a[5]=f;a[10]=(far+near)/(near-far);a[11]=-1;a[14]=2*far*near/(near-far);return a};
 const view=translate(0,0,-8.6);gl.uniformMatrix4fv(loc.view,false,view);gl.uniform3fv(loc.camera,[0,0,8.6]);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.clearColor(0,0,0,0);
 let scroll=0,smoothScroll=0,mouseX=0,mouseY=0,last=0,w=0,h=0,dpr=1,visible=true;
 window.addEventListener('pointermove',e=>{mouseX=(e.clientX/window.innerWidth-.5)*2;mouseY=(e.clientY/window.innerHeight-.5)*2},{passive:true});
 window.addEventListener('scroll',()=>{scroll=window.scrollY},{passive:true});
 document.addEventListener('visibilitychange',()=>{visible=!document.hidden});
 function resize(){const bw=canvas.clientWidth,bh=canvas.clientHeight;if(!bw||!bh)return;dpr=Math.min(devicePixelRatio||1,1.7);const ww=Math.max(1,Math.round(bw*dpr)),hh=Math.max(1,Math.round(bh*dpr));if(ww!==w||hh!==h){w=ww;h=hh;canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);gl.uniformMatrix4fv(loc.projection,false,perspective(Math.PI/4,w/h,.1,100))}}
 const ease=(a,b,t)=>a+(b-a)*t;const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const smooth=t=>t*t*(3-2*t);
 function draw(ms){requestAnimationFrame(draw);if(!visible)return;resize();if(!w)return;const t=ms*.001;const dt=Math.min((ms-last)/16.6||1,3);last=ms;smoothScroll=ease(smoothScroll,scroll,1-Math.pow(.82,dt));const vh=innerHeight;const progress=clamp((smoothScroll-vh*.12)/(vh*1.85),0,1);const fracture=reduce?0:smooth(clamp((progress-.06)/.69,0,1));const shrink=1-.18*smooth(clamp((progress-.42)/.53,0,1));
 canvas.style.opacity=String(clamp((2.66*vh-smoothScroll)/(vh*.7),0,1));
 if(scrollCue)scrollCue.textContent=String(Math.round(fracture*100)).padStart(2,'0')+'%';
 gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 const compact=innerWidth<760;const worldX=compact?0:ease(1.8,-1.55,smooth(progress));const worldY=compact?-1.05:ease(.05,.07,progress);
 const overall=compact?.62*shrink:.96*shrink;
 const base=mul(translate(worldX,worldY,0),mul(rotY(t*.125+mouseX*.16+progress*.8),mul(rotX(-.25+Math.sin(t*.15)*.07-mouseY*.08),scale(overall,overall,overall))));
 for(const o of objects){const e=reduce?0:fracture*o.factor;const outward=o.out;const p=o.pos;
  const drift=Math.sin(t*.8+o.factor*9)*.022;
  let m=mul(base,translate(p[0]+outward[0]*e*2.95+outward[0]*drift,p[1]+outward[1]*e*2.5+outward[1]*drift,p[2]+outward[2]*e*2.8));
  m=mul(m,rotZ(o.rot[2]+e*(o.group==='plate'?Math.sin(o.factor*19)*1.5:.28)));
  m=mul(m,rotY(o.rot[1]+e*(o.group==='plate'?Math.cos(o.factor*21):.17)));
  m=mul(m,rotX(o.rot[0]+e*(o.group==='fin'?1.3:.18)));
  gl.bindVertexArray(o.vao);gl.uniformMatrix4fv(loc.model,false,m);gl.uniform3fv(loc.color,o.color);gl.uniform1f(loc.emission,o.emission);gl.drawArrays(gl.TRIANGLES,0,o.n);
 }
 gl.bindVertexArray(null);
 }
 resize();requestAnimationFrame(draw);
})();
