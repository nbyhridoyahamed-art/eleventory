# Eleventory API image for Railway (or any Docker host).
# Same image runs three services; only the start command differs:
#   web       -> default (nginx + php-fpm on :8080)
#   worker    -> php artisan queue:work --tries=3 --max-time=3600
#   scheduler -> php artisan schedule:work

FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction --ignore-platform-reqs

FROM serversideup/php:8.4-fpm-nginx

ENV PHP_OPCACHE_ENABLE=1 \
    AUTORUN_ENABLED=true \
    AUTORUN_LARAVEL_STORAGE_LINK=true \
    AUTORUN_LARAVEL_MIGRATION=true \
    AUTORUN_LARAVEL_MIGRATION_ISOLATION=true \
    AUTORUN_LARAVEL_CONFIG_CACHE=true \
    AUTORUN_LARAVEL_ROUTE_CACHE=true \
    AUTORUN_LARAVEL_VIEW_CACHE=true

WORKDIR /var/www/html
COPY --chown=www-data:www-data --from=vendor /app/vendor ./vendor
COPY --chown=www-data:www-data . .

USER www-data
RUN composer dump-autoload --optimize --no-dev --no-scripts 2>/dev/null || true \
    && mkdir -p storage/framework/{cache,sessions,views} storage/logs bootstrap/cache
