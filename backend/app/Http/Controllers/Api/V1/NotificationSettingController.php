<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\NotificationLog;
use App\Models\NotificationSetting;
use App\Models\Store;
use App\Services\Sms\BulkSmsBdGateway;
use App\Support\ApiResponse;
use App\Support\NotificationRouter;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;
use Throwable;

/** Settings → Notifications: BulkSMSBD + SMTP credentials, per-event switches, templates and the send log. */
class NotificationSettingController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $store = $this->store($request);

        return ApiResponse::success($this->payload($store), 'Notification settings fetched successfully.');
    }

    public function update(Request $request): JsonResponse
    {
        $store = $this->store($request);
        $events = array_keys(NotificationSetting::EVENTS);

        $data = $request->validate([
            'sms.enabled' => ['sometimes', 'boolean'],
            'sms.api_key' => ['nullable', 'string', 'max:255'],
            'sms.sender_id' => ['nullable', 'string', 'max:50'],
            'email.enabled' => ['sometimes', 'boolean'],
            'email.host' => ['nullable', 'string', 'max:255'],
            'email.port' => ['nullable', 'integer', 'between:1,65535'],
            'email.encryption' => ['nullable', Rule::in(['tls', 'ssl', 'none'])],
            'email.username' => ['nullable', 'string', 'max:255'],
            'email.password' => ['nullable', 'string', 'max:255'],
            'email.from_address' => ['nullable', 'email', 'max:255'],
            'email.from_name' => ['nullable', 'string', 'max:100'],
            'events' => ['sometimes', 'array'],
            'events.*.sms' => ['sometimes', 'boolean'],
            'events.*.email' => ['sometimes', 'boolean'],
            'templates' => ['sometimes', 'array'],
            'templates.*.sms' => ['nullable', 'string', 'max:500'],
            'templates.*.email_subject' => ['nullable', 'string', 'max:255'],
            'templates.*.email_body' => ['nullable', 'string', 'max:3000'],
        ]);

        $current = NotificationSetting::forStore($store->id) ?? NotificationSetting::defaults();

        foreach (['sms', 'email'] as $group) {
            foreach ($data[$group] ?? [] as $key => $value) {
                // A blank secret on save keeps the stored one.
                if (in_array($key, ['api_key', 'password'], true) && blank($value)) {
                    continue;
                }

                $current[$group][$key] = $value;
            }
        }

        foreach ($data['events'] ?? [] as $event => $switch) {
            if (in_array($event, $events, true)) {
                $current['events'][$event] = array_merge($current['events'][$event], $switch);
            }
        }

        foreach ($data['templates'] ?? [] as $event => $template) {
            if (in_array($event, $events, true)) {
                $current['templates'][$event] = array_merge($current['templates'][$event], $template);
            }
        }

        NotificationSetting::updateOrCreate(['store_id' => $store->id], ['data' => $current]);

        return ApiResponse::success($this->payload($store), 'Notification settings saved successfully.');
    }

    public function smsBalance(Request $request): JsonResponse
    {
        $store = $this->store($request);
        $settings = NotificationSetting::forStore($store->id);

        if (blank($settings['sms']['api_key'] ?? null)) {
            return ApiResponse::error('Save your BulkSMSBD API key first.', [], 422);
        }

        try {
            $balance = (new BulkSmsBdGateway($settings['sms']['api_key'], $settings['sms']['sender_id']))->balance();
        } catch (Throwable $e) {
            return ApiResponse::error($e->getMessage(), [], 422);
        }

        return ApiResponse::success(['balance' => $balance], 'Connected to BulkSMSBD.');
    }

    public function testSms(Request $request): JsonResponse
    {
        $store = $this->store($request);
        $data = $request->validate(['phone' => ['required', 'string', 'max:20']]);
        $settings = NotificationSetting::forStore($store->id);

        if (blank($settings['sms']['api_key'] ?? null)) {
            return ApiResponse::error('Save your BulkSMSBD API key first.', [], 422);
        }

        $message = "Test SMS from {$store->name}. Your SMS notifications are working.";
        $status = 'sent';
        $error = null;

        try {
            (new BulkSmsBdGateway($settings['sms']['api_key'], $settings['sms']['sender_id']))->send($data['phone'], $message);
        } catch (Throwable $e) {
            $status = 'failed';
            $error = $e->getMessage();
        }

        NotificationLog::create([
            'store_id' => $store->id, 'channel' => 'sms', 'event' => 'test', 'recipient' => $data['phone'],
            'message' => $message, 'status' => $status, 'error' => $error,
        ]);

        return $error === null
            ? ApiResponse::success(message: 'Test SMS sent.')
            : ApiResponse::error($error, [], 422);
    }

    public function testEmail(Request $request): JsonResponse
    {
        $store = $this->store($request);
        $data = $request->validate(['email' => ['required', 'email']]);
        $settings = NotificationSetting::forStore($store->id);

        if ($settings === null || ! NotificationRouter::registerMailer($settings['email'])) {
            return ApiResponse::error('Save your SMTP host and turn email on first.', [], 422);
        }

        $status = 'sent';
        $error = null;

        try {
            Mail::mailer(NotificationRouter::MAILER)->raw(
                "This is a test email from {$store->name}. Your SMTP settings are working.",
                function ($message) use ($data, $settings, $store) {
                    $message->to($data['email'])->subject("Test email from {$store->name}");

                    if (filled($settings['email']['from_address'])) {
                        $message->from($settings['email']['from_address'], $settings['email']['from_name'] ?: null);
                    }
                },
            );
        } catch (Throwable $e) {
            $status = 'failed';
            $error = $e->getMessage();
        }

        NotificationLog::create([
            'store_id' => $store->id, 'channel' => 'email', 'event' => 'test', 'recipient' => $data['email'],
            'subject' => "Test email from {$store->name}", 'status' => $status, 'error' => $error ? mb_substr($error, 0, 500) : null,
        ]);

        return $error === null
            ? ApiResponse::success(message: 'Test email sent.')
            : ApiResponse::error('Could not send: '.mb_substr($error, 0, 300), [], 422);
    }

    public function logs(Request $request): JsonResponse
    {
        $store = $this->store($request);

        $logs = NotificationLog::query()
            ->where('store_id', $store->id)
            ->when($request->filled('channel'), fn ($q) => $q->where('channel', $request->string('channel')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->orderByDesc('id')
            ->paginate(min((int) $request->integer('per_page', 25), 100));

        return ApiResponse::success($logs->getCollection()->map(fn (NotificationLog $log) => [
            'id' => $log->id,
            'channel' => $log->channel,
            'event' => $log->event,
            'recipient' => $log->recipient,
            'subject' => $log->subject,
            'message' => $log->message,
            'status' => $log->status,
            'error' => $log->error,
            'created_at' => $log->created_at,
        ])->all(), 'Send log fetched successfully.', [
            'current_page' => $logs->currentPage(),
            'per_page' => $logs->perPage(),
            'total' => $logs->total(),
            'last_page' => $logs->lastPage(),
        ]);
    }

    /** Secrets are never sent back; the UI only learns whether they are saved. */
    private function payload(Store $store): array
    {
        $settings = NotificationSetting::forStore($store->id) ?? NotificationSetting::defaults();

        $settings['sms']['has_api_key'] = filled($settings['sms']['api_key']);
        $settings['email']['has_password'] = filled($settings['email']['password']);
        unset($settings['sms']['api_key'], $settings['email']['password']);

        return [
            'settings' => $settings,
            'events' => collect(NotificationSetting::EVENTS)->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values()->all(),
        ];
    }

    private function store(Request $request): Store
    {
        if (! $request->user()->can('settings.manage')) {
            throw new AuthorizationException;
        }

        return Store::query()->findOrFail($request->integer('store_id'));
    }
}
