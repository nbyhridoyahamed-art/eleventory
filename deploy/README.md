# Deploying Eleventory to cPanel

Layout:

| URL | What | Where on the host |
|---|---|---|
| `https://elevendollar.store` | Next.js storefront + admin | Setup Node.js App, root `~/elevendollar.store` |
| `https://api.elevendollar.store` | Laravel API | `~/laravel_app` (document root `~/laravel_app/public`) |

## 1. Build locally

```
cp deploy/frontend.env.production.example frontend/.env.production   # then fill STOREFRONT_SSR_KEY
PHP_BIN=/d/xampp/php84/php.exe COMPOSER_PHAR=/c/ProgramData/ComposerSetup/bin/composer.phar bash deploy/build-release.sh
```

Produces `dist/backend.tar.gz` and `dist/frontend.tar.gz`. Building here keeps the host's I/O and memory limits out of the picture.

## 2. Database

Create the database and user in **MySQL Databases**, then import a dump of the local data
(`mysqldump -h127.0.0.1 -P3307 -uroot eleventory > eleventory.sql`) through phpMyAdmin,
or run `php artisan migrate --force` for an empty database.

## 3. API

```
cd ~/laravel_app && tar -xzf ~/backend.tar.gz
cp deploy/backend.env.production.example .env    # fill DB_*, STOREFRONT_SSR_KEY
php artisan key:generate
php artisan storage:link
php artisan config:cache && php artisan route:cache && php artisan event:cache
```

`php` must be PHP 8.4 (`/opt/cpanel/ea-php84/root/usr/bin/php` or `alt-php84`).
Make sure `storage` and `bootstrap/cache` are writable.

## 4. Frontend

In **Setup Node.js App** create an app (Node 20+), application root `elevendollar.store`,
startup file `server.js`, and add `STOREFRONT_SSR_KEY` (same value as the API).
Extract `frontend.tar.gz` into the application root, then **Restart**.

## 5. After going live

- Change the demo admin password.
- Restrict CORS to the storefront origin.
- Configure SMS/email in Settings -> Notifications and send a test.
