export interface BalanceResponse {
  balance: string;
  data: string;
  promos: string;
}

export interface PlanChangeResponse {
  message: string;
  effectiveDate: string;
}

export interface TicketResponse {
  ticketId: string;
  message: string;
}

export interface OutageResponse {
  hasOutage: boolean;
  message: string;
}

export interface ActionResponse {
  message: string;
}

export interface RemoteModelManifest {
  version?: string;
  filename?: string;
  url?: string;
  sha256?: string;
  sizeBytes?: number;
  publishedAt?: string;
}

export interface BackendRequestOptions {
  idempotencyKey?: string;
}

export interface BackendConnector {
  checkBalance(accountId: string, options?: BackendRequestOptions): Promise<BalanceResponse>;
  changePlan(
    accountId: string,
    planId: string,
    options?: BackendRequestOptions,
  ): Promise<PlanChangeResponse>;
  createTicket(description: string, options?: BackendRequestOptions): Promise<TicketResponse>;
  checkOutage(location?: string, options?: BackendRequestOptions): Promise<OutageResponse>;
  executeAction(
    actionType: string,
    params: Record<string, unknown>,
    options?: BackendRequestOptions,
  ): Promise<ActionResponse>;

  /** Optional: KB sync manifest. Reference BFF endpoint GET /api/v1/sync/kb */
  fetchKbManifest?(): Promise<KbManifest>;
  /** Optional: download the exact signed bytes referenced by a manifest. */
  fetchKbBytes?(manifest: KbManifest): Promise<Uint8Array>;
  /** Optional: read the current local-model release metadata. */
  fetchModelManifest?(): Promise<RemoteModelManifest>;
  /** Optional: audit telemetry POST /api/v1/telemetry */
  postTelemetry?(events: TelemetryEvent[]): Promise<void>;
}

export type KbManifest = BundleManifest;

export interface TelemetryEvent {
  timestamp: string;
  query: string;
  kbVersion?: string;
  retrievedDocIds: string[];
  answerHash: string;
  confidence: number;
  toolCalls?: string[];
  refusalReason?: string;
}

export class MockBackendConnector implements BackendConnector {
  async checkBalance(
    _accountId: string,
    _options?: BackendRequestOptions,
  ): Promise<BalanceResponse> {
    return {
      balance: 'PHP 127.50',
      data: '3.2GB (expires Apr 15)',
      promos: 'MegaSurf 299',
    };
  }

  async changePlan(
    _accountId: string,
    _planId: string,
    _options?: BackendRequestOptions,
  ): Promise<PlanChangeResponse> {
    return {
      message:
        "To change your plan, please specify which plan you'd like to switch to. " +
        'You can say something like "Switch to Plan 999" and I\'ll process it.',
      effectiveDate: '',
    };
  }

  async createTicket(
    _description: string,
    _options?: BackendRequestOptions,
  ): Promise<TicketResponse> {
    return {
      ticketId: '',
      message:
        "I can help create a support ticket. Could you describe the issue you're experiencing?",
    };
  }

  async checkOutage(_location?: string, _options?: BackendRequestOptions): Promise<OutageResponse> {
    return {
      hasOutage: false,
      message:
        'No service outages are currently reported in your area. ' +
        "If you're still experiencing issues, I can help troubleshoot.",
    };
  }

  async executeAction(
    actionType: string,
    _params: Record<string, unknown>,
    _options?: BackendRequestOptions,
  ): Promise<ActionResponse> {
    return {
      message: `Action "${actionType}" acknowledged. Let me look into that for you.`,
    };
  }
}

/**
 * Real REST backend connector. Pointed at a reference BFF implementation
 * (see server/README.md) but designed to talk to any backend that exposes
 * the same four routes under /api/v1/.
 */
export class RestBackendConnector implements BackendConnector {
  private baseUrl: string;
  private audience: string;
  private timeoutMs: number;

