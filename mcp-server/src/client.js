/**
 * Thin client for the Eleventory admin REST API (Laravel, Sanctum bearer auth).
 *
 * Authentication, in order of preference:
 *   1. ELEVENTORY_API_TOKEN   - a token issued to a staff user
 *   2. ELEVENTORY_EMAIL + ELEVENTORY_PASSWORD - logs in once and re-logs in on 401
 */

const DEFAULT_URL = "http://localhost:8000/api/v1";

export class EleventoryError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.name = "EleventoryError";
    this.status = status;
    this.errors = errors;
  }
}

export class EleventoryClient {
  constructor(env = process.env) {
    this.baseUrl = (env.ELEVENTORY_API_URL || DEFAULT_URL).replace(/\/+$/, "");
    this.token = env.ELEVENTORY_API_TOKEN || null;
    this.email = env.ELEVENTORY_EMAIL || null;
    this.password = env.ELEVENTORY_PASSWORD || null;
    this.storeId = env.ELEVENTORY_STORE_ID ? Number(env.ELEVENTORY_STORE_ID) : null;
    this.user = null;
  }

  get canLogin() {
    return Boolean(this.email && this.password);
  }

  async login() {
    if (!this.canLogin) {
      throw new EleventoryError(
        "Not authenticated. Set ELEVENTORY_API_TOKEN, or ELEVENTORY_EMAIL and ELEVENTORY_PASSWORD.",
        401,
      );
    }

    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ email: this.email, password: this.password }),
    });
    const json = await response.json().catch(() => null);

    if (!response.ok || !json?.success) {
      throw new EleventoryError(json?.message || "Login failed.", response.status, json?.errors);
    }

    this.token = json.data.token;
    this.user = json.data.user;

    return this.user;
  }

  /** Resolves the signed-in staff user and the store id every call is scoped to. */
  async init() {
    if (!this.token) await this.login();

    try {
      this.user = (await this.request("GET", "/auth/me")).data;
    } catch (error) {
      if (error.status === 401 && this.canLogin) {
        await this.login();
        this.user = (await this.request("GET", "/auth/me")).data;
      } else {
        throw error;
      }
    }

    this.user = this.user?.user ?? this.user;
    this.storeId ??= this.user?.current_store_id ?? null;

    return { user: this.user, storeId: this.storeId };
  }

  /**
   * @returns {Promise<{data: any, meta?: any, message?: string}>}
   */
  async request(method, path, { query, body, retry = true } = {}) {
    const url = new URL(`${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`);

    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    }

    const response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await response.json().catch(() => null);

    if (response.status === 401 && retry && this.canLogin) {
      await this.login();

      return this.request(method, path, { query, body, retry: false });
    }

    if (!response.ok || !json || json.success === false) {
      throw new EleventoryError(
        json?.message || `Request failed with HTTP ${response.status}.`,
        response.status,
        json?.errors,
      );
    }

    return { data: json.data, meta: json.meta, message: json.message };
  }

  get(path, query) {
    return this.request("GET", path, { query });
  }

  post(path, body, query) {
    return this.request("POST", path, { body: body ?? {}, query });
  }

  put(path, body) {
    return this.request("PUT", path, { body: body ?? {} });
  }

  delete(path, query) {
    return this.request("DELETE", path, { query });
  }

  /** Query params that almost every list/report endpoint needs. */
  scoped(extra = {}) {
    return { store_id: this.storeId, ...extra };
  }
}
