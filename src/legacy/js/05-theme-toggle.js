
(function(){var h=document.documentElement,b=document.getElementById('themeBtn');function cur(){return h.getAttribute('data-theme')||'dark'}function lab(){b.textContent=cur()==='dark'?'☀ Light':'☾ Dark'}lab();b.addEventListener('click',function(){var n=cur()==='dark'?'light':'dark';h.setAttribute('data-theme',n);try{localStorage.setItem('qh-theme',n)}catch(e){}lab()})})();
