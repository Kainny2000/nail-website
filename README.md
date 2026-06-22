# Bare Form — Nail Artist Website

A Spanish-language portfolio site for a nail artist (Orem, UT), self-hosted on a home PC with a changing IP.

- **Stack:** Astro 5 (SSR) + `@astrojs/node` + Caddy (reverse proxy / Let's Encrypt via Porkbun DNS-01) + PM2.
- **Admin:** password + TOTP (Google Authenticator / 1Password / Authy), drag-to-reorder, upload/replace/delete.
- **Storage:** uploaded images live on the home PC's disk; an offsite backup is pushed to a private GitHub repo every 4 hours.
- **Dynamic IP:** handled by a 5-minute cron that updates the Porkbun DNS A record.

## Project layout

```
.
├── astro.config.mjs            SSR config (Node adapter, localhost-only)
├── src/
│   ├── middleware.ts           Security headers, rate limit, auth gate, CSRF
│   ├── env.d.ts                Locals typing
│   ├── pages/
│   │   ├── index.astro         Home (slideshow)
│   │   ├── gallery.astro       Gallery (legacy static images)
│   │   ├── services.astro      Services + price estimator
│   │   ├── press-on.astro      Press-on nails
│   │   ├── admin/index.astro   Admin login + image manager
│   │   ├── api/auth/           login, totp, logout, setup-totp
│   │   ├── api/images/         GET/POST/DELETE/PUT (order)
│   │   ├── api/uploads/[file]  Stream uploaded files
│   │   └── api/healthz
│   ├── server/lib/             auth, session, csrf, storage, image, audit, rate-limit
│   ├── components/             existing components (HomeSlideshow rewritten to read manifest)
│   ├── data/                   services.ts, press-on.ts (still static)
│   └── styles/
├── deploy/                     Operational scripts
│   ├── Caddyfile               Caddy config
│   ├── caddy.env.example       Porkbun API env
│   ├── setup-server.sh         One-time OS setup
│   ├── install-caddy.sh        Build Caddy with Porkbun DNS module
│   ├── install-crons.sh        Install DDNS + backup crons
│   ├── install-runner.sh       Install GitHub self-hosted runner
│   ├── update-ddns.sh          Porkbun DDNS updater
│   └── backup-to-github.sh     Snapshot uploads to private repo
├── scripts/hash-password.mjs   Bcrypt password hasher
└── .github/workflows/deploy.yml  Build + restart on push to main
```

## Local development

```bash
nvm use 22    # or: nvm install 22
npm ci
cp .env.example .env
# generate session secret: openssl rand -base64 32 → SESSION_SECRET
# generate password hash: npm run hash-password -- "your-password" → ADMIN_PASSWORD_HASH
chmod 600 .env
npm run dev   # http://127.0.0.1:4321
```

`.env` is auto-loaded from the current working directory by `dotenv/config` (imported at the top of `src/middleware.ts`). No shell incantation needed.

Visit `http://127.0.0.1:4321/admin` to log in.

## Production deployment (one-time)

The full deployment guide is in `deploy/setup-server.sh`. In short, on the home PC:

```bash
# 1. OS setup
sudo bash deploy/setup-server.sh

# 2. Porkbun API keys
sudo -iu nail
mkdir -p ~/.porkbun && chmod 700 ~/.porkbun
echo 'pk1_xxx' > ~/.porkbun/api_key   && chmod 600 ~/.porkbun/api_key
echo 'sk1_xxx' > ~/.porkbun/secret_key && chmod 600 ~/.porkbun/secret_key

# 3. Caddy with Porkbun DNS module
sudo bash deploy/install-caddy.sh
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo cp deploy/caddy.env.example /etc/caddy/caddy.env
sudo vi /etc/caddy/caddy.env   # paste your real Porkbun keys
sudo chmod 600 /etc/caddy/caddy.env
sudo systemctl restart caddy

# 4. App env + first build
cp .env.example .env
$EDITOR .env   # fill SESSION_SECRET and ADMIN_PASSWORD_HASH
npm ci && npm run build

# 5. Start with PM2
pm2 start ./dist/server/entry.mjs --name nail
pm2 startup systemd    # run the printed sudo command
pm2 save

# 6. Crons
bash deploy/install-crons.sh

# 7. Self-hosted GitHub Actions runner (for automatic deploys)
#    First: create a token at
#    https://github.com/Kainny2000/nail-website/settings/actions/runners/new
bash deploy/install-runner.sh <RUNNER_TOKEN>

# 8. Router: port-forward 80, 443, 2222 → this machine

# 9. Squarespace → Porkbun nameservers (see deploy/setup-server.sh output)

# 10. Open https://bareformbysh.com/admin and complete TOTP enrollment
```

## Security model

| Layer | Control |
|---|---|
| Network | UFW (only 2222, 80, 443 inbound), SSH on non-default port, key-only, fail2ban, unattended-upgrades. |
| TLS | Caddy with Let's Encrypt via Porkbun DNS-01 (works despite dynamic IP). |
| Process | PM2 under non-root `nail` user. App binds to `127.0.0.1:4321` only. |
| App | helmet-style headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy). |
| Auth | Single admin. Bcrypt password (cost 12) + TOTP (RFC 6238, ±1 step). Session in signed cookies. |
| CSRF | Double-submit cookie on every mutating API request. |
| Rate limit | 10 / 15 min on `/api/auth/*`; 60 / min on other mutating API. |
| Image | Magic-byte validation, 8 MB cap, `sharp` re-encode to 1600 px WebP, EXIF strip, no metadata kept. |
| Files | `nail-uploads/` and `nail-data/` are `chmod 700`. `manifest.json`, `totp.json`, `audit.log` are `chmod 600`. |
| Backups | Every 4h, `rsync` of uploads + manifest into a private GitHub repo via a dedicated deploy key. |
| Audit | Every admin action appended to `~/log/audit.log`. |
| Recovery | If password lost: SSH in as `nail` and edit `.env` `ADMIN_PASSWORD_HASH`. If 2FA lost: delete `~/nail-data/totp.json` and re-enroll on next login. |

