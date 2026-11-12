<?php

return [
    /* Report "degraded" when the scheduler has not run for 5 minutes. Turn on where cron / schedule:work runs. */
    'require_scheduler' => (bool) env('HEALTH_REQUIRE_SCHEDULER', false),

    /* A queued job waiting longer than this means the worker is not running. */
    'max_job_age_minutes' => (int) env('HEALTH_MAX_JOB_AGE_MINUTES', 10),
];
