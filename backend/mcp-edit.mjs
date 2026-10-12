import fs from "fs";
function edit(file, pairs) {
  let s = fs.readFileSync(file, "utf8"); const crlf = s.includes("\r\n"); s = s.replace(/\r\n/g, "\n");
  for (const [a, b] of pairs) { if (!s.includes(a)) throw new Error(file + " missing: " + a.slice(0, 60)); s = s.replace(a, b); }
  fs.writeFileSync(file, crlf ? s.replace(/\n/g, "\r\n") : s);
}
edit("app/Http/Middleware/EnsureStaffUser.php", [[
  "        return $next($request);\n    }",
  `        // A token issued for read-only use (e.g. an AI assistant in view-only
        // mode) may look but never change anything.
        $token = $request->user()->currentAccessToken();

        if ($token && method_exists($token, 'can') && ! $token->can('write') && ! in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'], true)) {
            return ApiResponse::error('This connection is read-only.', [], 403);
        }

        return $next($request);
    }`,
]]);
edit("routes/api.php", [
  ["use App\Http\Controllers\Api\V1\NotificationSettingController;", "use App\Http\Controllers\Api\V1\McpTokenController;\nuse App\Http\Controllers\Api\V1\NotificationSettingController;"],
  ["        Route::get('notification-settings', [NotificationSettingController::class, 'show']);", "        Route::get('mcp/tokens', [McpTokenController::class, 'index']);\n        Route::post('mcp/tokens', [McpTokenController::class, 'store']);\n        Route::delete('mcp/tokens/{token}', [McpTokenController::class, 'destroy']);\n        Route::get('notification-settings', [NotificationSettingController::class, 'show']);"],
]);
