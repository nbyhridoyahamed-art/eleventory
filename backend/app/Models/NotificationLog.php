<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['store_id', 'channel', 'event', 'recipient', 'subject', 'message', 'status', 'error'])]
class NotificationLog extends Model
{
    public const UPDATED_AT = null;
}
