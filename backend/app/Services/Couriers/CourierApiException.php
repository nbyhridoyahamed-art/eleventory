<?php

namespace App\Services\Couriers;

use RuntimeException;

/** A courier API refused or failed a request; the message is safe to show to staff. */
class CourierApiException extends RuntimeException {}
