<?php

namespace App\Services\Payments;

use App\Services\Payments\Gateways\FakeMerchantGateway;
use App\Services\Payments\Gateways\SslCommerzMerchantGateway;
use App\Services\Payments\Gateways\StripeMerchantGateway;

/** Every payment provider the platform knows how to talk to. */
class MerchantGateways
{
    /** @return array<string, MerchantGateway> */
    public function all(): array
    {
        $gateways = [new SslCommerzMerchantGateway, new StripeMerchantGateway];

        // The pretend gateway only exists on developer machines and in tests.
        if (app()->environment(['local', 'testing'])) {
            $gateways[] = new FakeMerchantGateway;
        }

        return collect($gateways)->keyBy(fn (MerchantGateway $g) => $g->key())->all();
    }

    public function get(string $key): ?MerchantGateway
    {
        return $this->all()[$key] ?? null;
    }
}
