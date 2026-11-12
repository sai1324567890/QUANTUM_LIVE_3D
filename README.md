# Quantum Hub (React + Vite)

```bash
npm install
npm run dev       # local development
npm run build     # production build in dist/
npm run preview   # preview the build
```

## Structure
```
index.html                 SEO tags, JSON-LD, fonts, three.js
public/                    favicon, robots.txt, sitemap.xml, ads.txt, learn/*.html (7 SEO pages)
src/main.jsx               React entry
src/App.jsx                root component
src/components/SiteShell   renders the page markup
src/hooks/useLegacyScripts runs the simulation scripts once
src/legacy/body.html       page markup (nav, hero, all sections)
src/legacy/js/*.js         one file per feature (AI simulator, studio, knowledge base, hub lessons, course modules, theme)
src/styles/base.css        global + Hub + Course styles
src/styles/sections.css    AI hero, Part III, knowledge base, plans styles
SITE-SETUP.md              Google Sign-In, AdSense, waitlist, domain and Search Console setup
```

## Settings
Edit `window.QH_CONFIG` near the top of `src/legacy/js/00-ai-simulator-auth.js`
(Google client ID, AdSense IDs, waitlist endpoint). Replace `https://YOUR-DOMAIN.com`
in `index.html`, `public/sitemap.xml`, `public/robots.txt` and `public/learn/*.html`.

## Note
The page and its simulations are the original working code, split into files and hosted
by a React component. Individual sections can be converted into React components one by one.
