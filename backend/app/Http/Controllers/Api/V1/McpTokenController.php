<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Connection tokens for AI assistants that use the Eleventory MCP server.
 * Each token acts as the staff user who created it, so that user's roles
 * apply; a "read only" token additionally refuses every write request
 * (see EnsureStaffUser). The plain token is shown exactly once.
 */
class McpTokenController extends Controller
{
    private const PREFIX = 'mcp:';

    public function index(Request $request): JsonResponse
    {
        $this->authorizeManage($request);

        $tokens = $request->user()->tokens()
            ->where('name', 'like', self::PREFIX.'%')
            ->orderByDesc('id')
            ->get()
            ->map(fn (PersonalAccessToken $token) => $this->present($token));

        return ApiResponse::success($tokens->values()->all(), 'Connection tokens fetched successfully.');
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeManage($request);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:60'],
            'mode' => ['required', Rule::in(['read_only', 'full'])],
        ]);

        $token = $request->user()->createToken(
            self::PREFIX.$data['name'],
            $data['mode'] === 'read_only' ? ['read'] : ['*'],
        );

        return ApiResponse::success([
            'token' => $token->plainTextToken,
            'connection' => $this->present($token->accessToken),
        ], 'Connection token created. Copy it now — it will not be shown again.', status: 201);
    }

    public function destroy(Request $request, int $token): JsonResponse
    {
        $this->authorizeManage($request);

        $deleted = $request->user()->tokens()
            ->where('name', 'like', self::PREFIX.'%')
            ->whereKey($token)
            ->delete();

        abort_unless($deleted > 0, 404);

        return ApiResponse::success(message: 'Connection revoked. Anything using that token has lost access.');
    }

    private function authorizeManage(Request $request): void
    {
        if (! $request->user()->can('settings.manage')) {
            throw new AuthorizationException;
        }
    }

    /** @return array<string, mixed> */
    private function present(PersonalAccessToken $token): array
    {
        return [
            'id' => $token->id,
            'name' => substr($token->name, strlen(self::PREFIX)),
            'mode' => in_array('*', $token->abilities ?? [], true) ? 'full' : 'read_only',
            'last_used_at' => $token->last_used_at,
            'created_at' => $token->created_at,
        ];
    }
}