  constructor(baseUrl: string, options: {audience?: string; timeoutMs?: number} = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.audience = options.audience ?? 'airgap-bff';
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  private async authorizedFetch(url: string, init: RequestInit = {}): Promise<Response> {
    const token = await getAccessToken(this.audience);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(url, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(init.headers ?? {}),
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await this.authorizedFetch(url, init);
    if (!res.ok) {
      throw new Error(`${init.method ?? 'GET'} ${path} -> HTTP ${res.status}`);
    }
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new Error(`${path} returned non-JSON content-type: ${contentType}`);
    }
    return (await res.json()) as T;
  }

  async checkBalance(accountId: string, options?: BackendRequestOptions): Promise<BalanceResponse> {
    return this.request<BalanceResponse>(
      `/api/v1/accounts/${encodeURIComponent(accountId)}/balance`,
      this.requestOptions(options),
    );
  }

  async changePlan(
    accountId: string,
    planId: string,
    options?: BackendRequestOptions,
  ): Promise<PlanChangeResponse> {
    return this.request<PlanChangeResponse>(
      `/api/v1/accounts/${encodeURIComponent(accountId)}/plan`,
      {
        method: 'POST',
        body: JSON.stringify({planId}),
        ...this.requestOptions(options),
      },
    );
  }

  async createTicket(
    description: string,
    options?: BackendRequestOptions,
  ): Promise<TicketResponse> {
    return this.request<TicketResponse>(`/api/v1/tickets`, {
      method: 'POST',
      body: JSON.stringify({description}),
      ...this.requestOptions(options),
    });
  }

  async checkOutage(location?: string, options?: BackendRequestOptions): Promise<OutageResponse> {
    const path = location
      ? `/api/v1/outages?location=${encodeURIComponent(location)}`
      : `/api/v1/outages`;
    return this.request<OutageResponse>(path, this.requestOptions(options));
  }

  async executeAction(
    actionType: string,
    params: Record<string, unknown>,
    options?: BackendRequestOptions,
  ): Promise<ActionResponse> {
    return this.request<ActionResponse>(`/api/v1/actions/${encodeURIComponent(actionType)}`, {
      method: 'POST',
      body: JSON.stringify(params),
      ...this.requestOptions(options),
    });
  }

  private requestOptions(options?: BackendRequestOptions): RequestInit {
    return options?.idempotencyKey ? {headers: {'Idempotency-Key': options.idempotencyKey}} : {};
  }

  async fetchKbManifest(): Promise<KbManifest> {
    return this.request<KbManifest>(`/api/v1/sync/kb`);
  }

  async fetchKbBytes(manifest: KbManifest): Promise<Uint8Array> {
    const configuredOrigin = new URL(this.baseUrl).origin;
    const downloadUrl = new URL(manifest.url);
    if (downloadUrl.origin !== configuredOrigin) {
      throw new Error('bundle_url_origin_invalid');
    }
    const response = await this.authorizedFetch(downloadUrl.toString());
    if (!response.ok) {
      throw new Error(`GET bundle -> HTTP ${response.status}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  async fetchModelManifest(): Promise<RemoteModelManifest> {
    return this.request<RemoteModelManifest>('/api/v1/sync/model');
  }

  async postTelemetry(events: TelemetryEvent[]): Promise<void> {
    if (events.length === 0) return;
    await this.request<{accepted: number}>(`/api/v1/telemetry`, {
      method: 'POST',
      body: JSON.stringify({events}),
    });
  }
}

function buildConnectorFromConfig(): BackendConnector {
  try {
    // Lazy import to avoid a circular dependency: config/loader imports
    // logger, which imports safetyLayer, which imports config.
    const {config} = require('../config/loader') as typeof import('../config/loader');
    const backend = (config as any).backend;
    if (backend?.type === 'rest' && backend?.baseUrl) {
      return new RestBackendConnector(backend.baseUrl, {
        audience: backend.auth?.audience,
      });
    }
  } catch {
    // fall through to mock
  }
  return new MockBackendConnector();
}

let connector: BackendConnector = buildConnectorFromConfig();

export function getBackendConnector(): BackendConnector {
  return connector;
}

export function setBackendConnector(newConnector: BackendConnector): void {
  connector = newConnector;
}
import {getAccessToken} from './authProvider';
import type {BundleManifest} from './bundleVerifier';
