import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  // Idempotency
  const idempotencyKey = req.headers.get("Idempotency-Key");

  try {
    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({ where: { id } });

      if (!reservation) {
        throw new NotFoundError();
      }

      if (reservation.status === "confirmed") {
        // Already confirmed — idempotent success
        return reservation;
      }

      if (
        reservation.status === "released" ||
        reservation.expiresAt < new Date()
      ) {
        throw new ExpiredError();
      }

      // Confirm: decrement totalUnits and reservedUnits atomically
      await tx.$executeRaw`
        UPDATE "StockLevel"
        SET
          "totalUnits"    = "totalUnits"    - ${reservation.quantity},
          "reservedUnits" = "reservedUnits" - ${reservation.quantity}
        WHERE "productId"   = ${reservation.productId}
          AND "warehouseId" = ${reservation.warehouseId}
      `;

      return tx.reservation.update({
        where: { id },
        data: { status: "confirmed" },
        include: { product: true, warehouse: true },
      });
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }
    if (error instanceof ExpiredError) {
      return NextResponse.json(
        { error: "Reservation has expired" },
        { status: 410 }
      );
    }
    console.error("[POST /api/reservations/:id/confirm]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

class NotFoundError extends Error {}
class ExpiredError extends Error {}
