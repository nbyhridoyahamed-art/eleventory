<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Model;

/** A store's own payment provider account. The secrets never leave the server. */
class StorePaymentGateway extends Model
{
    use BelongsToStore;

    protected $fillable = ['store_id', 'provider', 'is_enabled', 'test_mode', 'credentials'];

    protected $hidden = ['credentials'];

    protected function casts(): array
    {
        return ['is_enabled' => 'boolean', 'test_mode' => 'boolean', 'credentials' => 'encrypted:array'];
    }

    public function credential(string $key): string
    {
        return (string) ($this->credentials[$key] ?? '');
    }
}
