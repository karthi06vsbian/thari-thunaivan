<div align="center">

# 🧵 TextileFlow
### Smart Textile Mill Management System

**One platform. 50 machines. Smarter production decisions.**

Manage machine status, production planning, electricity usage and batch costing from a single dashboard.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-FFCA28?logo=firebase&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178C6?logo=typescript&logoColor=white)
![Status](https://img.shields.io/badge/Project-Prototype-7C3AED)

</div>

---

## 📌 Overview

**TextileFlow** is a textile mill management application designed for a **50-machine weaving unit**. It brings machine monitoring, order planning, shift-wise production logs, electricity tracking and batch costing together in one place.

Its machine recommendation engine helps managers estimate how many machines an order needs, when it can finish, and the expected electricity usage and cost—before applying a plan.

> 🎯 **Goal:** Reduce manual coordination, make production planning clearer, and help mill teams track operational costs.

## ✨ Key Features

| Feature | What it does |
|---|---|
| 📊 **Operations Dashboard** | Shows machines running today, utilization, electricity cost, alerts and recent activity. |
| ⚙️ **Machine Management** | View machine status, current batch, daily output and efficiency; filter machines and schedule maintenance. |
| 🧠 **Production Planning** | Recommends eligible machines based on capacity, availability, energy use and breakdown history. |
| 📝 **Shift Production Logs** | Record running hours, output and breakdown hours for each machine. |
| 🧪 **Quality Checks & QR Labels** | Create batch-bundle QR labels and record measurements and test results. |
| ⚡ **Electricity Tracking** | Enter daily meter readings, review usage trends and compare machine energy estimates. |
| 📦 **Batch Costing** | Review production progress, power cost, cost per meter and estimated profit. |
| 🚚 **Transport Tracking** | Track dispatches and delivery progress on sample routes. The map is estimated—not live GPS. |
| 👥 **Role-Based Access** | Provide different access for owners, managers, production staff and accounts staff. |
| 💬 **WhatsApp Alerts** | Prepare owner alerts and summaries; live sending requires WhatsApp Cloud API configuration. |

## 🧰 Tech Stack

- **Frontend:** Next.js 15 App Router, React, shadcn/ui
- **Backend:** Next.js server-side code and API routes
- **Authentication:** Firebase Authentication
- **Database:** Cloud Firestore
- **Messaging integration:** WhatsApp Cloud API (optional configuration)
- **Testing & quality:** Unit tests, TypeScript type-checking and linting

## 🗺️ Application Pages

| Route | Purpose |
|---|---|
| `/` | Public company website and enquiry form |
| `/login` | Client sign-in and registration |
| `/portal` | Client area for order requests and status tracking |
| `/admin/login` | Staff sign-in |
| `/admin` | Main operations overview |
| `/admin/machines` | Machine status and maintenance |
| `/admin/planning` | Order-to-machine planning and alternatives |
| `/admin/production-logs` | Shift-wise production entry |
| `/admin/quality` | Quality checks and QR labels |
| `/admin/transport` | Dispatch and delivery tracking |
| `/admin/electricity` | Meter readings, rates and energy reports |
| `/admin/orders` | Batch progress and costing |
| `/admin/whatsapp` | Owner menu, alert checks and message outbox |

## 🧠 How Machine Planning Works

1. **Filter eligible machines** — exclude inactive, unsuitable, maintenance and breakdown machines.
2. **Check availability** — account for working days and machines already reserved for other batches.
3. **Rank candidates** — consider effective production rate, energy per meter and recent breakdown hours.
4. **Build a plan** — select machines until estimated capacity can cover the order before its deadline.
5. **Show the estimate** — display machines needed, expected finish date, daily/total kWh and electricity cost.
6. **Compare alternatives** — explore minimum-machine, fastest-finish and overtime options. If the deadline cannot be met, show the shortfall and earliest possible finish.

A plan is **not assigned until the user selects “Apply plan.”**

## ⚡ Electricity & Costing Logic

- Estimated machine energy is calculated as `powerKw × runningHours × loadFactor`.
- Daily machine estimates are reconciled against the main meter reading.
- If estimates exceed the main meter, they are scaled proportionally. If they are lower, the remaining usage is recorded as **common load** (for example, lighting and compressors).
- Energy is allocated across a machine’s production logs by running hours. This feeds into batch power cost, cost per meter and profit calculations.
- Machine efficiency uses a rolling 30-day average of actual output compared with rated output for the logged running hours.

> **Note:** Per-machine energy values are estimates at present; individual machine meters are not yet collecting measured readings.

## 💬 WhatsApp Integration

The owner menu supports commands such as:

- `Machine status`
- `Electricity today`
- `Plan order <orderNo>`
- `Summary`

The system can prepare alerts for machine breakdowns, low utilization, unusually high electricity cost per meter and orders at risk of missing their deadline.

**Integration status:** Without WhatsApp Cloud API credentials, messages are written to the Firestore `whatsappOutbox` collection and shown in the WhatsApp page. To enable actual WhatsApp delivery, configure the `WHATSAPP_*` environment variables and point the Meta webhook to `/api/whatsapp`. Replies are restricted to phone numbers stored on owner users.

Scheduled endpoints are configured in `vercel.json`:

- `/api/cron/daily-summary` — 8:00 PM IST
- `/api/cron/alerts` — hourly

Both require `Authorization: Bearer $CRON_SECRET`.

## 🚀 Run Locally

### Requirements

- Node.js **22 or later**
- Java **21 or later** (required by Firebase emulators)

A Firebase account is **not required** for local emulator development.

### Start the app

```bash
npm install
npm run dev:local
```

This starts the Firebase Authentication and Firestore emulators, seeds demo mill data on the first run, and serves the app at **http://localhost:3000**. Emulator data persists in `.emulator-data/` between runs.

### Demo staff accounts

Use the password defined by `SEED_USER_PASSWORD` in `.env.emulator` for the seeded users.

| Email | Role | Access |
|---|---|---|
| `owner@textileflow.test` | Owner | All available features |
| `manager@textileflow.test` | Manager | All available features except WhatsApp |
| `production@textileflow.test` | Production | Overview and production logs |
| `accounts@textileflow.test` | Accounts | Overview, electricity, orders and costing |

For emulator testing, the client login page also provides a **Demo client** option.

### Useful commands

```bash
npm test                 # Run unit tests
npm run typecheck        # Check types
npm run lint             # Run lint checks
npm run emulators        # Start Firebase emulators
npm run seed -- --force  # Reset and reseed demo data (emulators must be running)
```

## 🔐 Use the Real Firebase Project

The configured project is `thari-thunaivan`, with Firestore in `asia-south1`.

1. In Firebase Console, open **Project settings → Service accounts** and generate a private key.
2. Store the complete service-account JSON in the `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable in `.env.local` as instructed by the project configuration.
3. Keep the service-account key private. **Never commit it to Git or share it publicly.**
4. Optionally seed demo data:
   ```bash
   npm run seed:firebase -- --target=thari-thunaivan
   ```
5. Create an owner account:
   ```bash
   npm run create-user -- --email=you@example.com --name="Your Name" --role=owner
   ```
6. Start the real-project configuration:
   ```bash
   npm run dev
   ```
   Then open **http://localhost:3000**.

Create other staff accounts with the `manager`, `production` or `accounts` role as needed. The create-user command provides a one-time link to set a password.

**Important:** `npm run dev` uses the real Firebase configuration in `.env.local`; `npm run dev:local` uses the emulator configuration in `.env.emulator` and does not access real project data. Browser reads and writes go through server code that checks the signed-in user's role.

Before deploying, configure the host environment variables from `.env.local` / `.env.example`. To deploy Firestore rules:

```bash
npx firebase deploy --only firestore
```

## 🧾 Client Order Flow

1. A customer registers or signs in using email/password or Google.
2. The customer submits an order request through `/portal`.
3. The owner receives a WhatsApp notification when the integration is configured.
4. The owner or manager accepts the request and sets the price per meter, or declines it.
5. Accepted orders receive a batch and become available in Production Planning.

New registrations receive **client** access only. Staff roles must be created separately using `npm run create-user`.

## 🛠️ Current Limitations

This README distinguishes working prototype functionality from features that are not complete yet:

- Order, batch, role and audit-log models are minimal versions intended to support planning and costing.
- Full order entry, customer management, invoices and raw-material stock management are not included yet.
- Per-machine energy readings are estimated and reconciled against the main meter; individual meter readings are not currently collected.
- Shift and holiday settings are read from `settings/shifts`, but there is no UI to edit them yet.
- Transport map positions are simulated from time since dispatch; **live GPS tracking is not implemented**.
- Actual WhatsApp delivery requires valid Meta/WhatsApp Cloud API credentials and webhook configuration.

## 🔭 Future Scope: IoT Monitoring

Machine energy and run status could later be collected using Modbus/RS485 energy meters or ESP32 devices with CT sensors. Devices could post readings to an authenticated `/api/iot` endpoint, allowing the application to store measured kWh, derive running/idle hours and trigger machine-status or breakdown alerts automatically.

## 🤝 Contributing

1. Create a branch for your change.
2. Make focused updates and add or update tests where appropriate.
3. Run `npm test`, `npm run typecheck` and `npm run lint`.
4. Open a pull request with a clear summary of the change.

---

<div align="center">

**TextileFlow — clearer planning, smarter production, better visibility.**

Built for modern textile mill operations. 🧵

</div>
