"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Warehouse, AlertCircle } from "lucide-react";

interface StockLevel {
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  totalUnits: number;
  reservedUnits: number;
  availableUnits: number;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  sku: string;
  imageUrl: string | null;
  stockLevels: StockLevel[];
}

export function ProductList() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // reserving: { productId-warehouseId -> true }
  const [reserving, setReserving] = useState<Record<string, boolean>>({});
  const [reserveError, setReserveError] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      setLoading(true);
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to load products");
      setProducts(await res.json());
    } catch (e) {
      setError("Could not load products. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReserve(product: Product, stockLevel: StockLevel) {
    const key = `${product.id}-${stockLevel.warehouseId}`;
    setReserving((prev) => ({ ...prev, [key]: true }));
    setReserveError((prev) => ({ ...prev, [key]: "" }));

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Generate a simple idempotency key per attempt
          "Idempotency-Key": `${key}-${Date.now()}`,
        },
        body: JSON.stringify({
          productId: product.id,
          warehouseId: stockLevel.warehouseId,
          quantity: 1,
        }),
      });

      if (res.status === 409) {
        setReserveError((prev) => ({
          ...prev,
          [key]: "Not enough stock — someone just grabbed the last unit.",
        }));
        // Refresh stock counts
        fetchProducts();
        return;
      }

      if (!res.ok) {
        setReserveError((prev) => ({
          ...prev,
          [key]: "Reservation failed. Please try again.",
        }));
        return;
      }

      const reservation = await res.json();
      router.push(`/reservation/${reservation.id}`);
    } finally {
      setReserving((prev) => ({ ...prev, [key]: false }));
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-64 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-destructive p-4 border border-destructive/20 rounded-lg bg-destructive/5">
        <AlertCircle className="h-5 w-5 flex-shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {products.map((product) => (
        <Card key={product.id} className="flex flex-col overflow-hidden">
          {product.imageUrl && (
            <div className="h-48 overflow-hidden bg-muted">
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base leading-snug">{product.name}</CardTitle>
              <Badge variant="outline" className="shrink-0 text-xs font-mono">
                {product.sku}
              </Badge>
            </div>
            {product.description && (
              <CardDescription className="text-xs">{product.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-3">
            <div className="space-y-2">
              {product.stockLevels.map((sl) => {
                const key = `${product.id}-${sl.warehouseId}`;
                const isReserving = reserving[key];
                const errMsg = reserveError[key];
                const available = sl.availableUnits;

                return (
                  <div
                    key={sl.warehouseId}
                    className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Warehouse className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{sl.warehouseName}</p>
                        <p className="text-xs text-muted-foreground">{sl.warehouseLocation}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant={
                          available === 0
                            ? "destructive"
                            : available <= 3
                            ? "warning"
                            : "success"
                        }
                      >
                        {available === 0 ? "Out of stock" : `${available} left`}
                      </Badge>
                      <Button
                        size="sm"
                        disabled={available === 0 || isReserving}
                        onClick={() => handleReserve(product, sl)}
                        className="text-xs h-7 px-2"
                      >
                        {isReserving ? "..." : "Reserve"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Show per-product errors */}
            {product.stockLevels.map((sl) => {
              const key = `${product.id}-${sl.warehouseId}`;
              const errMsg = reserveError[key];
              if (!errMsg) return null;
              return (
                <div
                  key={key}
                  className="flex items-start gap-1.5 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded p-2"
                >
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{errMsg}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
