<?php

namespace App\Mcp;

use RuntimeException;

/** A tool failed in a way the assistant should be told about (not a server fault). */
class McpToolException extends RuntimeException
{
    /** @param array<string, mixed>|null $errors */
    public function __construct(string $message, public readonly int $status = 422, public readonly ?array $errors = null)
    {
        parent::__construct($message);
    }
}
