import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({ where: { id } });

      if (!reservation) {
        throw new NotFoundError();
      }

      if (reservation.status === "released") {
        // Already released — idempotent
        return reservation;
      }

      if (reservation.status === "confirmed") {
        throw new AlreadyConfirmedError();
      }

      // Release: decrement reservedUnits only (stock returns to available)
      await tx.$executeRaw`
        UPDATE "StockLevel"
        SET "reservedUnits" = "reservedUnits" - ${reservation.quantity}
        WHERE "productId"   = ${reservation.productId}
          AND "warehouseId" = ${reservation.warehouseId}
      `;

      return tx.reservation.update({
        where: { id },
        data: { status: "released" },
        include: { product: true, warehouse: true },
      });
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }
    if (error instanceof AlreadyConfirmedError) {
      return NextResponse.json(
        { error: "Cannot release a confirmed reservation" },
        { status: 409 }
      );
    }
    console.error("[POST /api/reservations/:id/release]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

class NotFoundError extends Error {}
class AlreadyConfirmedError extends Error {}
