# Eleventory on Railway (staging)

One Railway project, five services, all built from this GitHub repo (monorepo, so each service has a **Root Directory**).

| Service | Source | Root dir | Start command | Public? |
|---|---|---|---|---|
| `mysql` | Railway MySQL (or MariaDB template) | - | - | no |
| `redis` | Railway Redis | - | - | no |
| `api` | GitHub repo | `backend` | image default | yes (port `8080`) |
| `worker` | same repo | `backend` | `php artisan queue:work --tries=3 --max-time=3600` | no |
| `scheduler` | same repo | `backend` | `php artisan schedule:work` | no |
| `web` | same repo | `frontend` | image default | yes (port `3000`) |

Only `api` runs migrations (`AUTORUN_ENABLED`); give `worker` and `scheduler` the variable `AUTORUN_ENABLED=false`.

## Variables

`api`, `worker`, `scheduler` (shared; use Railway variable references for the database):

```
APP_NAME=Eleventory
APP_ENV=production
APP_DEBUG=false
APP_KEY=base64:...            # php artisan key:generate --show (run locally), same value on all three
APP_URL=https://<api public domain>
FRONTEND_URL=https://<web public domain>
CORS_ALLOWED_ORIGINS=https://<web public domain>
DB_CONNECTION=mysql
DB_HOST=${{mysql.MYSQLHOST}}
DB_PORT=${{mysql.MYSQLPORT}}
DB_DATABASE=${{mysql.MYSQLDATABASE}}
DB_USERNAME=${{mysql.MYSQLUSER}}
DB_PASSWORD=${{mysql.MYSQLPASSWORD}}
REDIS_CLIENT=phpredis
REDIS_HOST=${{redis.REDISHOST}}
REDIS_PORT=${{redis.REDISPORT}}
REDIS_PASSWORD=${{redis.REDISPASSWORD}}
CACHE_STORE=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis
STOREFRONT_SSR_KEY=<random 48 chars, same as web>
LOG_CHANNEL=stderr
FILESYSTEM_DISK=public      # ephemeral on Railway: attach a Volume at /var/www/html/storage/app/public, or move media to R2/S3
PORT=8080                   # api only
```

`web`:

```
NEXT_PUBLIC_API_URL=https://<api public domain>/api/v1     # build-time
NEXT_PUBLIC_SITE_URL=https://<web public domain>           # build-time
STOREFRONT_SSR_KEY=<same as api>
```

Changing a `NEXT_PUBLIC_*` value needs a redeploy of `web`.

## First boot

1. Deploy `mysql`, `redis`, then `api` (it migrates on start).
2. Seed demo data once if wanted: `php artisan db:seed --force` from the service shell.
3. Generate public domains for `api` and `web`, then put them into the variables above and redeploy both.
4. Check `https://<api>/up` and `https://<web>/`.

## Notes

- Railway disks are ephemeral. Uploaded product images need a Volume or object storage before this holds real data.
- The live cPanel site (`elevendollar.store`) is untouched by this setup.
- Custom domains per merchant (SaaS Phase 4) should live on a VPS with on-demand TLS, not here.
