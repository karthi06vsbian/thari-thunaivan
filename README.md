# thari-thunaivan

**TextileFlow** – mill management for a 50-machine weaving unit: machine status, order
planning with a machine recommendation engine, shift production logs, daily electricity
tracking and batch costing. Built with Next.js 15 (App Router), Firebase (Auth +
Firestore) and shadcn/ui.

## Run it locally

Needs Node 22+ and Java 21+ (for the Firebase emulators). No Firebase account is needed.

```bash
npm install
npm run dev:local
```

This starts the Auth and Firestore emulators, seeds a demo mill the first time, and
serves the app at http://localhost:3000. Data is kept in `.emulator-data/` between runs.

Sign in with one of the seeded test users. The password for all four is
`SEED_USER_PASSWORD` in `.env.emulator`.

| Email | Role | Can use |
|---|---|---|
| owner@textileflow.test | owner | everything |
| manager@textileflow.test | manager | everything except WhatsApp |
| production@textileflow.test | production | overview, production logs |
| accounts@textileflow.test | accounts | overview, electricity, orders & costing |

Other commands:

```bash
npm test                 # unit tests (planning engine, energy, costing, alerts)
npm run typecheck
npm run lint
npm run seed -- --force  # wipe and reseed (emulators must be running: npm run emulators)
```

## What is in the app

| Page | What it does |
|---|---|
| `/admin` | Machines running today, utilization %, today's electricity cost, alerts, recent activity |
| `/admin/machines` | Card per machine coloured by status, with current batch, today's output and efficiency. Filter by type/status, change status, schedule maintenance |
| `/admin/planning` | Pick an order → "N of 50 machines needed, finishes on …, est. kWh ≈ ₹…", the chosen machines, a day-by-day table of machines used and electricity, alternatives, and a machines × days timeline. Nothing is assigned until **Apply plan** is clicked |
| `/admin/production-logs` | Shift-wise entry grid for all machines (running hours, output, breakdown hours) with **Copy yesterday** |
| `/admin/electricity` | Daily meter reading entry, rate settings with history, KPIs, 30-day charts, top 10 machines by energy per meter, monthly summary for checking the bill |
| `/admin/orders` | Batches with machines, progress, power cost, cost per meter and profit |
| `/` | Public company website with an enquiry form |
| `/portal` | Client area: customers sign in with Google, place an order and follow its status, progress and expected finish |
| `/admin/whatsapp` | Try the owner menu, trigger the daily summary and alert check, see the outbox |

### Client orders

Customers register or log in at `/login` (email and password, or Google); staff sign
in separately at `/admin/login`. Anyone who registers becomes a **client** and can only see `/portal` and
their own orders. An order placed there is a *request*: the owner gets a WhatsApp
message, and the owner or manager accepts it (setting the price per meter) or declines
it on the Orders page. Accepted orders get a batch and show up in Planning. Staff roles
are never given by registering; they are only created with `npm run create-user`.
On the emulators the login page has a **Demo client** button for testing this.

### How the recommendation works (`lib/planning/allocate.ts`)

1. **Eligible machines**: active, supports the fabric, wide enough, not in
   maintenance/breakdown, not due for maintenance before the deadline.
2. **Availability**: a machine is only used on working days (weekly offs and holidays
   excluded) when no other planned or running batch holds it.
3. **Ranking**: effective rate (rated m/hr × efficiency, high is better), energy per
   meter (low is better) and recent breakdown hours (low is better).
4. **Selection**: machines are added in rank order until their capacity before the
   deadline covers the order.
5. **Output**: machines needed, meters per machine per day, finish date, kWh and
   electricity cost per day and in total, power cost per meter.
6. **Alternatives**: minimum machines, fastest finish with every free machine, with an
   overtime shift (4 extra hours a day). If the deadline is impossible it reports the
   shortfall in meters, the earliest possible date and which batches hold the machines.

### How electricity is worked out

- Machine units are estimated as `powerKw × runningHours × loadFactor`.
- When the day's main meter reading is entered, the estimates are reconciled with it:
  if they add up to more than the meter they are scaled down proportionally; if they add
  up to less, the remainder is recorded as **common load** (lighting, compressors, AC).
- Each machine's energy for the day is split across its logs by running hours, so a
  batch's power cost is exactly the energy used during the hours logged against it.
  That feeds batch cost per meter and profit.
- Machine efficiency is a rolling 30-day average of actual output ÷ (rated output ×
  running hours), updated whenever logs are saved.

### WhatsApp

Owner menu: `Machine status`, `Electricity today`, `Plan order <orderNo>`, `Summary`.
Alerts: machine breakdown, utilization below 60%, electricity cost per meter more than
15% above the 30-day average, order at risk of missing its deadline.

Without WhatsApp Cloud API credentials every message is only written to the
`whatsappOutbox` collection, which is what the WhatsApp page shows. To connect it, set
the `WHATSAPP_*` variables from `.env.example` and point the Meta webhook at
`/api/whatsapp`. Only phone numbers stored on owner users get replies.

Scheduled jobs (`vercel.json`): `/api/cron/daily-summary` at 8 PM IST and
`/api/cron/alerts` hourly. Both require `Authorization: Bearer $CRON_SECRET`.

## Running against the real Firebase project

The project `thari-thunaivan` (Firestore in `asia-south1`, email/password sign-in on,
rules deployed) is already set up, and its public web config is in `.env.local`.

1. **Service account key** (once): Firebase console → Project settings → Service
   accounts → *Generate new private key*. Paste the whole JSON on one line, in single
   quotes, as `FIREBASE_SERVICE_ACCOUNT_KEY` in `.env.local`. Keep this file private;
   it is ignored by git.
2. **Demo data** (optional): `npm run seed:firebase -- --target=thari-thunaivan`
3. **First login**: `npm run create-user -- --email=you@example.com --name="Your Name" --role=owner`
   prints a one-time link where you choose your password. Repeat for other staff with
   `--role=manager|production|accounts`.
4. `npm run dev` and open http://localhost:3000.

`npm run dev` uses the real project (`.env.local`); `npm run dev:local` always uses the
emulators (`.env.emulator`) and never touches real data. Browsers get no direct
database access: all reads and writes go through server code that checks the signed-in
user's role. To redeploy rules: `npx firebase deploy --only firestore`.

When hosting the app, set the same variables as `.env.local` (see `.env.example`) in
the host's environment.

## Not built yet

- Orders, batches, roles and audit logs here are minimal versions, enough for planning
  and costing to work. Order entry, customers, invoices and stock are not included.
- Per-machine energy meters: `energyMeterId` is stored but no measured readings are
  captured, so all machine energy is estimated and reconciled to the main meter.
- Shift and holiday settings are read from `settings/shifts`; there is no screen to
  edit them yet.

## Optional future: IoT energy and run status

Manual logs and estimated energy could be replaced by live data:

- **Per-machine energy meters** (Modbus/RS485) read by a gateway, or
- **ESP32 + CT sensors** on each machine,

posting kWh and run status once a minute to an `/api/iot` endpoint. That endpoint would
authenticate each device, write `machineEnergy` as *measured* (measured units are never
scaled; only the remaining estimates are reconciled to the main meter – the code already
supports this), derive running/idle hours for `machineLogs`, and set machine status and
breakdown alerts automatically.


