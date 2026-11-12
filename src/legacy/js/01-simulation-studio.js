
(function(){
var $=function(s){return document.querySelector(s)},TAU=Math.PI*2;
/* ---------- course catalogue ---------- */
var CO=[["Get started","Use a quantum computer today","Basics of quantum computing, designed to get you started quickly.",5],["Get started","Quantum computing in practice","Use cases and best practices for processors with 100+ qubits.",8],["Foundations","Basics of quantum information","States, measurements, circuits and entanglement (John Watrous).",15],["Foundations","Fundamentals of quantum algorithms","How quantum algorithms beat classical ones, including factoring and search.",15],["Foundations","General formulation of quantum information","Density matrices, channels and general measurements.",15],["Foundations","Foundations of quantum error correction","Error-correcting codes and fault tolerance.",15],["Techniques","Tools for quantum advantage","Modern tools for handling noise and errors.",12],["Techniques","Integrating quantum and HPC","Combining quantum and high-performance computing in one workflow.",6],["Techniques","Quantum diagonalization algorithms","Matrix diagonalization with VQE and sample-based methods.",10],["Techniques","Quantum machine learning","Using quantum computing in machine learning methods.",10],["Techniques","Variational algorithm design","Hybrid classical-quantum variational algorithms.",8],["Techniques","Quantum chemistry with VQE","Building blocks and applications of VQE.",5],["Techniques","Utility-scale quantum computing","A 14-lesson course on utility-scale quantum computing.",15],["Business","Quantum business foundations","Quantum computing, technology and business applications.",3],["Business","Designing and leading quantum projects","A guide for teams starting quantum initiatives.",4]];
var sel={},cf="All",groups=["All","Get started","Foundations","Techniques","Business"];
function drawC(){var h="";CO.forEach(function(c,i){if(cf!="All"&&c[0]!=cf)return;h+='<label class="ct"><input type="checkbox" data-i="'+i+'"'+(sel[i]?' checked':'')+'><b>'+c[1]+'</b><span class="hr">'+c[3]+' h</span><small>'+c[2]+'</small></label>'});$("#cl").innerHTML=h;
var t=0,n=0;for(var k in sel)if(sel[k]){t+=CO[k][3];n++}
$("#ch").textContent=t+" h";$("#cn").textContent=n?n+" course"+(n>1?"s":"")+" selected.":"No courses selected.";$("#cb").style.width=Math.min(100,t/150*100)+"%";$("#cw").textContent=Math.ceil(t/5)}
function drawF(){$("#cf").innerHTML=groups.map(function(g){return '<button data-f="'+g+'"'+(g==cf?' class="on"':'')+'>'+g+'</button>'}).join("")}
$("#cf").addEventListener("click",function(e){var f=e.target.getAttribute("data-f");if(f){cf=f;drawF();drawC()}});
$("#cl").addEventListener("change",function(e){sel[e.target.getAttribute("data-i")]=e.target.checked;drawC()});
drawF();drawC();
/* ---------- qiskit stack ---------- */
var LY=[["Algorithm development","Tools that map problems to circuits and prepare them for execution.",["Qiskit addons: MPF, AQC-Tensor, OBP, circuit cutting, SQD, M3","Qiskit Function templates: realistic code for recent research workflows","Transpiler and primitives for the map, optimise, execute, post-process loop"]],["Heterogeneous orchestration","Plugins that connect quantum resources to classical and HPC systems.",["QRMI: a standard interface for controlling quantum resources","Slurm plugin: manage quantum resources from the Slurm scheduler","Qiskit Serverless: run workloads across quantum and classical resources","Hardware plugins for many providers"]],["Quantum information science","The core toolkit for building and studying experiments.",["Qiskit core, with Python, C and Rust interfaces","Build circuits from gates, compile them, run experiments with primitives, visualise results","Benchpress: an open toolkit that compares the speed of quantum SDKs"]]];
function showL(i){$("#lyi").innerHTML='<h3>'+LY[i][0]+'</h3><p>'+LY[i][1]+'</p><ul>'+LY[i][2].map(function(x){return'<li>'+x+'</li>'}).join("")+'</ul>';[].forEach.call(document.querySelectorAll("#stg .ly"),function(l){l.classList.toggle("on",+l.getAttribute("data-i")==i)})}
[].forEach.call(document.querySelectorAll("#stg .ly"),function(l){var f=function(){showL(+l.getAttribute("data-i"))};l.addEventListener("click",f);l.addEventListener("mouseenter",f)});showL(2);
/* ---------- 3D helper ---------- */
function proj(p,ay,ax,W,H,s){var c=Math.cos(ay),sn=Math.sin(ay),x=p[0]*c+p[2]*sn,z=-p[0]*sn+p[2]*c,c2=Math.cos(ax),s2=Math.sin(ax),y=p[1]*c2-z*s2,z2=p[1]*s2+z*c2,f=600/(600+z2*s);return[W/2+x*s*f,H/2-y*s*f,z2,f]}
function drag(cv,st){var d=0,lx=0,ly=0;cv.addEventListener("pointerdown",function(e){d=1;lx=e.clientX;ly=e.clientY;st.auto=0;try{cv.setPointerCapture(e.pointerId)}catch(_){}});cv.addEventListener("pointermove",function(e){if(!d)return;st.ay+=(e.clientX-lx)*.01;st.ax=Math.max(-1.3,Math.min(1.3,st.ax+(e.clientY-ly)*.01));lx=e.clientX;ly=e.clientY});cv.addEventListener("pointerup",function(){d=0;st.auto=1})}
/* ---------- 1 composer ---------- */
var cc=$("#cc"),cx=cc.getContext("2d"),S,hist=[],cst={ay:.6,ax:.5,auto:1},cs=null,R=Math.SQRT1_2;
function reset(){S=[];for(var i=0;i<8;i++)S.push([i?0:1,0]);hist=[];cs=null}
function g1(q,m){for(var i=0;i<8;i++){if(i>>q&1)continue;var j=i|1<<q,a=S[i],b=S[j];S[i]=[m[0][0][0]*a[0]-m[0][0][1]*a[1]+m[0][1][0]*b[0]-m[0][1][1]*b[1],m[0][0][0]*a[1]+m[0][0][1]*a[0]+m[0][1][0]*b[1]+m[0][1][1]*b[0]];S[j]=[m[1][0][0]*a[0]-m[1][0][1]*a[1]+m[1][1][0]*b[0]-m[1][1][1]*b[1],m[1][0][0]*a[1]+m[1][0][1]*a[0]+m[1][1][0]*b[1]+m[1][1][1]*b[0]]}}
var G={H:[[[R,0],[R,0]],[[R,0],[-R,0]]],X:[[[0,0],[1,0]],[[1,0],[0,0]]],Z:[[[1,0],[0,0]],[[0,0],[-1,0]]],S:[[[1,0],[0,0]],[[0,0],[0,1]]],T:[[[1,0],[0,0]],[[0,0],[R,R]]]};
function ap(g,q){if(g=="CX"){var t=(q+1)%3;for(var i=0;i<8;i++)if((i>>q&1)&&!(i>>t&1)){var j=i^1<<t,a=S[i];S[i]=S[j];S[j]=a}}else g1(q,G[g])}
function rebuild(){var h=hist.slice();reset();hist=h;h.forEach(function(x){ap(x[0],x[1])})}
function add(g,q){hist.push([g,q]);ap(g,q);cs=null}
function pr(){return S.map(function(a){return a[0]*a[0]+a[1]*a[1]})}
function drawCC(){var W=cc.width,H=cc.height,p=pr();cx.clearRect(0,0,W,H);cx.fillStyle="#08101b";cx.fillRect(0,0,W,H);var fs=[],bw=.34,sc=95;
for(var i=0;i<8;i++){var x=(i-3.5)*.62,h=Math.max(.02,p[i])*2.2,col=cs?cs[i]/1024:p[i];var v=[];[[-bw,0,-bw],[bw,0,-bw],[bw,0,bw],[-bw,0,bw],[-bw,h,-bw],[bw,h,-bw],[bw,h,bw],[-bw,h,bw]].forEach(function(q){v.push(proj([q[0]+x,q[1]-.9,q[2]],cst.ay,cst.ax,W,H,sc))});
[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]].forEach(function(f,k){var z=0;f.forEach(function(n){z+=v[n][2]});fs.push({f:f,v:v,z:z/4,k:k,i:i,t:cs?cs[i]/1024:p[i]})})}
fs.sort(function(a,b){return b.z-a.z});fs.forEach(function(o){cx.beginPath();o.f.forEach(function(n,m){m?cx.lineTo(o.v[n][0],o.v[n][1]):cx.moveTo(o.v[n][0],o.v[n][1])});cx.closePath();var l=o.k==1?1:o.k<2?.5:.72;cx.fillStyle="hsla("+(190+o.i*18)+",80%,"+(35+l*25)+"%,.92)";cx.fill();cx.strokeStyle="rgba(255,255,255,.25)";cx.stroke()});
cx.fillStyle="#8FA4B6";cx.font="12px monospace";cx.textAlign="center";for(var i=0;i<8;i++){var b=proj([(i-3.5)*.62,-1.05,0],cst.ay,cst.ax,W,H,sc);cx.fillText("|"+("00"+i.toString(2)).slice(-3)+">",b[0],b[1]+14)}}
function updR(){var p=pr(),t=hist.length?hist.map(function(x){return x[0]+(x[0]=="CX"?"("+x[1]+"→"+(x[1]+1)%3+")":" q"+x[1])}).join(" · "):"(empty circuit)";var s="Circuit: "+t+"\n";var o=[];p.forEach(function(v,i){if(v>.001)o.push("|"+("00"+i.toString(2)).slice(-3)+"> "+(v*100).toFixed(1)+"%")});s+="Probabilities: "+o.join("  ");if(cs){s+="\nShots: ";cs.forEach(function(v,i){if(v)s+="|"+("00"+i.toString(2)).slice(-3)+">="+v+" "})}$("#cr").style.whiteSpace="pre-wrap";$("#cr").textContent=s}
drag(cc,cst);reset();
document.querySelectorAll("[data-g]").forEach(function(b){b.addEventListener("click",function(){add(b.getAttribute("data-g"),+$("#cq").value);updR()})});
$("#cbell").onclick=function(){reset();add("H",0);add("CX",0);updR()};$("#cghz").onclick=function(){reset();add("H",0);add("CX",0);add("CX",1);updR()};
$("#cun").onclick=function(){hist.pop();rebuild();cs=null;updR()};$("#crs").onclick=function(){reset();updR()};
$("#csh").onclick=function(){var p=pr(),c=[0,0,0,0,0,0,0,0];for(var k=0;k<1024;k++){var r=Math.random(),a=0;for(var i=0;i<8;i++){a+=p[i];if(r<a||i==7){c[i]++;break}}}cs=c;updR()};updR();
/* ---------- 2 routing ---------- */
var N=[],E=[],rc=$("#rc"),rx=rc.getContext("2d"),rst={ay:.7,ax:.45,auto:1},path=[],pt=0;
for(var z=0;z<2;z++)for(var y=0;y<3;y++)for(var x=0;x<3;x++)N.push([x-1,y-1,z-.5]);
N.forEach(function(a,i){N.forEach(function(b,j){if(j>i){var d=Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2]);if(Math.abs(d-1)<1e-6)E.push([i,j])}})});
N.forEach(function(_,i){["#ra","#rb"].forEach(function(s){var o=document.createElement("option");o.value=i;o.textContent="q"+i;$(s).appendChild(o)})});$("#rb").value=17;
function bfs(a,b){var pv={},q=[a];pv[a]=-1;while(q.length){var u=q.shift();if(u==b)break;E.forEach(function(e){var v=e[0]==u?e[1]:e[1]==u?e[0]:-1;if(v>=0&&pv[v]===undefined){pv[v]=u;q.push(v)}})}var p=[],c=b;while(c!=-1){p.unshift(c);c=pv[c]}return p}
function route(){path=bfs(+$("#ra").value,+$("#rb").value);var d=path.length-1,sw=Math.max(0,d-1),g=3*sw+1,f=Math.pow(1-+$("#re").value,g);$("#rt").textContent="Distance "+d+" hops → "+sw+" SWAP gates → "+g+" two-qubit gates in total. Estimated fidelity from two-qubit errors alone: "+(f*100).toFixed(1)+"%."}
["#ra","#rb","#re"].forEach(function(s){$(s).onchange=route});$("#rr").onclick=function(){$("#ra").value=Math.floor(Math.random()*18);$("#rb").value=Math.floor(Math.random()*18);route()};drag(rc,rst);route();
function drawR(){var W=rc.width,H=rc.height;rx.fillStyle="#08101b";rx.fillRect(0,0,W,H);var P=N.map(function(n){return proj(n,rst.ay,rst.ax,W,H,85)});rx.lineWidth=1;E.forEach(function(e){rx.strokeStyle="rgba(143,164,182,.35)";rx.beginPath();rx.moveTo(P[e[0]][0],P[e[0]][1]);rx.lineTo(P[e[1]][0],P[e[1]][1]);rx.stroke()});
rx.strokeStyle="#F2C14E";rx.lineWidth=3;rx.beginPath();path.forEach(function(n,i){i?rx.lineTo(P[n][0],P[n][1]):rx.moveTo(P[n][0],P[n][1])});rx.stroke();
N.forEach(function(_,i){var on=path.indexOf(i)>=0,r=(on?8:5)*P[i][3];rx.fillStyle=i==path[0]?"#FF7A59":i==path[path.length-1]?"#A99BFF":on?"#F2C14E":"#3CCFD0";rx.beginPath();rx.arc(P[i][0],P[i][1],r,0,TAU);rx.fill()});
if(path.length>1){pt=(pt+.012)%(path.length-1);var k=Math.floor(pt),f=pt-k,a=P[path[k]],b=P[path[k+1]];rx.fillStyle="#fff";rx.beginPath();rx.arc(a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,5,0,TAU);rx.fill()}}
/* ---------- 3 walk ---------- */
var wc=$("#wc"),wx=wc.getContext("2d"),NW=81,wr,wl,cl,wn,wrun=false;
function wreset(){wr=[];wl=[];cl=[];for(var i=0;i<NW;i++){wr.push([0,0]);wl.push([0,0]);cl.push(0)}wl[40]=[R,0];wr[40]=[0,R];cl[40]=1;wn=0}
function wstep(){var nl=[],nr=[],nc=[];for(var i=0;i<NW;i++){nl.push([0,0]);nr.push([0,0]);nc.push(0)}
for(var i=0;i<NW;i++){var L=wl[i],Rr=wr[i],a=[(L[0]+Rr[0])*R,(L[1]+Rr[1])*R],b=[(L[0]-Rr[0])*R,(L[1]-Rr[1])*R];if(i>0)nl[i-1]=[nl[i-1][0]+a[0],nl[i-1][1]+a[1]];if(i<NW-1)nr[i+1]=[nr[i+1][0]+b[0],nr[i+1][1]+b[1]];if(i>0)nc[i-1]+=cl[i]/2;if(i<NW-1)nc[i+1]+=cl[i]/2}wl=nl;wr=nr;cl=nc;wn++}
function wq(i){return wl[i][0]*wl[i][0]+wl[i][1]*wl[i][1]+wr[i][0]*wr[i][0]+wr[i][1]*wr[i][1]}
function sd(f){var m=0,v=0;for(var i=0;i<NW;i++)m+=(i-40)*f(i);for(i=0;i<NW;i++)v+=Math.pow(i-40-m,2)*f(i);return Math.sqrt(v)}
function drawW(){var W=wc.width,H=wc.height,mx=.001;for(var i=0;i<NW;i++)mx=Math.max(mx,wq(i),cl[i]);wx.fillStyle="#08101b";wx.fillRect(0,0,W,H);var bw=W/NW;for(i=0;i<NW;i++){var h=wq(i)/mx*(H-50),h2=cl[i]/mx*(H-50);wx.fillStyle="rgba(60,207,208,.85)";wx.fillRect(i*bw,H-20-h,bw*.5,h);wx.fillStyle="rgba(255,122,89,.85)";wx.fillRect(i*bw+bw*.5,H-20-h2,bw*.5,h2)}
wx.fillStyle="#8FA4B6";wx.font="12px monospace";wx.fillText("■ quantum   ■ classical   position −40…+40",8,14);$("#wt").textContent="Steps: "+wn+"   quantum spread σ = "+sd(wq).toFixed(2)+"   classical σ = "+sd(function(i){return cl[i]}).toFixed(2)+" (√steps = "+Math.sqrt(wn).toFixed(2)+")"}
$("#wpl").onclick=function(){wrun=!wrun};$("#ws").onclick=function(){if(wn<38)wstep()};$("#wr").onclick=wreset;wreset();
/* ---------- 4 estimator ---------- */
var ec=$("#ec"),ex=ec.getContext("2d"),ED={};
function fmt(v){if(v<1e3)return v.toFixed(0);var e=Math.floor(Math.log10(v));return (v/Math.pow(10,e)).toFixed(2)+"×10^"+e}
function est(){
  var Q=Math.pow(10,+$("#eq").value),Tg=Math.pow(10,+$("#et").value),p=Math.pow(10,+$("#ep").value);
  $("#eqv").textContent=Math.round(Q);$("#etv").textContent="10^"+$("#et").value;$("#epv").textContent=p.toExponential(1);
  var target=.01/(Q*Tg),pl=function(d){return .1*Math.pow(p/.01,(d+1)/2)},d=3,ok=false;
  for(;d<=101;d+=2){if(pl(d)<=target){ok=true;break}}
  ED={target:target,p:p,pl:pl,d:ok?d:101,ok:ok};
  var out;
  if(!ok){out="Not feasible: the error rate is too close to (or above) the 1% threshold for this size of computation. Lower the physical error rate."}
  else{var phys=Math.round(Q*2*(d+1)*(d+1)*1.5),secs=Tg*d*1e-6;
    out="Code distance d = "+d+"\nPhysical qubits ≈ "+fmt(phys)+" (includes about 50% for magic-state factories)\nRuntime ≈ "+(secs<60?secs.toFixed(1)+" s":secs<3600?(secs/60).toFixed(1)+" min":secs<86400?(secs/3600).toFixed(1)+" h":(secs/86400).toFixed(1)+" days")+"\nTarget error per operation ≈ "+target.toExponential(1)}
  $("#er").style.whiteSpace="pre-wrap";$("#er").textContent=out}
