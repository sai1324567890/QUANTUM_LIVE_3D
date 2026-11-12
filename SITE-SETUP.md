# Quantum Hub: setup notes

1. **Domain**: replace `https://YOUR-DOMAIN.com` with your real address in index.html, learn/*.html, sitemap.xml and robots.txt (search and replace across the folder).
2. **Google Sign-In**: create an OAuth Web client ID in Google Cloud Console (Authorised JavaScript origins = your domain), then set `GOOGLE_CLIENT_ID` in the `window.QH_CONFIG` line of index.html. The page only reads the signed token in the browser. For real accounts and paid features you must verify the token on a server.
3. **AdSense**: after your site is approved, set `ADSENSE_CLIENT` (ca-pub-...) and the three slot IDs in `QH_CONFIG`, and put your line in ads.txt. Empty slots stay hidden.
4. **Waitlist and payments**: set `WAITLIST_ENDPOINT` to a form service URL (for example Formspree) so emails reach you. For paid plans use Stripe Checkout plus a small backend.
5. **Search**: submit sitemap.xml in Google Search Console. Add an og-image.png (1200x630) at the site root.
