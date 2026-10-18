# GOATMC Status

## Run locally / on a VPS
1. Install Node.js 18 or newer.
2. In this directory run `npm install`.
3. Set environment variables from `.env.example` (or configure them in your hosting panel).
4. Run `npm start`.
5. Open port 3000, or reverse-proxy your domain to `127.0.0.1:3000`.

## DNS / domain
Point `status.goatmc.fun` to your web host, then configure your reverse proxy (Nginx/Caddy/Cloudflare Tunnel) to forward requests to the app port.

## Monitoring notes
- The Website check requests `WEBSITE_URL`.
- Velocity is checked with a Minecraft status ping at `VELOCITY_HOST:VELOCITY_PORT`.
- For independent Lifesteal status, set `LIFESTEAL_HOST` and `LIFESTEAL_PORT` to the actual backend address reachable from this monitor. If both game checks use `play.goatmc.fun:25565`, they measure the same public proxy endpoint and do **not** prove that the backend itself is healthy.
- The app records one sample per check and calculates uptime from samples collected since the history file was created. It cannot truthfully show historical uptime from before installation.
- Keep `uptime-history.json` persistent across restarts/deployments.


## Logo
The header logo and browser favicon are `public/logo.svg` and `public/favicon.svg`. Replace these files with your own SVG logo to customize branding (keep the filenames), then redeploy. The current logo is a GOATMC-themed placeholder.
