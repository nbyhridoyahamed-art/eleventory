<?php

namespace App\Mcp;

use Illuminate\Contracts\Http\Kernel as HttpKernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Facade;
use RuntimeException;

/**
 * Calls the store's own admin API in-process, carrying the MCP token, so every
 * tool goes through exactly the same middleware, policies, validation and
 * business rules as the admin dashboard - including read-only enforcement.
 */
class ApiBridge
{
    public function __construct(private readonly string $plainToken, public readonly ?int $storeId) {}

    /**
     * @param  array<string, mixed>  $query
     * @param  array<string, mixed>|null  $body
     * @return array{data: mixed, meta: mixed}
     */
    public function call(string $method, string $path, array $query = [], ?array $body = null): array
    {
        $query = array_filter($query, fn ($v) => $v !== null && $v !== '');
        $uri = '/api/v1'.$path.($query ? '?'.http_build_query($query) : '');

        $request = Request::create(
            $uri,
            $method,
            [],
            [],
            [],
            [
                'HTTP_ACCEPT' => 'application/json',
                'CONTENT_TYPE' => 'application/json',
                'HTTP_AUTHORIZATION' => 'Bearer '.$this->plainToken,
            ],
            $body !== null ? json_encode($body) : null,
        );

        $outer = app('request');
        Auth::forgetGuards();

        try {
            $response = app(HttpKernel::class)->handle($request);
        } finally {
            app()->instance('request', $outer);
            Facade::clearResolvedInstance('request');
            Auth::forgetGuards();
        }

        $json = json_decode((string) $response->getContent(), true);
        $status = $response->getStatusCode();

        if ($status >= 400 || ! is_array($json) || ($json['success'] ?? true) === false) {
            $message = is_array($json) ? ($json['message'] ?? null) : null;
            $errors = is_array($json) ? ($json['errors'] ?? null) : null;

            throw new McpToolException(
                $message ?: "Request failed with HTTP {$status}.",
                $status,
                is_array($errors) ? $errors : null,
            );
        }

        return ['data' => $json['data'] ?? null, 'meta' => $json['meta'] ?? null];
    }

    /** @param array<string, mixed> $query */
    public function get(string $path, array $query = []): mixed
    {
        return $this->call('GET', $path, $query)['data'];
    }

    /** @param array<string, mixed> $body */
    public function post(string $path, array $body = [], array $query = []): mixed
    {
        return $this->call('POST', $path, $query, $body)['data'];
    }

    /** @param array<string, mixed> $body */
    public function put(string $path, array $body = []): mixed
    {
        return $this->call('PUT', $path, [], $body)['data'];
    }

    public function delete(string $path, array $query = []): mixed
    {
        return $this->call('DELETE', $path, $query)['data'];
    }

    /** Query params almost every list/report endpoint needs. */
    public function scoped(array $extra = []): array
    {
        if ($this->storeId === null) {
            throw new RuntimeException('This user has no current store.');
        }

        return ['store_id' => $this->storeId] + $extra;
    }

    /**
     * List endpoints: items plus pagination in one object.
     *
     * @param  array<string, mixed>  $query
     * @return array{items: mixed, pagination: mixed}
     */
    public function listing(string $path, array $query = []): array
    {
        $result = $this->call('GET', $path, $this->scoped($query));

        return ['items' => $result['data'], 'pagination' => $result['meta']];
    }
}
