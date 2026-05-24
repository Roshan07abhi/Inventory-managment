import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clean up existing data
  await prisma.reservation.deleteMany();
  await prisma.stockLevel.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  // Create warehouses
  const mumbai = await prisma.warehouse.create({
    data: { name: "Mumbai Central", location: "Mumbai, MH" },
  });
  const delhi = await prisma.warehouse.create({
    data: { name: "Delhi North", location: "Delhi, DL" },
  });
  const bangalore = await prisma.warehouse.create({
    data: { name: "Bangalore Hub", location: "Bangalore, KA" },
  });

  // Create products — computer parts
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: "NVIDIA GeForce RTX 4090",
        description: "16384 CUDA cores, 24GB GDDR6X, flagship gaming GPU",
        sku: "GPU-RTX4090-001",
        imageUrl: "https://images.unsplash.com/photo-1591488320449-011701bb6704?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "AMD Ryzen 9 7950X CPU",
        description: "16-core / 32-thread, 5.7GHz boost, AM5 socket",
        sku: "CPU-R9-7950X-002",
        imageUrl: "https://images.unsplash.com/photo-1555617981-dac3880eac6e?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: '27" 4K 144Hz IPS Display',
        description: "3840×2160, 1ms GTG, HDR600, USB-C 90W PD",
        sku: "MON-4K144-003",
        imageUrl: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Corsair Vengeance DDR5 32GB Kit",
        description: "2×16GB, DDR5-6000, CL36, Intel XMP 3.0",
        sku: "RAM-DDR5-32G-004",
        imageUrl: "https://images.unsplash.com/photo-1562976540-1502c2145186?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Samsung 990 Pro 2TB NVMe SSD",
        description: "PCIe 4.0 ×4, 7450MB/s read, 6900MB/s write, M.2 2280",
        sku: "SSD-990PRO-2T-005",
        imageUrl: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "ASUS ROG Maximus Z790 Motherboard",
        description: "Intel Z790, LGA1700, DDR5, PCIe 5.0, WiFi 6E",
        sku: "MB-Z790-ROG-006",
        imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Corsair RM1000x 1000W PSU",
        description: "80+ Gold, fully modular, ATX 3.0, 10-year warranty",
        sku: "PSU-RM1000X-007",
        imageUrl: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Noctua NH-D15 CPU Cooler",
        description: "Dual-tower air cooler, 2× NF-A15 fans, 165mm height",
        sku: "CLR-NHD15-008",
        imageUrl: "https://images.unsplash.com/photo-1587202372616-b43abea06c2a?w=400",
      },
    }),
  ]);

  // Create stock levels
  const stockData = [
    // RTX 4090 — high demand, low stock
    { productId: products[0].id, warehouseId: mumbai.id,    totalUnits: 3  },
    { productId: products[0].id, warehouseId: delhi.id,     totalUnits: 2  },
    { productId: products[0].id, warehouseId: bangalore.id, totalUnits: 1  },
    // Ryzen 9 7950X
    { productId: products[1].id, warehouseId: mumbai.id,    totalUnits: 10 },
    { productId: products[1].id, warehouseId: delhi.id,     totalUnits: 7  },
    { productId: products[1].id, warehouseId: bangalore.id, totalUnits: 5  },
    // 4K Monitor
    { productId: products[2].id, warehouseId: mumbai.id,    totalUnits: 8  },
    { productId: products[2].id, warehouseId: delhi.id,     totalUnits: 6  },
    // DDR5 RAM
    { productId: products[3].id, warehouseId: mumbai.id,    totalUnits: 20 },
    { productId: products[3].id, warehouseId: delhi.id,     totalUnits: 15 },
    { productId: products[3].id, warehouseId: bangalore.id, totalUnits: 12 },
    // Samsung 990 Pro SSD
    { productId: products[4].id, warehouseId: mumbai.id,    totalUnits: 25 },
    { productId: products[4].id, warehouseId: bangalore.id, totalUnits: 18 },
    // Z790 Motherboard
    { productId: products[5].id, warehouseId: mumbai.id,    totalUnits: 6  },
    { productId: products[5].id, warehouseId: delhi.id,     totalUnits: 4  },
    // PSU — intentionally low to demo 409
    { productId: products[6].id, warehouseId: mumbai.id,    totalUnits: 1  },
    { productId: products[6].id, warehouseId: delhi.id,     totalUnits: 0  },
    // CPU Cooler
    { productId: products[7].id, warehouseId: mumbai.id,    totalUnits: 14 },
    { productId: products[7].id, warehouseId: bangalore.id, totalUnits: 9  },
  ];

  await prisma.stockLevel.createMany({ data: stockData });

  console.log(
    `Seeded: ${products.length} products, 3 warehouses, ${stockData.length} stock levels`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
