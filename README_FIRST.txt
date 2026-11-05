KESHAVWITHVELO — OBSIDIAN / HIGH-END 3D PLUGIN WEBSITE
=====================================================

OPEN WITHOUT .BAT / TERMINAL / NPM / SERVER
-------------------------------------------
1. Extract this complete ZIP folder. Keep assets/ and catalog.js next to the HTML files.
2. Double-click index.html to open your PUBLIC WEBSITE in Chrome / Edge.
3. Double-click admin.html to open your PRIVATE ADMIN WORKSPACE separately.
4. Add plugins in Admin > Plugin Library > New Release.
   - Add a plugin name, description, category, version and optionally an icon.
   - Paste a DIRECT public download URL for Windows, macOS, or both.
   - Save. You may edit/delete releases later.
5. To display changes in index.html, open Admin > Publish / Backup:
   OPTION A (Chrome): Choose "SELECT WEBSITE FOLDER & SAVE" and pick the
       folder containing index.html. It updates catalog.js. Refresh index.html.
   OPTION B (Any browser): Choose "DOWNLOAD catalog.js INSTEAD", then
       move/replace the existing catalog.js in the extracted website folder.
       Refresh index.html.

No .bat file exists in this ZIP. Opening index.html and admin.html only needs
Chrome / Edge; no command prompt or installation. The 3D model is original,
procedurally generated, and has a CPU canvas fallback if WebGL is unavailable.
Bird motion and scroll effects work offline and support reduced-motion settings.

HOW DOWNLOADS WORK
------------------
- Put an actual publicly accessible http(s) DIRECT file download URL in Admin.
- Clicking the download button requests that URL; if that hosting provider
  forces a login / opens a preview page, it cannot be overridden by plain HTML.
- Windows and macOS are independent fields, so each gets a separate button.
- No example/fake download links are preloaded; the collection starts empty.
- Admin is not linked anywhere on the public website.

VERY IMPORTANT: OFFLINE HTML ≠ ONLINE SHARED ADMIN
-------------------------------------------------
Opening two standalone HTML files DOES NOT create a public database.
Plugin edits are staged in admin's local browser storage and MUST be published
via catalog.js as explained above. After publishing catalog.js in the folder,
index.html reads that file on each refresh.

To distribute the site publicly as a STATIC website, upload index.html,
catalog.js, and assets/ to any normal static host; do NOT upload admin.html,
server.js, data/ or uploads/ with that static public site. Keep admin.html private.
Update catalog.js on hosting whenever you publish a new plugin.

NODE.JS PUBLIC-SYNC MODE (OPTIONAL; NO .BAT, NO npm install)
-----------------------------------------------------------
If you later want the admin panel to instantly publish plugins to everyone,
use a Node.js host. This requires actual always-on hosting; double-click HTML
alone cannot do the same thing.

- Requirements: Node.js 20+ on your server.
- Run: node server.js
- Public website: http://localhost:3000
- Admin panel: http://localhost:3000/admin.html
- API: /api/state and /api/plugins
- JSON metadata is stored in data/; uploaded plugin files go in uploads/.
- Server supports direct file uploads (200MB max each), or remote URLs.
- The Node.js server has ZERO npm dependencies.

ADMIN SECURITY
--------------
Admin is a separate HTML file and is not linked from the public website.
This is for organization, NOT protection: hidden URLs are not secure.

- Direct offline HTML: admin is password-free by default. An optional browser-
  side lock can be enabled in Security, but is NOT real authentication.
- Node.js mode: admin write operations are restricted to localhost until
  a server-side password is configured. On the hosting server, start with
  ADMIN_PASSWORD set to a strong secret, or configure one locally BEFORE
  making the website publicly accessible. Once set, the server validates
  admin sessions and blocks unauthenticated writes.
- The server never exposes data/auth.json, the uploads directory, or the raw
  JSON database as public static files.
- Always host behind HTTPS and back up data/ and uploads/. Public security
  also depends on your host and infrastructure configurations.
- If your public web host cannot run Node.js, deploy only the static site
  (index.html, catalog.js, assets/) and keep admin.html offline/private.

FOLDER MAP
----------
index.html          PUBLIC website (no admin link)
admin.html          PRIVATE admin interface (separate HTML)
catalog.js          Published plugin listings / settings for direct HTML
assets/site.css     Public dark metallic styles
assets/site.js      Catalog, filters, cursor, birds, download actions
assets/scene.js     WebGL2 mechanical reactor, scroll explosion
assets/fallback.js  CPU-rendered 3D fallback if WebGL is disabled
assets/admin.css    Private control panel styles
assets/admin.js     Private admin CRUD, publish, backups, security
server.js           Optional Node.js public-sync API; no npm needed
data/               Backend JSON database (never publish statically)
uploads/            Uploaded plugin packages (never publish statically)

QUICK TIP: Open admin.html in Chrome, enter one real Windows/Mac file URL,
click "SELECT WEBSITE FOLDER & SAVE", then refresh index.html. DONE.
