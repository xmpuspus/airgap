# Enterprise Integration Architecture

## How Airgap Connects to Enterprise BSS/OSS

Airgap is offline-first. The integration architecture reflects this: the app works independently using local KB + on-device LLM, and syncs with enterprise backends when online through a Backend-for-Frontend (BFF) middleware layer.

---

## The Three Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  DEVICE LAYER (Offline-First)                                   │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ On-Device│  │MiniSearch │  │ Action   │  │ Cached       │   │
│  │ LLM      │  │ KB Index │  │ Queue    │  │ Account Data │   │
│  │(Gemma 4 E2B) │  │(105 docs)│  │ (MMKV)  │  │ (MMKV)       │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
│       │              │              │              │            │
│  ┌────┴──────────────┴──────────────┴──────────────┴────┐      │
│  │              Orchestrator Pipeline                     │      │
│  └───────────────────────┬───────────────────────────────┘      │
│                          │ (when online)                        │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                    HTTPS + JWT
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│  BFF LAYER (Backend-for-Frontend)                               │
│                                                                 │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────┐            │
│  │ Auth       │  │ Action       │  │ KB Sync     │            │
│  │ Service    │  │ Processor    │  │ Service     │            │
│  │ (OAuth2)   │  │ (queue replay│  │ (version +  │            │
│  │            │  │  + conflict  │  │  delta push)│            │
│  │            │  │  resolution) │  │             │            │
│  └────────────┘  └──────┬───────┘  └─────────────┘            │
│                         │                                       │
│  ┌──────────────────────┴───────────────────────────────┐      │
│  │              Enterprise Adapter Layer                  │      │
│  │  (Translates bot actions → enterprise API calls)       │      │
│  └──────┬──────┬──────┬──────┬──────┬──────┬────────────┘      │
│         │      │      │      │      │      │                    │
└─────────┼──────┼──────┼──────┼──────┼──────┼────────────────────┘
          │      │      │      │      │      │
┌─────────┼──────┼──────┼──────┼──────┼──────┼────────────────────┐
│  ENTERPRISE LAYER (BSS/OSS Systems of Record)                   │
│         │      │      │      │      │      │                    │
│    ┌────┴─┐ ┌──┴──┐ ┌─┴──┐ ┌┴───┐ ┌┴───┐ ┌┴────┐             │
│    │ CRM  │ │Bill-│ │Tick-│ │OMS │ │Pro- │ │Net- │             │
│    │      │ │ing  │ │eting│ │    │ │duct │ │work │             │
│    │Salesf│ │Amdoc│ │Servi│ │    │ │Cat- │ │Mgmt │             │
│    │orce/ │ │s/CSG│ │ceNow│ │    │ │alog │ │     │             │
│    │Siebel│ │     │ │     │ │    │ │     │ │     │             │
│    └──────┘ └─────┘ └─────┘ └────┘ └─────┘ └─────┘             │
│                                                                  │
│    TMF629   TMF678   TMF621  TMF622  TMF637   Custom            │
│    Customer Bill     Trouble Product Product  Network            │
│    Mgmt     Mgmt     Ticket  Order   Inventory Status           │
└──────────────────────────────────────────────────────────────────┘
```

---

## Enterprise Systems Map

### BSS (Business Support Systems)

| System | Purpose | TMF API | Typical Vendors | Bot Actions |
|--------|---------|---------|-----------------|-------------|
| **CRM** | Customer profiles, interaction history | TMF629 | Salesforce, Amdocs, Siebel | Account lookup, update contact info |
| **Billing** | Invoices, payments, balance | TMF678 | Amdocs Optima, CSG Ascendon, Ericsson | Check balance, view bill, payment status |
| **Product Catalog** | Plans, promos, add-ons | TMF620 | Amdocs, Sigma Systems | Fetch current plans/pricing (sync to KB) |
| **Order Management** | Plan changes, activations | TMF622 | Amdocs, Oracle Communications | Change plan, activate promo, order SIM |
| **Trouble Ticketing** | Issue tracking, escalation | TMF621 | ServiceNow, BMC Remedy, Zendesk | Create ticket, check ticket status |
| **Revenue Mgmt** | Rating, charging, prepaid balance | TMF654 | Amdocs, Ericsson OCS | Check prepaid balance, buy load |

### OSS (Operations Support Systems)

| System | Purpose | TMF API | Bot Actions |
|--------|---------|---------|-------------|
| **Network Management** | Tower/cell status, outages | TMF656 | Check outage status, coverage info |
| **Service Assurance** | SLA monitoring, speed tests | TMF657 | Report speed issues, check service quality |
| **Provisioning** | Activate/deactivate services | TMF633 | SIM activation, eSIM provisioning |

### SORs (Systems of Record)

| System | Data | Bot Actions |
|--------|------|-------------|
| **HLR/HSS** | Subscriber registration, SIM status | Check SIM status, verify registration |
| **PCRF/OCS** | Real-time charging, data quota | Check data remaining, buy add-on |
| **Number DB** | MSISDN allocation, porting | Number porting status |

---

## BFF Server Design

The BFF is the single integration point between the mobile app and all enterprise systems.

### API Endpoints

```
POST /api/v1/auth/token          # OAuth2 token exchange
POST /api/v1/sync/actions        # Process queued offline actions
GET  /api/v1/sync/kb             # Check for KB updates
GET  /api/v1/sync/kb/download    # Download updated KB package

