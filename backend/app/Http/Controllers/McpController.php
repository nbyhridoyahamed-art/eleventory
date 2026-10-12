<?php

namespace App\Http\Controllers;

use App\Mcp\ApiBridge;
use App\Mcp\McpToolException;
use App\Mcp\McpTools;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Laravel\Sanctum\PersonalAccessToken;
use Throwable;

/**
 * Remote MCP endpoint (Streamable HTTP, stateless JSON responses) so Claude's
 * "Add custom connector" - and any other remote-MCP client - can manage the
 * store. The connection token is carried in the URL (/mcp/{token}) because
 * Claude's connector form has no field for a bearer token; it can also be sent
 * as an Authorization header to /mcp. Only tokens created on the dashboard's
 * AI Assistant page (named "mcp:...") are accepted here.
 */
class McpController extends Controller
{
    private const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];

    private const MAX_TEXT = 24000;

    public function __invoke(Request $request, ?string $token = null): JsonResponse|Response
    {
        $plain = $token ?? $request->bearerToken();

        // Connector URLs carry the token as "<id>-<secret>" (no pipe, which some clients mangle).
        if ($plain && preg_match('/^([0-9]+)-([A-Za-z0-9]+)$/', $plain, $m)) {
            $plain = $m[1].'|'.$m[2];
        }

        $access = $plain ? PersonalAccessToken::findToken($plain) : null;
        $user = $access?->tokenable;

        if (! $access || ! str_starts_with((string) $access->name, 'mcp:') || ! $user instanceof User || $user->status !== 'active') {
            return response()->json(['error' => 'Unauthorized: use the connector URL from Dashboard → AI Assistant.'], 401);
        }

        $payload = json_decode((string) $request->getContent(), true);

        if (! is_array($payload)) {
            return $this->error(null, -32700, 'Parse error');
        }

        $isBatch = array_is_list($payload);
        $messages = $isBatch ? $payload : [$payload];
        $api = new ApiBridge((string) $plain, $user->current_store_id ? (int) $user->current_store_id : null);
        $readOnly = ! $access->can('write');

        $responses = [];

        foreach ($messages as $message) {
            if (! is_array($message)) {
                $responses[] = $this->errorBody(null, -32600, 'Invalid Request');

                continue;
            }

            $result = $this->handle($message, $api, $user, $readOnly);

            if ($result !== null) {
                $responses[] = $result;
            }
        }

        // Notifications only: acknowledge with no body, as the spec requires.
        if ($responses === []) {
            return response('', 202);
        }

        return response()->json($isBatch ? $responses : $responses[0]);
    }

    /** Anything other than POST: this server offers no SSE stream and no sessions. */
    public function unsupported(): Response
    {
        return response('', 405, ['Allow' => 'POST']);
    }

    /** @param array<string, mixed> $message */
    private function handle(array $message, ApiBridge $api, User $user, bool $readOnly): ?array
    {
        $id = $message['id'] ?? null;
        $method = (string) ($message['method'] ?? '');
        $params = is_array($message['params'] ?? null) ? $message['params'] : [];
        $isNotification = ! array_key_exists('id', $message);

        if ($isNotification) {
            return null; // notifications/initialized, notifications/cancelled, ...
        }

        try {
            return match ($method) {
                'initialize' => $this->ok($id, $this->initialize($params, $readOnly)),
                'ping' => $this->ok($id, (object) []),
                'tools/list' => $this->ok($id, ['tools' => $this->listTools($readOnly)]),
                'tools/call' => $this->ok($id, $this->callTool($params, $api, $user, $readOnly)),
                default => $this->errorBody($id, -32601, "Method not found: {$method}"),
            };
        } catch (Throwable $e) {
            report($e);

            return $this->errorBody($id, -32603, 'Internal error');
        }
    }

    /** @param array<string, mixed> $params */
    private function initialize(array $params, bool $readOnly): array
    {
        $requested = (string) ($params['protocolVersion'] ?? '');
        $site = parse_url((string) config('app.frontend_url'), PHP_URL_HOST) ?: 'this store';

        return [
            'protocolVersion' => in_array($requested, self::PROTOCOLS, true) ? $requested : self::PROTOCOLS[0],
            'capabilities' => ['tools' => ['listChanged' => false]],
            'serverInfo' => ['name' => 'eleventory', 'version' => '1.0.0'],
            'instructions' => implode("\n", [
                "This server manages the online store {$site}, which runs on the Eleventory ecommerce platform.",
                "Whenever the user mentions {$site}, Eleventory, or asks about products, stock, orders, customers, sales, analytics, delivery or SEO for the store, use these tools.",
                'Start with store_overview to see who you are connected as and the headline numbers.',
                $readOnly
                    ? 'This connection is read-only: you can look things up and report, but not change anything.'
                    : 'Changes are made as the signed-in staff user; confirm destructive or large changes with the user first.',
            ]),
        ];
    }

    /** @return array<int, array<string, mixed>> */
    private function listTools(bool $readOnly): array
    {
        return collect(McpTools::all())
            ->reject(fn ($t) => $readOnly && $t['write'])
            ->map(fn ($t) => [
                'name' => $t['name'],
                'description' => $t['description'],
                'inputSchema' => $t['inputSchema'],
                'annotations' => [
                    'readOnlyHint' => ! $t['write'],
                    'destructiveHint' => $t['destructive'],
                    'openWorldHint' => false,
                ],
            ])->values()->all();
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array{content: array<int, array{type: string, text: string}>, isError?: bool}
     */
    private function callTool(array $params, ApiBridge $api, User $user, bool $readOnly): array
    {
        $name = (string) ($params['name'] ?? '');
        $args = is_array($params['arguments'] ?? null) ? $params['arguments'] : [];
        $tool = collect(McpTools::all())->firstWhere('name', $name);

        if (! $tool) {
            return $this->toolError("Unknown tool: {$name}");
        }

        if ($readOnly && $tool['write']) {
            return $this->toolError('This connection is read-only.');
        }

        try {
            return $this->toolResult(($tool['handler'])($args, $api, $user));
        } catch (McpToolException $e) {
            return $this->toolError($e->getMessage(), $e->status, $e->errors);
        } catch (Throwable $e) {
            report($e);

            return $this->toolError('The request could not be completed: '.$e->getMessage());
        }
    }

    private function toolResult(mixed $value): array
    {
        $text = json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR) ?: 'null';

        if (mb_strlen($text) > self::MAX_TEXT) {
            $text = mb_substr($text, 0, self::MAX_TEXT)."\n… output truncated. Narrow the request or use page/per_page.";
        }

        return ['content' => [['type' => 'text', 'text' => $text]]];
    }

    /** @param array<string, mixed>|null $validation */
    private function toolError(string $message, ?int $status = null, ?array $validation = null): array
    {
        $body = array_filter(['error' => $message, 'status' => $status, 'validation' => $validation], fn ($v) => $v !== null);

        return $this->toolResult($body) + ['isError' => true];
    }

    private function ok(mixed $id, mixed $result): array
    {
        return ['jsonrpc' => '2.0', 'id' => $id, 'result' => $result];
    }

    private function errorBody(mixed $id, int $code, string $message): array
    {
        return ['jsonrpc' => '2.0', 'id' => $id, 'error' => ['code' => $code, 'message' => $message]];
    }

    private function error(mixed $id, int $code, string $message): JsonResponse
    {
        return response()->json($this->errorBody($id, $code, $message));
    }
}
