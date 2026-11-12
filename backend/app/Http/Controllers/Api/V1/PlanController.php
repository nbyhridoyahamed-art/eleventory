<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

/** The public price list: pricing page, sign-up and the billing screen all read this. */
class PlanController extends Controller
{
    public function index(): JsonResponse
    {
        return ApiResponse::success(Plan::purchasable()->get()->map(fn (Plan $plan) => self::present($plan))->all(), 'Plans fetched successfully.');
    }

    public static function present(Plan $plan): array
    {
        return [
            'key' => $plan->key,
            'name' => $plan->name,
            'description' => $plan->description,
            'currency' => $plan->currency,
            'price_monthly' => (float) $plan->price_monthly,
            'price_yearly' => (float) $plan->priceFor('yearly'),
            'limits' => $plan->limits,
            'features' => $plan->features,
        ];
    }
}
