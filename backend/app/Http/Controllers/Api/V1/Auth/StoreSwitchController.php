<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Resources\StoreResource;
use App\Models\Store;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The stores switcher: which shops this person can open, and moving between them. */
class StoreSwitchController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $stores = $user->hasRole('Platform Admin')
            ? Store::query()->orderBy('name')->limit(200)->get()
            : $user->stores()->wherePivot('status', 'active')->orderBy('stores.name')->get();

        return ApiResponse::success([
            'current_store_id' => $user->current_store_id,
            'stores' => StoreResource::collection($stores),
            // True when the current shop is not one this person belongs to (a platform admin helping out).
            'support_mode' => $user->current_store_id && $user->hasRole('Platform Admin')
                && ! $user->stores()->where('stores.id', $user->current_store_id)->exists(),
        ], 'Your stores fetched successfully.');
    }

    public function switch(Request $request): JsonResponse
    {
        $storeId = (int) $request->validate(['store_id' => ['required', 'integer']])['store_id'];

        // Same answer for "no such store" and "not yours", so ids cannot be probed.
        if (! $request->user()->canAccessStore($storeId)) {
            return ApiResponse::error('You do not have access to this store.', [], 403);
        }

        $user = $request->user();

        // A platform admin stepping into a shop they are not a member of is support access: leave a trace.
        if ($user->hasRole('Platform Admin') && ! $user->stores()->where('stores.id', $storeId)->exists()) {
            \App\Models\PlatformAuditLog::record($user, 'tenant.enter', $storeId);
        }

        $user->forceFill(['current_store_id' => $storeId])->save();

        return ApiResponse::success(['current_store_id' => $storeId], 'Store switched.');
    }
}
