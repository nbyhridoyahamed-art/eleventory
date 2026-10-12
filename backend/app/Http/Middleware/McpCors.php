<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Remote MCP clients can be browser-based (Claude's connector check and
 * claude.ai run from a page), so the endpoint must answer CORS preflights.
 * Access is controlled by the token in the URL/header, never by cookies, so
 * any origin may call it.
 *
 * Also writes one diagnostic line per request (never the token or body) so a
 * client that cannot connect can be debugged from storage/logs.
 */
class McpCors
{
    private const HEADERS = [
        'Access-Control-Allow-Origin' => '*',
        'Access-Control-Allow-Methods' => 'POST, GET, DELETE, OPTIONS',
        'Access-Control-Allow-Headers' => 'Content-Type, Authorization, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID',
        'Access-Control-Expose-Headers' => 'Mcp-Session-Id, Mcp-Protocol-Version',
        'Access-Control-Max-Age' => '86400',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $started = microtime(true);
        $response = $request->isMethod('OPTIONS') ? response('', 204) : $next($request);

        foreach (self::HEADERS as $name => $value) {
            $response->headers->set($name, $value);
        }

        $this->log($request, $response, $started);

        return $response;
    }

    private function log(Request $request, Response $response, float $started): void
    {
        try {
            $body = json_decode((string) $request->getContent(), true);
            $rpc = is_array($body)
                ? (array_is_list($body) ? array_map(fn ($m) => $m['method'] ?? '?', $body) : ($body['method'] ?? '?'))
                : null;

            Log::channel('daily')->info('mcp request', [
                'http' => $request->method(),
                'path' => preg_replace('#^(/?mcp/)[^/?]+#', '${1}{token}', $request->getPathInfo()),
                'status' => $response->getStatusCode(),
                'rpc' => $rpc,
                'ua' => mb_substr((string) $request->userAgent(), 0, 120),
                'accept' => mb_substr((string) $request->header('Accept'), 0, 80),
                'ctype' => $request->header('Content-Type'),
                'origin' => $request->header('Origin'),
                'ip' => $request->ip(),
                'ms' => (int) ((microtime(true) - $started) * 1000),
            ]);
        } catch (Throwable) {
            // Diagnostics must never break the endpoint.
        }
    }
}
