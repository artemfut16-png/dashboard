# Дашборд

CRM для лидов, задачи, проекты и аналитика агентства. Одна страница (`index.html`), данные хранятся в Supabase и доступны только после входа.

- `index.html` — готовая страница, её отдаёт GitHub Pages.
- `src/dashboard-source.html` — исходник.
- `src/build-site.js` — сборка: `node build-site.js <SUPABASE_URL> <PUBLISHABLE_KEY>` (запускать из `src`, исходник должен называться `leads-crm.html`).