["#eq","#et","#ep"].forEach(function(s){$(s).addEventListener("input",est)});
function drawE(){
  var W=ec.width,H=ec.height;ex.fillStyle="#08101b";ex.fillRect(0,0,W,H);
  var lo=-30,hi=0,Y=function(v){var l=Math.max(lo,Math.min(hi,Math.log10(Math.max(v,1e-40))));return H-24-(l-lo)/(hi-lo)*(H-44)},X=function(d){return 36+(d-3)/98*(W-52)};
  ex.strokeStyle="#23364B";ex.beginPath();ex.moveTo(36,10);ex.lineTo(36,H-24);ex.lineTo(W-8,H-24);ex.stroke();
  ex.strokeStyle="#3CCFD0";ex.lineWidth=2;ex.beginPath();for(var d=3;d<=101;d+=2){var x=X(d),y=Y(ED.pl(d));d==3?ex.moveTo(x,y):ex.lineTo(x,y)}ex.stroke();
  ex.strokeStyle="#F2C14E";ex.setLineDash([5,4]);ex.beginPath();ex.moveTo(36,Y(ED.target));ex.lineTo(W-8,Y(ED.target));ex.stroke();ex.setLineDash([]);
  if(ED.ok){ex.fillStyle="#FF7A59";ex.beginPath();ex.arc(X(ED.d),Y(ED.pl(ED.d)),6,0,TAU);ex.fill()}
  ex.fillStyle="#8FA4B6";ex.font="11px monospace";ex.fillText("logical error (log) vs code distance 3…101",42,14);ex.fillText("— error budget per op",W-150,14)}
