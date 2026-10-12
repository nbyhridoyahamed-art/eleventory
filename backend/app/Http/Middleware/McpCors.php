<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Remote MCP clients can be browser-based (Claude's connector check and
 * claude.ai run from a page), so the endpoint must answer CORS preflights.
 * Access is controlled by the token in the URL/header, never by cookies, so
 * any origin may call it.
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
        $response = $request->isMethod('OPTIONS') ? response('', 204) : $next($request);

        foreach (self::HEADERS as $name => $value) {
            $response->headers->set($name, $value);
        }

        return $response;
    }
}