GET  /api/v1/account/balance     # TMF678 → Billing
GET  /api/v1/account/bills       # TMF678 → Billing
GET  /api/v1/account/usage       # TMF654 → Rating/Charging
POST /api/v1/account/plan-change # TMF622 → Order Management
POST /api/v1/account/activate    # TMF633 → Provisioning

POST /api/v1/tickets             # TMF621 → Trouble Ticketing
GET  /api/v1/tickets/:id         # TMF621 → Trouble Ticketing

GET  /api/v1/network/outages     # TMF656 → Network Management
GET  /api/v1/network/coverage    # Custom → Coverage DB

POST /api/v1/analytics/events    # Collect bot usage analytics
POST /api/v1/analytics/feedback  # Collect thumbs up/down
```

### Offline Sync Protocol

```
1. App comes online
2. POST /api/v1/sync/actions with queued actions:
   {
     "deviceId": "abc-123",
     "actions": [
       {
         "id": "q-001",
         "type": "balance_check",
         "query": "What is my balance?",
         "timestamp": 1712300000,
         "accountId": "09171234567"
       },
       {
         "id": "q-002",
         "type": "ticket_create",
         "query": "My internet has been down for 3 days",
         "timestamp": 1712300120,
         "accountId": "09171234567"
       }
     ]
   }

3. BFF processes each action against enterprise APIs:
   - q-001 → TMF678 getCustomerBill → returns balance PHP 127.50
   - q-002 → TMF621 createTroubleTicket → returns ticket #TT-2026-04821

4. BFF returns results:
   {
     "results": [
       { "actionId": "q-001", "status": "success", "data": { "balance": 127.50, ... } },
       { "actionId": "q-002", "status": "success", "data": { "ticketId": "TT-2026-04821" } }
     ],
     "kbUpdate": { "available": true, "version": "2026-04-05", "url": "/sync/kb/download" }
   }

5. App displays results, syncs KB if update available
```

### Authentication Flow

```
User opens app → cached JWT in MMKV
  ↓
JWT expired? → Background refresh via /auth/token (if online)
  ↓
No internet? → Use cached account data (balance, plan info from last sync)
  ↓
First launch? → Login screen → OAuth2 flow → JWT stored in MMKV (encrypted)
```

---

## BackendConnector Implementation for TMF APIs

```typescript
// This is what the RestBackendConnector would look like for a real telco

class TMFBackendConnector implements BackendConnector {
  private bffBaseUrl: string;
  private authToken: string;

  async checkBalance(accountId: string) {
    // BFF routes to: TMF678 Customer Bill Management API
    // GET /customerBillManagement/v4/customerBill?billingAccount.id={accountId}&type=current
    const res = await fetch(`${this.bffBaseUrl}/account/balance`, {
      headers: { Authorization: `Bearer ${this.authToken}` }
    });
    const data = await res.json();
    return {
      balance: `PHP ${data.amountDue.value}`,
      data: `${data.dataRemaining}GB remaining`,
      promos: data.activePromos.map(p => p.name).join(', ')
    };
  }