est();
/* ---------- 5 planner ---------- */
var PL={basics:[["IBM","Use a quantum computer today",5],["Microsoft","Introduction to quantum computing with Azure Quantum",0],["Microsoft","Explore quantum superposition with Q#",0],["IBM","Basics of quantum information",15]],
code:[["IBM","Use a quantum computer today",5],["Qiskit","Quick start: pip install qiskit",0],["Microsoft","Create your first Q# program (quantum random number generator)",0],["Microsoft","Teleport entangled qubits with Q#",0],["IBM","Quantum computing in practice",8],["IBM","Variational algorithm design",8]],
algo:[["IBM","Basics of quantum information",15],["IBM","Fundamentals of quantum algorithms",15],["IBM","Quantum chemistry with VQE",5],["IBM","Quantum diagonalization algorithms",10],["IBM","Quantum machine learning",10]],
qec:[["IBM","Basics of quantum information",15],["IBM","Foundations of quantum error correction",15],["Google","Hands-on quantum error correction on Coursera",0],["Microsoft","Estimate resources with the Microsoft Quantum resource estimator",0],["IBM","Tools for quantum advantage",12]],
lead:[["IBM","Quantum business foundations",3],["IBM","Designing and leading quantum projects",4],["IBM","Quantum computing in practice",8],["Google","Read the Google Quantum AI roadmap and research pages",0]]};
function plan(){var L=PL[$("#pg").value],t=0,h="";L.forEach(function(x,i){t+=x[2];h+='<li><span class="n">'+(i+1)+'</span><span><b>'+x[1]+'</b><br><small style="color:#8FA4B6">'+x[0]+'</small></span><span style="color:#F2C14E;font-family:monospace">'+(x[2]?x[2]+" h":"self-paced")+'</span></li>'});
$("#po").innerHTML=h;var w=Math.ceil(t/+$("#pw").value);$("#pt").textContent="Timed courses total "+t+" h, about "+w+" week"+(w==1?"":"s")+" at "+$("#pw").value+" h a week (self-paced modules not counted)."}
$("#pg").onchange=plan;$("#pw").onchange=plan;plan();
/* ---------- animation loop (runs only while visible) ---------- */
var vis={};
if("IntersectionObserver" in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){vis[e.target.id]=e.isIntersecting})});["cc","rc","wc","ec"].forEach(function(id){io.observe($("#"+id))})}else{["cc","rc","wc","ec"].forEach(function(id){vis[id]=true})}
var wt=0,reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
(function loop(){
  if(vis.cc){if(cst.auto&&!reduce)cst.ay+=.006;drawCC()}
  if(vis.rc){if(rst.auto&&!reduce)rst.ay+=.005;drawR()}
  if(vis.wc){if(wrun&&++wt%8==0&&wn<38)wstep();drawW()}
  if(vis.ec)drawE();
  requestAnimationFrame(loop)})();
})();
