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

export interface BackendConnector {
  checkBalance(accountId: string): Promise<BalanceResponse>;
  changePlan(accountId: string, planId: string): Promise<PlanChangeResponse>;
  createTicket(description: string): Promise<TicketResponse>;
  checkOutage(location?: string): Promise<OutageResponse>;
  executeAction(actionType: string, params: Record<string, unknown>): Promise<ActionResponse>;

  /** Optional: KB sync manifest. Reference BFF endpoint GET /api/v1/sync/kb */
  fetchKbManifest?(): Promise<KbManifest>;
  /** Optional: download a signed KB bundle referenced by a manifest */
  fetchKbBundle?(manifest: KbManifest): Promise<KbBundle>;
  /** Optional: audit telemetry POST /api/v1/telemetry */
  postTelemetry?(events: TelemetryEvent[]): Promise<void>;
}

export interface KbManifest {
  version: string;
  sha256: string;
  url: string;
  publishedAt: string;
  signature: string;
}

export interface KbBundle {
  manifest: KbManifest;
  /** Raw JSON bundle contents keyed by filename */
  files: Record<string, string>;
}

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
  async checkBalance(_accountId: string): Promise<BalanceResponse> {
    return {
      balance: 'PHP 127.50',
      data: '3.2GB (expires Apr 15)',
      promos: 'MegaSurf 299',
    };
  }

  async changePlan(_accountId: string, _planId: string): Promise<PlanChangeResponse> {
    return {
      message:
        'To change your plan, please specify which plan you\'d like to switch to. ' +
        'You can say something like "Switch to Plan 999" and I\'ll process it.',
      effectiveDate: '',
    };
  }

  async createTicket(_description: string): Promise<TicketResponse> {
    return {
      ticketId: '',
      message:
        'I can help create a support ticket. Could you describe the issue you\'re experiencing?',
    };
  }

  async checkOutage(_location?: string): Promise<OutageResponse> {
    return {
      hasOutage: false,
      message:
        'No service outages are currently reported in your area. ' +
        'If you\'re still experiencing issues, I can help troubleshoot.',
    };
  }

  async executeAction(actionType: string, _params: Record<string, unknown>): Promise<ActionResponse> {
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
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl: string, headers: Record<string, string> = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.defaultHeaders = {'Content-Type': 'application/json', ...headers};
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {...this.defaultHeaders, ...(init.headers ?? {})},
    });
    if (!res.ok) {
      throw new Error(`${init.method ?? 'GET'} ${path} -> HTTP ${res.status}`);
    }
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new Error(`${path} returned non-JSON content-type: ${contentType}`);
    }
    return (await res.json()) as T;
  }

  async checkBalance(accountId: string): Promise<BalanceResponse> {
    return this.request<BalanceResponse>(
      `/api/v1/accounts/${encodeURIComponent(accountId)}/balance`,
    );
  }

  async changePlan(
    accountId: string,
    planId: string,
  ): Promise<PlanChangeResponse> {
    return this.request<PlanChangeResponse>(
      `/api/v1/accounts/${encodeURIComponent(accountId)}/plan`,
      {method: 'POST', body: JSON.stringify({planId})},
    );
  }

  async createTicket(description: string): Promise<TicketResponse> {
    return this.request<TicketResponse>(`/api/v1/tickets`, {
      method: 'POST',
      body: JSON.stringify({description}),
    });
  }

  async checkOutage(location?: string): Promise<OutageResponse> {
    const path = location
      ? `/api/v1/outages?location=${encodeURIComponent(location)}`
      : `/api/v1/outages`;
    return this.request<OutageResponse>(path);
  }

  async executeAction(
    actionType: string,
    params: Record<string, unknown>,
  ): Promise<ActionResponse> {
    return this.request<ActionResponse>(
      `/api/v1/actions/${encodeURIComponent(actionType)}`,
      {method: 'POST', body: JSON.stringify(params)},
    );
  }

  async fetchKbManifest(): Promise<KbManifest> {
    return this.request<KbManifest>(`/api/v1/sync/kb`);
  }

  async fetchKbBundle(manifest: KbManifest): Promise<KbBundle> {
    const res = await fetch(`${this.baseUrl}/api/v1/sync/kb/download`, {
      headers: this.defaultHeaders,
    });
    if (!res.ok) throw new Error(`kb download HTTP ${res.status}`);
    const body = await res.json();
    return {manifest, files: body.files ?? {}};
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
      const headers: Record<string, string> = {};
      if (backend.auth?.type === 'bearer' && backend.auth?.tokenUrl) {
        headers.Authorization = `Bearer ${backend.auth.tokenUrl}`;
      }
      return new RestBackendConnector(backend.baseUrl, headers);
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
