##Live demo
https://inventorymanagement-ruby.vercel.app/
## Screenshots
### Product Listing
<img width="1919" height="881" alt="image" src="https://github.com/user-attachments/assets/3fd6ddcf-916b-45af-8d05-716fde784a5c" />

### Reservation Checkout
<img width="1914" height="874" alt="image" src="https://github.com/user-attachments/assets/a4268c81-50ab-48d0-b21b-c98614b1f0d1" />

### Reservation Confirmed
<img width="1918" height="875" alt="image" src="https://github.com/user-attachments/assets/9ba18f84-c4ec-43a0-a209-957bdbc62027" />

## Running locally

### Prerequisites

- Node.js 18+
- A hosted Postgres instance (Supabase, Neon, or Railway — all have free tiers)

### 1. Clone and install

```bash
git clone <repo>
cd allo-inventory
npm install
```

### 2. Set environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Pooled Postgres connection string (used by the app at runtime) |
| `DIRECT_URL` | Direct (non-pooled) connection string (used by Prisma migrations) |

### 3. Run migrations and seed

```bash
npm run db:generate   # generate Prisma client
npm run db:push       # push schema to the database (dev shortcut)
npm run db:seed       # seed products, warehouses, and stock levels
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Architecture decisions

### Concurrency-safe reservations

The core challenge is preventing two simultaneous requests from both succeeding when only one unit remains.

**Approach: atomic conditional UPDATE**

Instead of a SELECT-then-UPDATE pattern (which has a TOCTOU race), the reservation endpoint issues a single SQL statement:

```sql
UPDATE "StockLevel"
SET "reservedUnits" = "reservedUnits" + $quantity
WHERE "productId"   = $productId
  AND "warehouseId" = $warehouseId
  AND ("totalUnits" - "reservedUnits") >= $quantity
```

Postgres executes this under row-level locking. If two concurrent transactions both attempt this UPDATE on the same row, one will acquire the row lock first, succeed, and commit. The second will then re-evaluate the WHERE clause against the updated row — and if stock is now insufficient, it will update 0 rows. The application checks the affected row count and returns 409 if it is 0.

This is wrapped in a `prisma.$transaction` so the StockLevel update and the Reservation insert are committed atomically.

**Why not Redis distributed locks?**

A Redis lock (e.g. Redlock) would also work, but it introduces an extra network hop and a dependency on Redis availability. The database-level conditional UPDATE is simpler, has fewer moving parts, and is correct by construction — the database is already the source of truth for stock counts.

Redis would be the right choice if the stock check needed to span multiple tables or services, or if we needed sub-millisecond lock acquisition across a sharded database.

### Reservation expiry

Reservations expire through lazy cleanup on read.

Whenever a reservation is fetched, confirmed, or acted upon, the system verifies whether the expiration time has passed. Expired reservations are automatically released and reserved inventory is returned to available stock.

This approach satisfies the expiry requirement while remaining compatible with serverless deployments.

### Data model

```
Warehouse  ──< StockLevel >── Product
                                │
                           Reservation
```

`StockLevel` carries two counters:
- `totalUnits` — physical units in the warehouse
- `reservedUnits` — units currently held by pending reservations

`availableUnits = totalUnits - reservedUnits` is computed on read (not stored), so it's always consistent with the counters.

On **confirm**: both `totalUnits` and `reservedUnits` are decremented (the unit is sold).  
On **release**: only `reservedUnits` is decremented (the unit returns to available stock).

### Idempotency (bonus)

The `POST /api/reservations` and `POST /api/reservations/:id/confirm` endpoints support an optional `Idempotency-Key` header.

- The key is stored on the `Reservation` row with a `@unique` constraint.
- On retry, the server finds the existing reservation by key and returns it with a 200 — no side effects are repeated.
- A unique constraint violation (two concurrent requests with the same key) is caught and resolved by returning the existing row.

This is a lightweight, database-backed approach. With Redis, you could store the full serialised response and replay it exactly (including the original status code), which is more correct for idempotency but adds infrastructure complexity.

---

## Trade-offs and things I'd do differently with more time

| What | Trade-off |
|---|---|
| `reservedUnits` denormalised counter | Fast reads, but must be kept in sync with reservation state. A bug that skips the counter update would cause drift. An alternative is to compute reserved units from a `SUM` of pending reservations — slower but always consistent. |
| No authentication | Any user can reserve or confirm any reservation by ID. In production, reservations would be scoped to a user session. |
| Cron granularity is 1 minute | Vercel Cron minimum is 1 minute. For tighter expiry enforcement, a background worker (e.g. BullMQ + Redis) could process expirations within seconds. |
| No optimistic UI / SWR | The product list re-fetches on mount only. With SWR or React Query, stock counts would stay fresher without manual refresh. |
| Single-unit reserve only | The UI always reserves 1 unit. The API supports arbitrary quantities — a quantity selector would be a small addition. |
| No payment simulation | The "Confirm purchase" button calls the confirm endpoint directly. A real flow would integrate a payment provider and call confirm only on webhook success. |

---

## API reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/products` | List products with available stock per warehouse |
| GET | `/api/warehouses` | List warehouses |
| POST | `/api/reservations` | Reserve units. Body: `{ productId, warehouseId, quantity }`. Returns 409 if insufficient stock. |
| GET | `/api/reservations/:id` | Get reservation (with lazy expiry) |
| POST | `/api/reservations/:id/confirm` | Confirm reservation. Returns 410 if expired. |
| POST | `/api/reservations/:id/release` | Release reservation early |
