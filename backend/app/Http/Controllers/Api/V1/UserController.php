<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\User\UserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', User::class);

        $perPage = min((int) $request->integer('per_page', 20), 100);

        $users = User::query()
            ->with('roles')
            ->when($request->filled('search'), fn ($query) => $query->where('name', 'like', '%'.$request->string('search').'%'))
            ->latest()
            ->paginate($perPage);

        return ApiResponse::success(
            UserResource::collection($users),
            'Users fetched successfully.',
            [
                'current_page' => $users->currentPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
                'last_page' => $users->lastPage(),
            ],
        );
    }

    public function store(UserRequest $request): JsonResponse
    {
        $this->authorize('create', User::class);

        $data = $request->validated();
        // Set explicitly rather than leaning on the migration's column
        // default: create() returns the in-memory model, not a fresh
        // SELECT, so a field left for the DB default would come back
        // null in this response even though the row has the real value.
        $data['status'] ??= 'active';
        $data['locale'] ??= 'en';
        $data['timezone'] ??= 'Asia/Dhaka';
        // Admin screens are scoped to the user's current store; a new staff
        // member works in the same store as whoever is adding them.
        $data['current_store_id'] ??= $request->user()->current_store_id;

        $user = User::create([
            ...collect($data)->except(['password', 'roles'])->all(),
            'password' => Hash::make($data['password']),
        ]);

        if (! empty($data['roles'])) {
            $this->authorize('assignRole', User::class);
            $user->syncRoles($data['roles']);
        }

        return ApiResponse::success(new UserResource($user->load('roles')), 'User created successfully.', status: 201);
    }

    public function show(User $user): JsonResponse
    {
        $this->authorize('view', $user);

        return ApiResponse::success(new UserResource($user->load('roles')), 'User fetched successfully.');
    }

    public function update(UserRequest $request, User $user): JsonResponse
    {
        $this->authorize('update', $user);

        $data = $request->validated();
        $payload = collect($data)->except(['password', 'roles'])->all();

        if (! empty($data['password'])) {
            $payload['password'] = Hash::make($data['password']);
        }

        $user->update($payload);

        if (array_key_exists('roles', $data)) {
            $this->authorize('assignRole', User::class);
            $user->syncRoles($data['roles'] ?? []);
        }

        return ApiResponse::success(new UserResource($user->load('roles')), 'User updated successfully.');
    }

    public function destroy(User $user): JsonResponse
    {
        $this->authorize('delete', $user);

        $user->delete();

        return ApiResponse::success(message: 'User deleted successfully.');
    }
}
