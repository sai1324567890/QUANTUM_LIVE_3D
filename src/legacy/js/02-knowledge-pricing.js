
(function(){var d=document;d.addEventListener("click",function(ev){var b=ev.target.closest&&ev.target.closest(".try");if(b&&window.QH_ASK)window.QH_ASK(b.getAttribute("data-q"))});
var f=d.getElementById("wl");if(!f)return;f.addEventListener("submit",function(ev){ev.preventDefault();var em=d.getElementById("wle").value.trim(),pl=d.getElementById("wlp").value,m=d.getElementById("wlm"),C=window.QH_CONFIG||{};
function ok(){m.textContent="Thanks, you are on the "+pl+" waitlist.";f.reset()}
if(C.WAITLIST_ENDPOINT){fetch(C.WAITLIST_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:em,plan:pl})}).then(ok).catch(function(){m.textContent="Could not send. Please try again."})}
else{try{var a=JSON.parse(localStorage.getItem("qh-waitlist")||"[]");a.push({email:em,plan:pl,t:Date.now()});localStorage.setItem("qh-waitlist",JSON.stringify(a))}catch(x){}ok()}})})();
