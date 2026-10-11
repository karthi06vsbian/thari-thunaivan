<div align="center">

# 🧵 Thari Thunaivan (தறி துணைவன்)
### Smart Powerloom Operating System & Digital Textile Ecosystem

**One platform. 50 looms. Smarter production, energy optimization, and real-time client tracking.**

Manage machine status, capacity planning, TANGEDCO Time-of-Day electricity costing, 3-stage quality inspections, Razorpay advance payments, and Meta WhatsApp automation from a single unified operating system.

[![Live Demo](https://img.shields.io/badge/Live_Deployment-thari--thunaivan.vercel.app-0070F3?style=for-the-badge&logo=vercel&logoColor=white)](https://thari-thunaivan.vercel.app)
[![GitHub Repo](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/karthi06vsbian/thari-thunaivan)

[![Next.js](https://img.shields.io/badge/Next.js-15_(App_Router)-black?logo=next.js)](https://nextjs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Razorpay](https://img.shields.io/badge/Razorpay-Online_Payments-0C2340?logo=razorpay&logoColor=white)](https://razorpay.com/)
[![WhatsApp](https://img.shields.io/badge/Meta-WhatsApp_Cloud_API-25D366?logo=whatsapp&logoColor=white)](https://developers.facebook.com/docs/whatsapp/cloud-api)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Tests-41%2F41_Passing-success?logo=vitest&logoColor=white)](https://vitest.dev/)

---

### 🌐 **Live Website:** [https://thari-thunaivan.vercel.app](https://thari-thunaivan.vercel.app)

</div>

---

## 📌 Overview

**Thari Thunaivan (தறி துணைவன் · TextileFlow)** is an end-to-end textile mill operating system designed specifically for **50-machine powerloom clusters** in South India (Erode, Tiruppur, Coimbatore, Salem). It unifies loom scheduling, shift-wise output logs, TANGEDCO Time-of-Day electricity tracking, bundle-level quality inspections, Razorpay advance payments, and customer order visibility into one streamlined platform.

Its automated loom allocation engine helps mill managers determine the exact number of looms an order requires, forecasted delivery dates, and expected power consumption costs—before committing machine capacity to the floor.

> 🎯 **Core Goal:** Eliminate manual coordination, mitigate heavy peak-hour power surcharges, safeguard fabric quality, and provide clients with live 6-stage order tracking straight from WhatsApp.

---

## ✨ Key Features

| Feature | What it does |
|---|---|
| 📊 **Executive Operations Dashboard** | Real-time monitoring of running looms, floor utilization, daily woven meters, ToD power costs, and at-risk delivery alerts. |
| ⚙️ **50-Loom Master Registry** | Live loom status (`running`, `idle`, `maintenance`, `breakdown`), reed widths (48", 63", 72"), RPM, rated output, and maintenance scheduling with automated WhatsApp breakdown alerts. |
| 🧠 **Algorithmic Loom Planning** | Greedy capacity recommendation engine matching fabric types, widths, and deadlines against available looms to build feasible production schedules. |
| ⚡ **Time-of-Day (ToD) Power Costing** | Models industrial TANGEDCO Tariff III-B power billing with 20% peak-hour surcharges (6 PM – 10 PM), off-peak discounts, and solar self-generation offsets. |
| 🧪 **3-Stage Quality Inspection & QR Labels** | Multi-tier inspection evaluating **Raw Material Quality %**, **Yarn Quality %**, and **Fabric Quality %** against ASTM defect thresholds with printable QR code roll labels. |
| 💳 **Razorpay Advance Payments** | Built-in 20% online advance payment calculation with cryptographic HMAC-SHA256 signature verification. |
| 🚚 **Live Transport & Transit Tracking** | Interactive Leaflet 3D transit map tracking dispatches and delivery milestones across Tamil Nadu textile corridors (Erode, Tiruppur, Chennai, Salem). |
| 📱 **6-Stage Client Order Portal** | Self-service customer tracking portal showing yarn prep, loom weaving progress, quality checks, roll packaging, and transit dispatch. |
| 💬 **Meta WhatsApp Cloud AI Bot** | Bi-directional conversational bot on `+91 63832 63198` for instant OTP login, automated breakdown alerts, daily owner summaries, and live `STATUS` tracking. |
| 👥 **Role-Based Access Control (RBAC)** | Strict role segregation for **Owner**, **Manager**, **Production Head**, **Accounts**, and **Client** with secure HTTP-only session cookies. |

---

## 🧰 Tech Stack

- **Full-Stack Framework:** [Next.js 15 (App Router)](https://nextjs.org/) with React Server Components (RSC) and Turbopack
- **Backend Architecture:** Next.js Server Actions (RPC mutations) + REST Webhook Route Handlers
- **Database:** [Google Cloud Firestore](https://firebase.google.com/docs/firestore) configured in REST mode (`preferRest: true`) for serverless reliability
- **Authentication:** [Firebase Authentication](https://firebase.google.com/docs/auth) with secure HTTP-only cookies (`__session`) + WhatsApp OTP
- **Payments:** [Razorpay API & Checkout](https://razorpay.com/) (Standard INR Checkout & Webhooks)
- **Messaging:** [Meta WhatsApp Cloud API (Graph v21.0)](https://developers.facebook.com/docs/whatsapp/cloud-api)
- **Maps & Logistics:** [Leaflet](https://leafletjs.com/) with OpenStreetMap
- **Styling:** Tailwind CSS, OKLCH themes, Lucide Icons, and `@base-ui/react`
- **Testing & Verification:** [Vitest](https://vitest.dev/) (41/41 passing unit & algorithm tests) with strict TypeScript 5.x typing
- **Hosting & Infrastructure:** [Vercel Edge Network](https://vercel.com/) (Mumbai `bom1` region) with scheduled cron tasks

---

## 🗺️ Application Routes

| Route | Purpose | Access |
|---|---|---|
| `/` | Public company landing page, fabric catalog, showcase gallery, and quote inquiry form | Public |
| `/login` | Client phone sign-in (WhatsApp OTP), Google OAuth, and email/password | Clients |
| `/portal` | Client self-service portal: view active orders, place new orders, and submit reviews | Clients |
| `/portal/new` | Multi-step fabric order configurator with live meter pricing and Razorpay advance checkout | Clients |
| `/portal/orders/[orderId]` | Live 6-stage visual production tracker, QC scores, digital invoices, and Leaflet map | Clients |
| `/admin/login` | Staff single sign-on with role authentication and quick demo switcher | Staff |
| `/admin` | Operations overview: plant KPIs, today's output, power spend, and alerts | Staff |
| `/admin/machines` | 50-loom registry, running states, and maintenance scheduling | Staff |
| `/admin/planning` | Interactive Gantt chart schedule, loom capacity calculator, and plan commits | Manager / Owner |
| `/admin/orders` | Customer order approval, batch assignment, and pricing negotiation | Manager / Owner |
| `/admin/production-logs` | Shift A & B meter output, pick counters, running hours, and downtime reasons | Production |
| `/admin/quality` | 3-stage inspection logs, bundle grading, and printable batch QR code labels | Production |
| `/admin/quality/[bundleId]` | Mobile QR inspection scanner page for recording defect measurements | Production |
| `/admin/transport` | Vehicle dispatch management, driver details, and live delivery transit map | Transport / Staff |
| `/admin/electricity` | Daily TANGEDCO meter entry, peak/normal unit consumption, and solar generation logs | Accounts / Owner |
| `/admin/whatsapp` | Meta WhatsApp command center, broadcast logger, and simulated chat terminal | Owner |
| `/api/whatsapp` | Meta WhatsApp Cloud API webhook receiver (challenge handshake & incoming chats) | System / Meta |
| `/api/cron/daily-summary`| Nightly automated cron job dispatching plant production digest to owners via WhatsApp | Vercel Cron |

---

## 🧠 Algorithmic Engines

### 1. Loom Capacity & Planning Engine (`lib/planning/allocate.ts`)
1. **Filters eligible machines** — Excludes inactive looms, machines under maintenance/breakdown, or incompatible reed widths.
2. **Checks calendar availability** — Accounts for standard 6-day working weeks and ongoing active batches.
3. **Ranks candidate looms** — Prioritizes looms based on rated pick speed, historical 30-day efficiency, and lowest breakdown frequency.
4. **Greedy batch allocation** — Assigns optimal machines until cumulative daily meter capacity meets order deadlines.
5. **Generates alternative plans** — Compares fastest-finish, minimum-machine, and overtime alternatives.

### 2. TANGEDCO Time-of-Day (ToD) Electricity Engine (`lib/costing/power.ts`)
- Implements Tamil Nadu industrial **Tariff III-B**:
  - **Base Rate:** ₹8.00 / kWh (`800 paise`)
  - **Peak Surcharge (6:00 PM – 10:00 PM):** ₹9.50 / kWh (`950 paise` — 20% surcharge)
  - **Off-Peak / Concession Rate:** ₹7.20 / kWh (`720 paise` — 10% discount)
  - **Daily Fixed Demand Charge:** ₹1,500.00 / day (`150,000 paise`)
- Reconciles individual machine power estimations (`powerKw × runningHours × loadFactor`) against main energy meters to compute exact cost per woven meter.

### 3. 3-Stage Quality Inspection Engine (`lib/quality-checks.ts`)
- Multi-tier quality percentage scoring:
  - **Raw Material Quality %:** Fiber purity, trash content, and moisture testing.
  - **Yarn Quality %:** Count strength product (CSP), twist per inch (TPI), and unevenness.
  - **Fabric Quality %:** Reed-pick density, GSM measurement, width tolerance, and 4-point defect scoring.
- Enforces strict quality gatekeeping (`MIN_PASS_PERCENT`): bundles falling below the standard are automatically routed to **Rework** or **Fail**.

---

## 💬 WhatsApp Cloud API Integration

The system includes a bi-directional Meta WhatsApp Business bot active on **`+91 63832 63198`**:

- **Automated Alerts:**
  - Machine breakdown notifications sent directly to the owner within seconds.
  - Order approval alerts sent to client phones with direct portal tracking links.
  - Quality inspection summaries dispatched upon bundle approval.
- **Natural Language Chat Keywords:**
  - `STATUS <orderNo>` — Replies with live stage, woven meters %, and dispatch status.
  - `ORDERS` — Lists all open order requests.
  - `RATES` — Returns published fabric rates per meter (Cotton, Silk, Polyester, Blends).
  - `HELP` — Displays available conversational commands.
- **Nightly Owner Digest:** Scheduled at 8:00 PM IST via `/api/cron/daily-summary` summarizing daily meters woven and electricity spend.

---

## 🚀 Run Locally

### Requirements

- Node.js **20 or later**
- Java **21 or later** (only if using local Firebase emulators)

### 1. Clone & Install

```bash
git clone https://github.com/karthi06vsbian/thari-thunaivan.git
cd thari-thunaivan
npm install
```

### 2. Start Local Development

```bash
# Option A: Run with local Firebase Emulators (No cloud account required)
npm run dev:local

# Option B: Run with cloud Firebase project (.env.local configured)
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🔑 Demo Accounts

Use the standard demo password **`password123`** for seeded test accounts:

| Email / ID | Role | Permissions |
|---|---|---|
| `owner@textileflow.test` | **Owner** | Full mill access, financial reports, power tariffs, and WhatsApp broadcasts |
| `manager@textileflow.test` | **Manager** | Order approvals, production planning, and loom scheduling |
| `production@textileflow.test` | **Production** | Shift output logs, machine maintenance, and fabric quality checks |
| `accounts@textileflow.test` | **Accounts** | Daily electricity readings, power costing, and payment verification |

For client testing, visit `/login` and enter any mobile number (e.g., `+91 91790 4348506`) to sign in via WhatsApp OTP or click **Demo client**.

---

## 🧪 Testing & Verification

Run the test suite to verify all algorithmic and cryptographic engines:

```bash
# Run 41/41 Vitest unit tests
npm test

# Run TypeScript type-checker
npm run typecheck

# Run ESLint validation
npm run lint
```

---

## ☁️ Deployment

The application is deployed on the **Vercel Edge Network** with continuous integration on branch `main`.

### Required Environment Variables

```env
# Firebase Cloud Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# Razorpay Payment Gateway
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...

# Meta WhatsApp Cloud API
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_APP_SECRET=...
WHATSAPP_VERIFY_TOKEN=...

# Vercel Cron Security
CRON_SECRET=...
```

---

<div align="center">

**Thari Thunaivan (தறி துணைவன்) — Smarter Looms. Lower Costs. Transparent Textiles.**  
Built for the Tamil Nadu Powerloom Industry. 🧵🇮🇳

</div>