## ⚠ Trade-offs you accepted

- **Home IP is public in DNS** (no Cloudflare proxy). Any attacker who resolves the domain can find your IP. Mitigation: nothing else listens, UFW blocks all other ports, SSH on a non-default port behind fail2ban.
- **No WAF at the edge.** Strong rate limits + auth gates are the only protection. If traffic ever gets large, consider adding Cloudflare in front (no code changes required — just point the domain at Cloudflare and proxy to your Caddy origin).

## Operations

| Task | Command |
|---|---|
| View app logs | `pm2 logs nail` |
| Restart app | `pm2 restart nail` |
| View audit log | `tail -f ~/log/audit.log` |
| View DDNS log | `tail -f ~/log/ddns.log` |
| Manual deploy | push to `main` (the GitHub Actions self-hosted runner does it) |
| Manual DDNS update | `bash deploy/update-ddns.sh` |
| Manual backup | `bash deploy/backup-to-github.sh` |
| Add a new admin | edit `ADMIN_PASSWORD_HASH` in `.env`, `pm2 restart nail` |
| Reset 2FA | `rm ~/nail-data/totp.json` and re-enroll at `/admin` |

## Type check (optional)

```bash
npx astro check
```

Reports 80+ stylistic warnings (mostly implicit `any` in JSDoc-style TS) under the strict tsconfig that `astro/tsconfigs/strict` enables. None affect the build or runtime; they can be addressed by adding explicit types to the server-side library parameters when convenient.

---

# Bare Form — Sitio de manicurista

Sitio de portafolio en español para una manicurista (Orem, UT), auto-alojado en un PC de casa con IP dinámica.

