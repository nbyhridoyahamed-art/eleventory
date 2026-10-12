<?php

use App\Http\Controllers\Api\V1\Account\AddressController as AccountAddressController;
use App\Http\Controllers\Api\V1\Account\AuthController as AccountAuthController;
use App\Http\Controllers\Api\V1\Account\OrderController as AccountOrderController;
use App\Http\Controllers\Api\V1\Account\ProfileController as AccountProfileController;
use App\Http\Controllers\Api\V1\Account\ReviewController as AccountReviewController;
use App\Http\Controllers\Api\V1\AnalyticsController;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\BlogCategoryController;
use App\Http\Controllers\Api\V1\BlogPostController;
use App\Http\Controllers\Api\V1\BlogTagController;
use App\Http\Controllers\Api\V1\BrandController;
use App\Http\Controllers\Api\V1\CategoryController;
use App\Http\Controllers\Api\V1\CodSettlementController;
use App\Http\Controllers\Api\V1\CouponController;
use App\Http\Controllers\Api\V1\CourierController;
use App\Http\Controllers\Api\V1\NotificationSettingController;
use App\Http\Controllers\Api\V1\CurrencyController;
use App\Http\Controllers\Api\V1\CustomerAddressController;
use App\Http\Controllers\Api\V1\CustomerController;
use App\Http\Controllers\Api\V1\CustomerStoreCreditController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\DeliveryZoneController;
use App\Http\Controllers\Api\V1\HomepageBlockController;
use App\Http\Controllers\Api\V1\LocationController;
use App\Http\Controllers\Api\V1\MediaController;
use App\Http\Controllers\Api\V1\NewsletterSubscriberController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\OrderController;
use App\Http\Controllers\Api\V1\OrderPaymentController;
use App\Http\Controllers\Api\V1\PageController;
use App\Http\Controllers\Api\V1\ProductAttributeController;
use App\Http\Controllers\Api\V1\ProductComponentController;
use App\Http\Controllers\Api\V1\ProductController;
use App\Http\Controllers\Api\V1\ProductImageController;
use App\Http\Controllers\Api\V1\ProductImportController;
use App\Http\Controllers\Api\V1\ProductVariantController;
use App\Http\Controllers\Api\V1\PurchaseOrderController;
use App\Http\Controllers\Api\V1\PurchaseReceiptController;
use App\Http\Controllers\Api\V1\PurchaseReturnController;
use App\Http\Controllers\Api\V1\RedirectController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\ReturnController;
use App\Http\Controllers\Api\V1\ReviewController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\SavedSectionController;
use App\Http\Controllers\Api\V1\SeoTemplateController;
use App\Http\Controllers\Api\V1\ShipmentController;
use App\Http\Controllers\Api\V1\StockAdjustmentController;
use App\Http\Controllers\Api\V1\StockAdjustmentSessionController;
use App\Http\Controllers\Api\V1\StockLevelController;
use App\Http\Controllers\Api\V1\StockMovementController;
use App\Http\Controllers\Api\V1\StockTransferController;
use App\Http\Controllers\Api\V1\StoreController;
use App\Http\Controllers\Api\V1\Storefront\AnalyticsController as StorefrontAnalyticsController;
use App\Http\Controllers\Api\V1\Storefront\BlogController as StorefrontBlogController;
use App\Http\Controllers\Api\V1\Storefront\BrandController as StorefrontBrandController;
use App\Http\Controllers\Api\V1\Storefront\CategoryController as StorefrontCategoryController;
use App\Http\Controllers\Api\V1\Storefront\CheckoutController as StorefrontCheckoutController;
use App\Http\Controllers\Api\V1\Storefront\DeliveryZoneController as StorefrontDeliveryZoneController;
use App\Http\Controllers\Api\V1\Storefront\HomepageController as StorefrontHomepageController;
use App\Http\Controllers\Api\V1\Storefront\NewsletterController as StorefrontNewsletterController;
use App\Http\Controllers\Api\V1\Storefront\PageController as StorefrontPageController;
use App\Http\Controllers\Api\V1\Storefront\SeoSettingController as StorefrontSeoSettingController;
use App\Http\Controllers\Api\V1\Storefront\ProductController as StorefrontProductController;
use App\Http\Controllers\Api\V1\Storefront\RedirectController as StorefrontRedirectController;
use App\Http\Controllers\Api\V1\Storefront\StoreController as StorefrontStoreController;
use App\Http\Controllers\Api\V1\SeoSettingController;
use App\Http\Controllers\Api\V1\SeoToolsController;
use App\Http\Controllers\Api\V1\StoreSeoController;
use App\Http\Controllers\Api\V1\SupplierController;
use App\Http\Controllers\Api\V1\SupplierPaymentController;
use App\Http\Controllers\Api\V1\TestimonialController;
use App\Http\Controllers\Api\V1\UploadController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\WarehouseController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::prefix('auth')->group(function () {
        Route::post('register', [AuthController::class, 'register'])->middleware('throttle:6,1');
        Route::post('login', [AuthController::class, 'login']);
        Route::post('forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:6,1');
        Route::post('reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:6,1');

        Route::middleware(['auth:sanctum', 'staff'])->group(function () {
            Route::post('logout', [AuthController::class, 'logout']);
            Route::get('me', [AuthController::class, 'me']);
        });
    });

    // Public, unauthenticated storefront API — no auth:sanctum. Wave 1
    // serves whichever single store is active (see StorefrontController);
    // real multi-tenant domain routing is a documented Wave 2 concern.
    Route::prefix('storefront')->group(function () {
        Route::get('store', [StorefrontStoreController::class, 'show']);
        Route::get('seo-settings', [StorefrontSeoSettingController::class, 'show']);
        Route::post('seo/not-found', [StorefrontSeoSettingController::class, 'notFound'])->middleware('throttle:600,1');
        Route::get('products', [StorefrontProductController::class, 'index']);
        Route::get('products/facets', [StorefrontProductController::class, 'facets']);
        Route::get('search/suggestions', [StorefrontProductController::class, 'suggestions'])->middleware('throttle:120,1');
        Route::get('products/{slug}/reviews', [StorefrontProductController::class, 'reviews']);
        Route::get('products/{slug}', [StorefrontProductController::class, 'show']);
        Route::get('categories', [StorefrontCategoryController::class, 'index']);
        Route::get('categories/{slug}', [StorefrontCategoryController::class, 'show']);
        Route::get('brands', [StorefrontBrandController::class, 'index']);
        Route::get('brands/{slug}', [StorefrontBrandController::class, 'show']);
        Route::get('pages', [StorefrontPageController::class, 'index']);
        Route::get('pages/{slug}', [StorefrontPageController::class, 'show']);
        Route::get('homepage-blocks', [StorefrontHomepageController::class, 'index']);
        Route::get('redirects/lookup', [StorefrontRedirectController::class, 'lookup']);

        // Registered before blog/{slug} — otherwise it would swallow "rss"
        // as a post slug first (same gotcha as products/export above).
        Route::get('blog/rss', [StorefrontBlogController::class, 'rss']);
        Route::get('blog/category/{slug}', [StorefrontBlogController::class, 'category']);
        Route::get('blog/tag/{slug}', [StorefrontBlogController::class, 'tag']);
        Route::get('blog', [StorefrontBlogController::class, 'index']);
        Route::get('blog/{slug}', [StorefrontBlogController::class, 'show']);
        Route::post('newsletter/subscribe', [StorefrontNewsletterController::class, 'subscribe'])->middleware('throttle:15,1');

        // Same controller the admin app uses under auth:sanctum below —
        // Bangladesh division/district/upazila names are nationwide
        // reference data, not store-scoped or sensitive, so a guest
        // checkout form needs the identical cascading picker without a
        // token. Nothing here reads the authenticated user.
        Route::prefix('locations')->group(function () {
            Route::get('divisions', [LocationController::class, 'divisions']);
            Route::get('districts', [LocationController::class, 'districts']);
            Route::get('upazilas', [LocationController::class, 'upazilas']);
        });

        Route::get('delivery-zones/quote', [StorefrontDeliveryZoneController::class, 'quote']);

        // Throttled like the other unauthenticated write endpoints
        // (auth/register, auth/login) — this creates a real order and
        // reserves real stock, so it needs the same abuse guard.
        Route::post('checkout', [StorefrontCheckoutController::class, 'store'])->middleware('throttle:15,1');
        Route::get('orders/{uuid}', [StorefrontCheckoutController::class, 'show']);

        // A real browsing session fires many more of these than a checkout
        // (page views, product views, searches) — a higher, still-bounded
        // ceiling than checkout/newsletter's throttle:15,1.
        Route::post('analytics/events', [StorefrontAnalyticsController::class, 'track'])->middleware('throttle:120,1');
    });

    // Customer account (Phase 17 Wave 1) — a customer's own Sanctum
    // tokens, a completely separate space from staff's (see
    // EnsureCustomerUser/EnsureStaffUser). register/login are public like
    // auth/register|login above; everything else requires a customer
    // token specifically, not just any valid one.
    Route::prefix('account')->group(function () {
        Route::post('auth/register', [AccountAuthController::class, 'register'])->middleware('throttle:6,1');
        Route::post('auth/login', [AccountAuthController::class, 'login'])->middleware('throttle:6,1');

        Route::middleware(['auth:sanctum', 'customer'])->group(function () {
            Route::post('auth/logout', [AccountAuthController::class, 'logout']);
            Route::get('auth/me', [AccountAuthController::class, 'me']);

            Route::get('orders', [AccountOrderController::class, 'index']);
            Route::get('orders/{uuid}', [AccountOrderController::class, 'show']);

            Route::get('addresses', [AccountAddressController::class, 'index']);
            Route::post('addresses', [AccountAddressController::class, 'store']);
            Route::put('addresses/{address}', [AccountAddressController::class, 'update']);
            Route::delete('addresses/{address}', [AccountAddressController::class, 'destroy']);

            Route::put('profile', [AccountProfileController::class, 'update']);

            Route::get('reviews', [AccountReviewController::class, 'index']);
            Route::post('reviews', [AccountReviewController::class, 'store']);
        });
    });

    Route::middleware(['auth:sanctum', 'staff'])->group(function () {
        Route::apiResource('stores', StoreController::class);
        Route::apiResource('warehouses', WarehouseController::class);
        Route::apiResource('users', UserController::class);

        Route::get('currencies', [CurrencyController::class, 'index']);

        // Always the current staff user's own inbox — no permission to
        // gate beyond being authenticated, same reasoning as auth/me.
        Route::get('notification-settings', [NotificationSettingController::class, 'show']);
        Route::put('notification-settings', [NotificationSettingController::class, 'update']);
        Route::get('notification-settings/sms-balance', [NotificationSettingController::class, 'smsBalance']);
        Route::post('notification-settings/test-sms', [NotificationSettingController::class, 'testSms'])->middleware('throttle:10,1');
        Route::post('notification-settings/test-email', [NotificationSettingController::class, 'testEmail'])->middleware('throttle:10,1');
        Route::get('notification-logs', [NotificationSettingController::class, 'logs']);
        Route::get('notifications', [NotificationController::class, 'index']);
        Route::post('notifications/read-all', [NotificationController::class, 'markAllRead']);
        Route::post('notifications/{id}/read', [NotificationController::class, 'markRead']);

        Route::get('roles', [RoleController::class, 'index']);
        Route::get('permissions', [RoleController::class, 'permissions']);
        Route::post('roles', [RoleController::class, 'store']);
        Route::put('roles/{role}', [RoleController::class, 'update']);
        Route::delete('roles/{role}', [RoleController::class, 'destroy']);

        Route::prefix('locations')->group(function () {
            Route::get('divisions', [LocationController::class, 'divisions']);
            Route::get('districts', [LocationController::class, 'districts']);
            Route::get('upazilas', [LocationController::class, 'upazilas']);
        });

        Route::post('uploads', [UploadController::class, 'store']);

        Route::apiResource('media', MediaController::class)->only(['index', 'store', 'update', 'destroy']);

        Route::apiResource('categories', CategoryController::class);
        Route::apiResource('brands', BrandController::class);
        Route::apiResource('pages', PageController::class);
        Route::apiResource('redirects', RedirectController::class);
        Route::apiResource('seo-templates', SeoTemplateController::class);
        Route::get('store-seo', [StoreSeoController::class, 'show']);
        Route::put('store-seo', [StoreSeoController::class, 'update']);
        // Technical SEO: robots.txt, sitemap, schema, verification, analytics, homepage + blog meta.
        Route::get('seo/settings', [SeoSettingController::class, 'show']);
        Route::put('seo/settings', [SeoSettingController::class, 'update']);
        Route::get('seo/audit', [SeoSettingController::class, 'audit']);
        Route::post('seo/generate', [SeoSettingController::class, 'generate']);
        Route::post('seo/analyze', [SeoToolsController::class, 'analyze'])->middleware('throttle:240,1');
        Route::post('seo/rescore', [SeoToolsController::class, 'rescore']);
        Route::get('seo/404', [SeoToolsController::class, 'notFoundIndex']);
        Route::delete('seo/404', [SeoToolsController::class, 'notFoundClear']);
        Route::delete('seo/404/{log}', [SeoToolsController::class, 'notFoundDestroy']);
        Route::post('seo/indexnow/key', [SeoToolsController::class, 'indexNowKey']);
        Route::post('seo/indexnow/submit', [SeoToolsController::class, 'indexNowSubmit']);

        // Registered before the apiResource — otherwise its GET
        // homepage-blocks/{homepage_block} route would swallow "preview"
        // as a route-key first (same gotcha as products/export above).
        Route::get('homepage-blocks/preview', [HomepageBlockController::class, 'preview']);
        Route::apiResource('homepage-blocks', HomepageBlockController::class);
        Route::post('homepage-blocks/reorder', [HomepageBlockController::class, 'reorder']);
        Route::post('homepage-blocks/{homepageBlock}/duplicate', [HomepageBlockController::class, 'duplicate']);
        Route::post('homepage-blocks/{homepageBlock}/publish', [HomepageBlockController::class, 'publish']);
        Route::post('homepage-blocks/{homepageBlock}/unpublish', [HomepageBlockController::class, 'unpublish']);
        Route::post('homepage-blocks/{homepageBlock}/schedule', [HomepageBlockController::class, 'schedule']);
        Route::get('homepage-blocks/{homepageBlock}/revisions', [HomepageBlockController::class, 'revisions']);
        Route::post('homepage-blocks/{homepageBlock}/revisions/{revision}/restore', [HomepageBlockController::class, 'restore']);
        Route::post('homepage-blocks/{homepageBlock}/save-as-section', [HomepageBlockController::class, 'saveAsSection']);

        Route::apiResource('saved-sections', SavedSectionController::class)->only(['index', 'store', 'destroy']);
        Route::post('saved-sections/{savedSection}/insert', [SavedSectionController::class, 'insert']);

        Route::apiResource('testimonials', TestimonialController::class);
        Route::apiResource('blog-categories', BlogCategoryController::class);
        Route::apiResource('blog-tags', BlogTagController::class);
        Route::apiResource('blog-posts', BlogPostController::class);
        Route::get('blog-posts/{blogPost}/versions', [BlogPostController::class, 'versions']);
        Route::post('blog-posts/{blogPost}/versions/{version}/restore', [BlogPostController::class, 'restoreVersion']);
        Route::get('newsletter-subscribers', [NewsletterSubscriberController::class, 'index']);
        Route::delete('newsletter-subscribers/{newsletterSubscriber}', [NewsletterSubscriberController::class, 'destroy']);

        Route::get('reviews', [ReviewController::class, 'index']);
        Route::get('reviews/{review}', [ReviewController::class, 'show']);
        Route::post('reviews/{review}/approve', [ReviewController::class, 'approve']);
        Route::post('reviews/{review}/reject', [ReviewController::class, 'reject']);
        Route::delete('reviews/{review}', [ReviewController::class, 'destroy']);

        // Registered before the products apiResource — otherwise its
        // GET products/{product} route would swallow "export" as a
        // product route-key first.
        Route::get('products/export', [ProductController::class, 'export']);
        Route::get('products/next-sku', [ProductController::class, 'nextSku']);
        Route::post('products/import', [ProductImportController::class, 'store']);
        Route::apiResource('products', ProductController::class);

        Route::post('products/{product}/images', [ProductImageController::class, 'store']);
        Route::post('products/{product}/images/attach', [ProductImageController::class, 'attach']);
        Route::delete('products/{product}/images/{image}', [ProductImageController::class, 'destroy']);
        Route::post('products/{product}/images/{image}/primary', [ProductImageController::class, 'markPrimary']);

        Route::apiResource('product-attributes', ProductAttributeController::class);
        Route::post('product-attributes/{productAttribute}/values', [ProductAttributeController::class, 'storeValue']);
        Route::put('product-attributes/{productAttribute}/values/{value}', [ProductAttributeController::class, 'updateValue']);
        Route::delete('product-attributes/{productAttribute}/values/{value}', [ProductAttributeController::class, 'destroyValue']);

        Route::post('products/{product}/variants/generate', [ProductVariantController::class, 'generate']);
        Route::put('products/{product}/variants/{variant}', [ProductVariantController::class, 'update']);
        Route::delete('products/{product}/variants/{variant}', [ProductVariantController::class, 'destroy']);

        Route::post('products/{product}/components', [ProductComponentController::class, 'store']);
        Route::put('products/{product}/components/{component}', [ProductComponentController::class, 'update']);
        Route::delete('products/{product}/components/{component}', [ProductComponentController::class, 'destroy']);

        Route::get('stock-levels', [StockLevelController::class, 'index']);
        Route::get('stock-levels/low-stock-count', [StockLevelController::class, 'lowStockCount']);
        Route::get('stock-movements', [StockMovementController::class, 'index']);
        Route::post('stock-adjustments', [StockAdjustmentController::class, 'store']);
        Route::get('stock-transfers', [StockTransferController::class, 'index']);
        Route::post('stock-transfers', [StockTransferController::class, 'store']);
        Route::get('stock-transfers/{stockTransfer}', [StockTransferController::class, 'show']);
        Route::post('stock-transfers/{stockTransfer}/ship', [StockTransferController::class, 'ship']);
        Route::post('stock-transfers/{stockTransfer}/receive', [StockTransferController::class, 'receive']);
        Route::post('stock-transfers/{stockTransfer}/cancel', [StockTransferController::class, 'cancel']);

        Route::get('stock-adjustment-sessions', [StockAdjustmentSessionController::class, 'index']);
        Route::post('stock-adjustment-sessions', [StockAdjustmentSessionController::class, 'store']);
        Route::get('stock-adjustment-sessions/{stockAdjustmentSession}', [StockAdjustmentSessionController::class, 'show']);

        Route::apiResource('suppliers', SupplierController::class);
        Route::get('suppliers/{supplier}/ledger', [SupplierPaymentController::class, 'ledger']);
        Route::post('suppliers/{supplier}/payments', [SupplierPaymentController::class, 'store']);

        Route::apiResource('purchase-orders', PurchaseOrderController::class);
        Route::post('purchase-orders/{purchaseOrder}/submit-for-approval', [PurchaseOrderController::class, 'submitForApproval']);
        Route::post('purchase-orders/{purchaseOrder}/approve', [PurchaseOrderController::class, 'approve']);
        Route::post('purchase-orders/{purchaseOrder}/reject', [PurchaseOrderController::class, 'reject']);
        Route::post('purchase-orders/{purchaseOrder}/cancel', [PurchaseOrderController::class, 'cancel']);
        Route::post('purchase-orders/{purchaseOrder}/receipts', [PurchaseReceiptController::class, 'store']);
        Route::post('purchase-orders/{purchaseOrder}/returns', [PurchaseReturnController::class, 'store']);
        Route::get('purchase-returns', [PurchaseReturnController::class, 'index']);
        Route::get('purchase-returns/{purchaseReturn}', [PurchaseReturnController::class, 'show']);
        Route::post('purchase-returns/{purchaseReturn}/approve', [PurchaseReturnController::class, 'approve']);
        Route::post('purchase-returns/{purchaseReturn}/reject', [PurchaseReturnController::class, 'reject']);
        Route::post('purchase-returns/{purchaseReturn}/ship-back', [PurchaseReturnController::class, 'shipBack']);
        Route::post('purchase-returns/{purchaseReturn}/credit', [PurchaseReturnController::class, 'credit']);

        Route::apiResource('customers', CustomerController::class);
        Route::post('customers/{customer}/addresses', [CustomerAddressController::class, 'store']);
        Route::put('customers/{customer}/addresses/{address}', [CustomerAddressController::class, 'update']);
        Route::delete('customers/{customer}/addresses/{address}', [CustomerAddressController::class, 'destroy']);
        Route::get('customers/{customer}/store-credits', [CustomerStoreCreditController::class, 'index']);

        Route::apiResource('orders', OrderController::class)->except(['destroy']);
        Route::post('orders/{order}/process', [OrderController::class, 'process']);
        Route::post('orders/{order}/ship', [OrderController::class, 'ship']);
        Route::post('orders/{order}/deliver', [OrderController::class, 'deliver']);
        Route::post('orders/{order}/cancel', [OrderController::class, 'cancel']);
        Route::post('orders/{order}/payments', [OrderPaymentController::class, 'store']);

        Route::apiResource('coupons', CouponController::class);

        Route::post('couriers/{courier}/test-connection', [CourierController::class, 'testConnection']);
        Route::apiResource('couriers', CourierController::class);

        Route::post('orders/{order}/shipments', [ShipmentController::class, 'store']);
        Route::post('orders/{order}/send-to-courier', [ShipmentController::class, 'sendToCourier']);
        Route::post('shipments/{shipment}/sync-courier', [ShipmentController::class, 'syncCourier']);
        Route::get('shipments', [ShipmentController::class, 'index']);
        Route::get('shipments/{shipment}', [ShipmentController::class, 'show']);
        Route::post('shipments/{shipment}/picked-up', [ShipmentController::class, 'pickedUp']);
        Route::post('shipments/{shipment}/in-transit', [ShipmentController::class, 'inTransit']);
        Route::post('shipments/{shipment}/delivered', [ShipmentController::class, 'delivered']);
        Route::post('shipments/{shipment}/failed', [ShipmentController::class, 'failed']);
        Route::post('shipments/{shipment}/returned', [ShipmentController::class, 'returned']);

        Route::get('cod-settlements', [CodSettlementController::class, 'index']);
        Route::post('cod-settlements', [CodSettlementController::class, 'store']);
        Route::get('cod-settlements/{codSettlement}', [CodSettlementController::class, 'show']);

        Route::get('delivery-zones/quote', [DeliveryZoneController::class, 'quote']);
        Route::apiResource('delivery-zones', DeliveryZoneController::class);

        Route::post('orders/{order}/returns', [ReturnController::class, 'store']);
        Route::get('returns', [ReturnController::class, 'index']);
        Route::get('returns/{orderReturn}', [ReturnController::class, 'show']);
        Route::post('returns/{orderReturn}/approve', [ReturnController::class, 'approve']);
        Route::post('returns/{orderReturn}/reject', [ReturnController::class, 'reject']);
        Route::post('returns/{orderReturn}/receive', [ReturnController::class, 'receive']);
        Route::post('returns/{orderReturn}/refund', [ReturnController::class, 'refund']);

        Route::get('dashboard/sales-trend', [DashboardController::class, 'salesTrend']);
        Route::get('dashboard/insights', [DashboardController::class, 'insights']);
        Route::get('dashboard/order-status-breakdown', [DashboardController::class, 'orderStatusBreakdown']);

        Route::get('reports/sales', [ReportController::class, 'salesReport']);
        Route::get('reports/sales/export', [ReportController::class, 'salesReportExport']);
        Route::get('reports/sales/export-pdf', [ReportController::class, 'salesReportExportPdf']);
        Route::get('reports/products-performance', [ReportController::class, 'productPerformance']);
        Route::get('reports/products-performance/export', [ReportController::class, 'productPerformanceExport']);
        Route::get('reports/products-performance/export-pdf', [ReportController::class, 'productPerformanceExportPdf']);
        Route::get('reports/low-stock', [ReportController::class, 'lowStock']);
        Route::get('reports/low-stock/export', [ReportController::class, 'lowStockExport']);
        Route::get('reports/low-stock/export-pdf', [ReportController::class, 'lowStockExportPdf']);
        Route::get('reports/reorder-suggestions', [ReportController::class, 'reorderSuggestions']);
        Route::get('reports/reorder-suggestions/export', [ReportController::class, 'reorderSuggestionsExport']);
        Route::get('reports/reorder-suggestions/export-pdf', [ReportController::class, 'reorderSuggestionsExportPdf']);

        Route::get('analytics/overview', [AnalyticsController::class, 'overview']);
        Route::get('analytics/overview/export', [AnalyticsController::class, 'overviewExport']);
        Route::get('analytics/overview/export-pdf', [AnalyticsController::class, 'overviewExportPdf']);
        Route::get('analytics/products', [AnalyticsController::class, 'products']);
        Route::get('analytics/products/export', [AnalyticsController::class, 'productsExport']);
        Route::get('analytics/searches', [AnalyticsController::class, 'searches']);
        Route::get('analytics/searches/export', [AnalyticsController::class, 'searchesExport']);
        Route::get('analytics/funnel', [AnalyticsController::class, 'funnel']);
        Route::get('analytics/customers', [AnalyticsController::class, 'customers']);
        Route::get('analytics/customers/export', [AnalyticsController::class, 'customersExport']);
    });
});
