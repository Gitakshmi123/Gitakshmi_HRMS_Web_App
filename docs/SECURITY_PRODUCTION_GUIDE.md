# GT HRMS Production Security Guide

## Hardened structure

```text
GT_HRMS/
|-- client/
|   |-- index.html
|   |-- vite.config.js
|   `-- src/
|       |-- context/
|       |   |-- AuthContext.jsx
|       |   `-- JobPortalAuthContext.jsx
|       |-- main.jsx
|       `-- utils/
|           |-- api.js
|           `-- token.js
|-- docs/
|   `-- SECURITY_PRODUCTION_GUIDE.md
`-- server/
    |-- app.js
    |-- controllers/
    |   |-- auth.controller.js
    |   |-- candidate.controller.js
    |   `-- securityProxy.controller.js
    |-- middleware/
    |   |-- auth.jwt.js
    |   |-- jobPortalAuthMiddleware.js
    |   `-- security.middleware.js
    |-- routes/
    |   |-- auth.routes.js
    |   |-- candidate.routes.js
    |   `-- securityProxy.routes.js
    `-- utils/
        `-- ssrShell.js
```

## What was implemented

- Source maps disabled in Vite production builds.
- Production minification hardened and JavaScript obfuscation retained.
- Frontend API base changed to same-origin `/api`.
- Login flows moved to HTTP-only cookies instead of browser-stored bearer tokens.
- Candidate login aligned to secure cookies as well.
- Browser-side third-party lookups moved behind backend proxy endpoints.
- Express hardened with CSP, HSTS, referrer policy, permissions policy, `nosniff`, `SAMEORIGIN`, and no-store API responses.
- Source map requests and source directories are explicitly denied in production.
- Production frontend responses now use a server-rendered HTML shell so page source is HTML-first.

## Deployment steps

1. Build frontend with `npm run build:secure --prefix client`
2. Start backend in production mode with `NODE_ENV=production`
3. Put the app behind TLS termination such as Nginx, Azure App Gateway, AWS ALB, or Cloudflare
4. Set production secrets:
   - `JWT_SECRET`
   - `REFRESH_TOKEN_SECRET`
   - `MONGO_URI`
   - mail, storage, and cloud provider secrets
5. Serve only `server` plus compiled `client/dist`
6. Block debug, backup, and source artifacts at the reverse proxy:
   - `*.map`
   - `/src`
   - `/server`
   - `/client`
   - dotfiles
7. Turn on centralized logging, WAF, IDS/IPS, DB backups, and secret rotation

## Exact reverse proxy configs

- Nginx sample: [deployment/nginx/hrms.conf](C:\Users\baldaniya nitesh\Desktop\GT_HRMS\GT_HRMS\deployment\nginx\hrms.conf)
- Apache sample: [deployment/apache/hrms-vhost.conf](C:\Users\baldaniya nitesh\Desktop\GT_HRMS\GT_HRMS\deployment\apache\hrms-vhost.conf)

## Exact production rollout

1. Set environment on server:
   - `NODE_ENV=production`
   - `PORT=5000`
   - `JWT_SECRET=<strong-random-secret>`
   - `REFRESH_TOKEN_SECRET=<strong-random-secret>`
   - `MONGO_URI=<production-mongodb-uri>`
2. Build app:
   - `npm run build:secure --prefix client`
3. Start app with PM2:
   - `pm2 start server/server.js --name gt-hrms`
   - `pm2 save`
   - `pm2 startup`
4. Copy either Nginx or Apache config and replace `hrms.example.com` with your real domain
5. Install TLS certificate
6. Reload reverse proxy
7. Validate:
   - `/` opens app
   - `/api/health` returns healthy JSON
   - `/*.map` returns 404 or 403
   - `/src/main.jsx` returns 404 or 403
   - login works without browser-stored token
   - DevTools does not show source maps

## Final pre-go-live checklist

- Build completed with `npm run build:secure --prefix client`
- Only `client/dist` assets are served
- No `.map` files are deployed
- Reverse proxy blocks `/src`, `/server`, `/client`, `node_modules`, and hidden files
- HSTS enabled only after HTTPS is confirmed stable
- Cookies are `HttpOnly`, `Secure`, and `SameSite`
- MongoDB is not internet-exposed
- Uploads path has malware scanning if business policy requires it
- Logs do not contain JWTs, passwords, or payroll payloads
- Backup restore drill has been tested
- WAF/rate limiting is enabled at proxy or CDN layer too

## Enterprise checklist

- Use HTTPS everywhere with HSTS enabled
- Keep auth tokens in HTTP-only cookies only
- Do not return stack traces in production
- Do not expose internal service origins to the browser
- Proxy third-party browser lookups through the backend
- Use CSP and block inline scripts where practical
- Disable source maps in production
- Deny access to source folders and `.map` files
- Mark API responses `Cache-Control: no-store`
- Store only non-sensitive UI cache data in local storage
- Add audit logging for auth, payroll, document access, and admin actions
- Add CSRF protection if cookie-authenticated write traffic is allowed cross-site
- Add secret rotation, dependency pinning, and SAST/DAST in CI/CD

## Important boundary

No web application can make authorized data completely invisible in DevTools if the browser must render that data. The secure goal is to hide infrastructure details, avoid leaking secrets, minimize readable code, and send only the minimum data needed for the current screen.