- **Stack:** Astro 5 (SSR) + `@astrojs/node` + Caddy (reverse proxy / Let's Encrypt vía Porkbun DNS-01) + PM2.
- **Admin:** contraseña + TOTP (Google Authenticator / 1Password / Authy), arrastrar para reordenar, subir/reemplazar/eliminar.
- **Almacenamiento:** las imágenes subidas viven en el disco del PC; una copia de seguridad fuera del sitio se sube a un repositorio privado de GitHub cada 4 horas.
- **IP dinámica:** resuelta con un cron cada 5 minutos que actualiza el registro A en Porkbun.

## Estructura del proyecto

(Ver sección en inglés arriba — la estructura es la misma.)

## Desarrollo local

```bash
nvm use 22
npm ci
cp .env.example .env
# genera un secret: openssl rand -base64 32 → SESSION_SECRET
# genera hash de contraseña: npm run hash-password -- "tu-contraseña" → ADMIN_PASSWORD_HASH
chmod 600 .env
npm run dev   # http://127.0.0.1:4321
```

`.env` se carga automáticamente desde el directorio de trabajo gracias a `dotenv/config` (importado al inicio de `src/middleware.ts`). No hace falta ningún truco de shell.

Visita `http://127.0.0.1:4321/admin` para iniciar sesión.

## Despliegue a producción (una sola vez)

La guía completa está en `deploy/setup-server.sh`. Resumido:

```bash
# 1. Configurar el sistema operativo
sudo bash deploy/setup-server.sh

# 2. Claves de API de Porkbun
sudo -iu nail
mkdir -p ~/.porkbun && chmod 700 ~/.porkbun
echo 'pk1_xxx' > ~/.porkbun/api_key   && chmod 600 ~/.porkbun/api_key
echo 'sk1_xxx' > ~/.porkbun/secret_key && chmod 600 ~/.porkbun/secret_key

# 3. Caddy con el módulo DNS de Porkbun
sudo bash deploy/install-caddy.sh
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo cp deploy/caddy.env.example /etc/caddy/caddy.env
sudo vi /etc/caddy/caddy.env   # pega tus claves reales de Porkbun
sudo chmod 600 /etc/caddy/caddy.env
sudo systemctl restart caddy

# 4. Variables de entorno y primer build
cp .env.example .env
$EDITOR .env   # rellena SESSION_SECRET y ADMIN_PASSWORD_HASH
npm ci && npm run build

# 5. Iniciar con PM2
pm2 start ./dist/server/entry.mjs --name nail
pm2 startup systemd    # ejecuta el comando sudo que imprime
pm2 save

# 6. Crons
bash deploy/install-crons.sh

# 7. Runner auto-hospedado de GitHub Actions
#    Primero crea un token en
#    https://github.com/Kainny2000/nail-website/settings/actions/runners/new
bash deploy/install-runner.sh <RUNNER_TOKEN>

# 8. Router: redirigir puertos 80, 443, 2222 → esta máquina

# 9. Squarespace → nameservers de Porkbun (ver salida de deploy/setup-server.sh)

# 10. Abre https://bareformbysh.com/admin y completa la inscripción de TOTP
```

## Modelo de seguridad

| Capa | Control |
|---|---|
| Red | UFW (solo 2222, 80, 443 entrantes), SSH en puerto no estándar, solo llave, fail2ban, unattended-upgrades. |
| TLS | Caddy con Let's Encrypt vía Porkbun DNS-01 (funciona pese a la IP dinámica). |
| Proceso | PM2 bajo el usuario `nail` sin root. La app escucha solo en `127.0.0.1:4321`. |
| App | Cabeceras tipo helmet (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy). |
| Auth | Un solo admin. Contraseña con Bcrypt (coste 12) + TOTP (RFC 6238, ±1 paso). Sesión en cookies firmadas. |
| CSRF | Cookie double-submit en cada petición API que modifica estado. |
| Rate limit | 10 / 15 min en `/api/auth/*`; 60 / min en el resto de API que modifica. |
| Imágenes | Validación de magic bytes, tope 8 MB, re-codificación con `sharp` a WebP 1600 px, EXIF eliminado. |
| Archivos | `nail-uploads/` y `nail-data/` en `chmod 700`. `manifest.json`, `totp.json`, `audit.log` en `chmod 600`. |
| Respaldos | Cada 4h, `rsync` de uploads + manifest a un repo privado de GitHub mediante una llave de despliegue dedicada. |
| Auditoría | Cada acción admin se agrega a `~/log/audit.log`. |
| Recuperación | Si pierdes la contraseña: SSH como `nail` y edita `ADMIN_PASSWORD_HASH` en `.env`. Si pierdes 2FA: borra `~/nail-data/totp.json` y vuelve a inscribir. |

## ⚠ Trade-offs que aceptaste

- **La IP de tu casa queda pública en el DNS** (no hay proxy de Cloudflare). Cualquier atacante que resuelva el dominio puede encontrar tu IP. Mitigación: nada más escucha, UFW bloquea todo lo demás, SSH en puerto no estándar detrás de fail2ban.
- **No hay WAF en el borde.** Los rate limits estrictos y la auth son la única protección. Si el tráfico crece, considera agregar Cloudflare delante (no requiere cambios de código — solo apunta el dominio a Cloudflare y proxifica al origen de Caddy).

## Operaciones

| Tarea | Comando |
|---|---|
| Ver logs de la app | `pm2 logs nail` |
| Reiniciar la app | `pm2 restart nail` |
| Ver log de auditoría | `tail -f ~/log/audit.log` |
| Ver log de DDNS | `tail -f ~/log/ddns.log` |
| Despliegue manual | push a `main` (lo hace el runner auto-hospedado) |
| Actualización manual de DDNS | `bash deploy/update-ddns.sh` |
| Respaldo manual | `bash deploy/backup-to-github.sh` |
| Cambiar contraseña admin | edita `ADMIN_PASSWORD_HASH` en `.env`, `pm2 restart nail` |
| Resetear 2FA | `rm ~/nail-data/totp.json` y vuelve a inscribir en `/admin` |
