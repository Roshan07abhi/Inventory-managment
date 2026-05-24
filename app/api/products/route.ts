import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        stockLevels: {
          include: {
            warehouse: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Compute available stock = totalUnits - reservedUnits
    const result = products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      sku: p.sku,
      imageUrl: p.imageUrl,
      stockLevels: p.stockLevels.map((sl) => ({
        warehouseId: sl.warehouseId,
        warehouseName: sl.warehouse.name,
        warehouseLocation: sl.warehouse.location,
        totalUnits: sl.totalUnits,
        reservedUnits: sl.reservedUnits,
        availableUnits: sl.totalUnits - sl.reservedUnits,
      })),
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/products]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
