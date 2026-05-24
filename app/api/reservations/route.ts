import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateReservationSchema } from "@/lib/schemas";
import { RESERVATION_TTL_MINUTES } from "@/lib/utils";
import { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateReservationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { productId, warehouseId, quantity } = parsed.data;

    // Idempotency: if the client sends an Idempotency-Key, return the existing
    // reservation if one was already created with that key.
    const idempotencyKey = req.headers.get("Idempotency-Key");
    if (idempotencyKey) {
      const existing = await prisma.reservation.findUnique({
        where: { idempotencyKey },
        include: { product: true, warehouse: true },
      });
      if (existing) {
        return NextResponse.json(existing, { status: 200 });
      }
    }

    // -----------------------------------------------------------------------
    // Concurrency-safe reservation using a single atomic UPDATE with a WHERE
    // clause that checks available stock.
    //
    // Strategy:
    //   1. Attempt to increment reservedUnits on the StockLevel row using a
    //      conditional UPDATE:
    //        UPDATE stock_levels
    //        SET reserved_units = reserved_units + $quantity
    //        WHERE product_id = $productId
    //          AND warehouse_id = $warehouseId
    //          AND (total_units - reserved_units) >= $quantity
    //
    //   2. If 0 rows are affected, the stock check failed → 409.
    //   3. If 1 row is affected, create the Reservation row.
    //
    // This avoids a separate SELECT + UPDATE race condition because the check
    // and the increment happen in a single statement that the database executes
    // atomically under row-level locking.
    // -----------------------------------------------------------------------

    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);

    // Use a transaction so the StockLevel update and Reservation insert are
    // committed together or rolled back together.
    const reservation = await prisma.$transaction(async (tx) => {
      // Atomic conditional increment
      const result = await tx.$executeRaw`
        UPDATE "StockLevel"
        SET "reservedUnits" = "reservedUnits" + ${quantity}
        WHERE "productId" = ${productId}
          AND "warehouseId" = ${warehouseId}
          AND ("totalUnits" - "reservedUnits") >= ${quantity}
      `;

      if (result === 0) {
        // Not enough stock — throw so the transaction rolls back
        throw new InsufficientStockError();
      }

      // Create the reservation record
      return tx.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          expiresAt,
          ...(idempotencyKey ? { idempotencyKey } : {}),
        },
        include: { product: true, warehouse: true },
      });
    });

    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      return NextResponse.json(
        { error: "Not enough stock available" },
        { status: 409 }
      );
    }
    // Unique constraint violation on idempotencyKey (race between two identical keys)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.reservation.findUnique({
        where: { idempotencyKey: req.headers.get("Idempotency-Key") ?? undefined },
        include: { product: true, warehouse: true },
      });
      if (existing) return NextResponse.json(existing, { status: 200 });
    }
    console.error("[POST /api/reservations]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

class InsufficientStockError extends Error {
  constructor() {
    super("Insufficient stock");
    this.name = "InsufficientStockError";
  }
}
