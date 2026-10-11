<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notification_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->unique()->constrained()->cascadeOnDelete();
            // Encrypted JSON: SMS API key and SMTP password live inside it.
            $table->longText('data');
            $table->timestamps();
        });

        Schema::create('notification_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->nullable()->constrained()->nullOnDelete();
            $table->string('channel', 10); // sms | email
            $table->string('event', 40)->nullable();
            $table->string('recipient', 191);
            $table->string('subject', 255)->nullable();
            $table->text('message')->nullable();
            $table->string('status', 10); // sent | failed
            $table->text('error')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['store_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_logs');
        Schema::dropIfExists('notification_settings');
    }
};
