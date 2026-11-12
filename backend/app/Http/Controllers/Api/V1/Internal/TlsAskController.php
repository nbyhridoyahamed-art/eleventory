<?php

namespace App\Http\Controllers\Api\V1\Internal;

use App\Http\Controllers\Controller;
use App\Services\Tenancy\StoreResolver;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Caddy's on-demand TLS "ask" endpoint. Before obtaining a certificate for a
 * hostname the web server asks here; 200 means "yes, that is one of ours".
 *
 * Without this check anyone could point any domain at the server and make it
 * request certificates until Let's Encrypt rate limits are exhausted. Guarded by
 * a shared secret; with no secret configured it refuses everything.
 *
 *   on_demand_tls { ask http://127.0.0.1:8000/api/v1/internal/tls-ask?secret=... }
 */
class TlsAskController extends Controller
{
    public function __invoke(Request $request, StoreResolver $resolver): Response
    {
        $secret = (string) config('tenancy.tls_ask_secret');
        $given = (string) ($request->header('X-Tls-Secret') ?: $request->query('secret'));

        if ($secret === '' || ! hash_equals($secret, $given)) {
            return response('', 404);
        }

        $store = $resolver->forHost((string) $request->query('domain'));

        return response('', $store && $store->status === 'active' ? 200 : 404);
    }
}