  async changePlan(accountId: string, planId: string) {
    // BFF routes to: TMF622 Product Ordering API
    // POST /productOrderingManagement/v4/productOrder
    const res = await fetch(`${this.bffBaseUrl}/account/plan-change`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ accountId, planId })
    });
    const data = await res.json();
    return {
      message: `Plan change to ${data.planName} submitted.`,
      effectiveDate: data.effectiveDate
    };
  }

  async createTicket(description: string) {
    // BFF routes to: TMF621 Trouble Ticket Management API
    // POST /troubleTicketManagement/v4/troubleTicket
    const res = await fetch(`${this.bffBaseUrl}/tickets`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        description,
        severity: 'medium',
        channel: 'mobile-bot'
      })
    });
    const data = await res.json();
    return {
      ticketId: data.id,
      message: `Ticket ${data.id} created. A representative will contact you within ${data.slaHours} hours.`
    };
  }

  async checkOutage(location?: string) {
    // BFF routes to: TMF656 Service Problem Management API
    // GET /serviceProblemManagement/v3/serviceProblem?affectedLocation={location}
    const res = await fetch(
      `${this.bffBaseUrl}/network/outages?location=${encodeURIComponent(location || '')}`,
      { headers: { Authorization: `Bearer ${this.authToken}` } }
    );
    const data = await res.json();
    return {
      hasOutage: data.activeOutages.length > 0,
      message: data.activeOutages.length > 0
        ? `Outage reported in ${data.activeOutages[0].area}. Estimated resolution: ${data.activeOutages[0].eta}.`
        : 'No outages currently reported in your area.'
    };
  }
}
```

---

## KB Sync Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Admin CMS      │     │  BFF Server  │     │  Mobile App      │
│                 │     │              │     │                  │
│  Edit FAQ    ───┼────►│  Store KB    │     │  On launch:      │
│  Add plans   ───┼────►│  as versioned│◄────┼── GET /sync/kb   │
│  Update promo───┼────►│  JSON bundle │     │  {version: "v3"} │
│                 │     │              │     │                  │
│  Publish ───────┼────►│  Increment   │────►│  If new version: │
│                 │     │  version     │     │  Download bundle │
│                 │     │              │     │  Rebuild index   │
│                 │     │              │     │  Store locally   │
└─────────────────┘     └──────────────┘     └──────────────────┘
```

Updates flow: Admin edits content → BFF stores versioned KB → App checks on launch → Downloads delta → Rebuilds MiniSearch index. No app store update needed.

---

## Deployment Options

### Option A: Enterprise Self-Hosted
```
Enterprise datacenter
├── BFF Server (Docker/K8s)
├── Connected to existing BSS via TMF APIs
├── KB managed via Admin CMS
└── Mobile app distributed via enterprise MDM or Play Store
```

### Option B: SaaS Multi-Tenant
```
Airgap Cloud
├── Multi-tenant BFF (tenant isolation)
├── Per-tenant brand config + KB
├── API Gateway (Kong/Apigee) for TMF API routing
├── Each tenant connects their own BSS endpoints
└── Mobile app is white-labeled per tenant
```

### Option C: Hybrid (most common for telcos)
```
Telco's own infrastructure
├── BFF runs in telco's cloud (GCP/AWS)
├── Connected to on-prem BSS via VPN/private link
├── KB sync via telco's CDN
└── App on public app stores with telco branding
```

---

## What We'd Need to Build

| Component | Effort | Status |
|-----------|--------|--------|
| BackendConnector interface | Done | src/services/backendConnector.ts |
| MockBackendConnector | Done | Ships with app for PoC |
| RestBackendConnector (TMF) | 1 week | Stub exists, needs real HTTP calls |
| BFF Server (Node/FastAPI) | 2-3 weeks | New service |
| Auth flow (OAuth2 + JWT) | 1 week | App + BFF changes |
| KB Sync protocol | 3 days | App-side mostly designed |
| Admin CMS | 2-3 weeks | New web app |
| Offline sync with conflict resolution | 1 week | Queue exists, needs server-side |
| TMF API adapters | 2-4 weeks per system | BFF-side, per enterprise |

Sources:
- [TM Forum Open APIs](https://www.tmforum.org/oda/open-apis/)
- [TMF621 Trouble Ticket API](https://www.tmforum.org/resources/specification/tmf621-trouble-ticket-management-api-rest-specification-r19-0-0/)
- [TMF678 Customer Bill API](https://www.tmforum.org/oda/open-apis/directory/customer-bill-management-api-TMF678/v5.0)
- [Offline-First Architecture for Enterprise](https://www.ianhafkenschiel.com/blog/offline-first-architecture-enterprise-mobile/)
- [BFF Pattern](https://samnewman.io/patterns/architectural/bff/)
- [CSG BSS/OSS Architecture](https://www.csgi.com/insights/understanding-bss-oss-architecture/)
- [Ericsson BSS](https://www.ericsson.com/en/oss-bss)
