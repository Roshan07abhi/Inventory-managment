import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    // Lazy expiry: if the reservation is pending and past expiresAt, release it now
    const reservation = await prisma.$transaction(async (tx) => {
      const r = await tx.reservation.findUnique({
        where: { id },
        include: { product: true, warehouse: true },
      });

      if (!r) return null;

      if (r.status === "pending" && r.expiresAt < new Date()) {
        // Release it
        await tx.$executeRaw`
          UPDATE "StockLevel"
          SET "reservedUnits" = "reservedUnits" - ${r.quantity}
          WHERE "productId"   = ${r.productId}
            AND "warehouseId" = ${r.warehouseId}
        `;
        return tx.reservation.update({
          where: { id },
          data: { status: "released" },
          include: { product: true, warehouse: true },
        });
      }

      return r;
    });

    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    return NextResponse.json(reservation);
  } catch (error) {
    console.error("[GET /api/reservations/:id]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
