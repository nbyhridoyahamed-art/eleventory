<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\CustomerRequest;
use App\Http\Resources\CustomerResource;
use App\Models\Customer;
use App\Support\ApiResponse;
use App\Support\CustomerSegment;
use App\Support\Money;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class CustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Customer::class);

        $perPage = min((int) $request->integer('per_page', 20), 100);

        [$caseSql, $caseBindings] = CustomerSegment::caseSql();
        $segment = $request->string('segment')->toString();
        $sort = $request->string('sort')->toString();
        $direction = $request->string('direction')->toString() === 'asc' ? 'asc' : 'desc';

        $customers = Customer::query()
            ->withCount('orders')
            ->withSum('storeCredits as store_credit_balance_minor', 'amount')
            ->selectRaw('customers.*')
            ->selectRaw(CustomerSegment::ORDERS_SQL.' as active_orders_count')
            ->selectRaw(CustomerSegment::SPEND_SQL.' as lifetime_spend_minor')
            ->selectRaw(CustomerSegment::LAST_SQL.' as last_order_at')
            ->when(in_array($segment, CustomerSegment::ALL, true), fn ($query) => $query->whereRaw("($caseSql) = ?", [...$caseBindings, $segment]))
            ->when($request->filled('store_id'), fn ($query) => $query->where('store_id', $request->integer('store_id')))
            ->when($request->filled('search'), function ($query) use ($request) {
                $term = '%'.$request->string('search').'%';
                $query->where(function ($q) use ($term) {
                    $q->where('name', 'like', $term)->orWhere('phone', 'like', $term)->orWhere('email', 'like', $term);
                });
            })
            ->when($sort === 'spend', fn ($q) => $q->orderByRaw(CustomerSegment::SPEND_SQL." $direction"))
            ->when($sort === 'orders', fn ($q) => $q->orderByRaw(CustomerSegment::ORDERS_SQL." $direction"))
            ->when($sort === 'recent', fn ($q) => $q->orderByRaw('('.CustomerSegment::LAST_SQL.") is null, ".CustomerSegment::LAST_SQL." $direction"))
            ->when($sort === 'joined', fn ($q) => $q->orderBy('created_at', $direction))
            ->orderBy('name')
            ->paginate($perPage);

        return ApiResponse::success(
            CustomerResource::collection($customers),
            'Customers fetched successfully.',
            [
                'current_page' => $customers->currentPage(),
                'per_page' => $customers->perPage(),
                'total' => $customers->total(),
                'last_page' => $customers->lastPage(),
            ],
        );
    }

    /**
     * Headline numbers for the customers screen: totals, growth against the
     * previous 30 days, how loyal the base is, the segment mix and the top
     * spenders. Cancelled orders never count towards spend.
     */
    public function summary(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Customer::class);

        $request->validate(['store_id' => ['required', 'exists:stores,id']]);

        $storeId = $request->integer('store_id');
        $base = fn () => Customer::query()->where('store_id', $storeId);

        $total = $base()->count();
        $now30 = $base()->where('created_at', '>=', Carbon::today()->subDays(29))->count();
        $prev30 = $base()->where('created_at', '>=', Carbon::today()->subDays(59))->where('created_at', '<', Carbon::today()->subDays(29))->count();

        [$caseSql, $caseBindings] = CustomerSegment::caseSql();

        $segments = $base()
            ->selectRaw("($caseSql) as segment, COUNT(*) as total", $caseBindings)
            ->groupBy('segment')
            ->get()
            ->pluck('total', 'segment');

        $buyers = $base()->whereRaw(CustomerSegment::ORDERS_SQL.' > 0')->count();
        $repeat = $base()->whereRaw(CustomerSegment::ORDERS_SQL.' >= 2')->count();
        $revenueMinor = (int) $base()->sum(DB::raw(CustomerSegment::SPEND_SQL));

        $top = $base()
            ->selectRaw('customers.id, customers.name, customers.phone')
            ->selectRaw(CustomerSegment::SPEND_SQL.' as spend_minor')
            ->selectRaw(CustomerSegment::ORDERS_SQL.' as orders_count')
            ->orderByRaw(CustomerSegment::SPEND_SQL.' desc')
            ->limit(5)
            ->get()
            ->filter(fn ($c) => (int) $c->spend_minor > 0)
            ->map(fn ($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'phone' => $c->phone,
                'orders_count' => (int) $c->orders_count,
                'lifetime_spend' => (new Money((int) $c->spend_minor, 'BDT'))->toDecimal(),
            ])->values()->all();

        $segmentList = [];
        foreach (CustomerSegment::ALL as $key) {
            $segmentList[] = ['key' => $key, 'label' => CustomerSegment::LABELS[$key], 'count' => (int) ($segments[$key] ?? 0)];
        }

        return ApiResponse::success([
            'total_customers' => $total,
            'new_30_days' => $now30,
            'new_previous_30_days' => $prev30,
            'with_orders' => $buyers,
            'repeat_rate' => $buyers > 0 ? round($repeat / $buyers * 100, 1) : 0.0,
            'average_lifetime_value' => $buyers > 0 ? (new Money((int) round($revenueMinor / $buyers), 'BDT'))->toDecimal() : 0.0,
            'total_lifetime_value' => (new Money($revenueMinor, 'BDT'))->toDecimal(),
            'segments' => $segmentList,
            'top_customers' => $top,
        ], 'Customer summary fetched successfully.');
    }

    public function store(CustomerRequest $request): JsonResponse
    {
        $this->authorize('create', Customer::class);

        $data = $request->validated();
        $data['status'] ??= 'active';

        $customer = Customer::create($data);

        return ApiResponse::success(new CustomerResource($customer), 'Customer created successfully.', status: 201);
    }

    public function show(Customer $customer): JsonResponse
    {
        $this->authorize('view', $customer);

        return ApiResponse::success(
            new CustomerResource(
                $customer->loadCount('orders')
                    ->loadSum('storeCredits as store_credit_balance_minor', 'amount')
                    ->load(['addresses.division', 'addresses.district', 'addresses.upazila']),
            ),
            'Customer fetched successfully.',
        );
    }

    public function update(CustomerRequest $request, Customer $customer): JsonResponse
    {
        $this->authorize('update', $customer);

        $customer->update($request->validated());

        return ApiResponse::success(new CustomerResource($customer), 'Customer updated successfully.');
    }

    public function destroy(Customer $customer): JsonResponse
    {
        $this->authorize('delete', $customer);

        $customer->delete();

        return ApiResponse::success(message: 'Customer deleted successfully.');
    }
}
