"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  Warehouse,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";

interface Reservation {
  id: string;
  status: "pending" | "confirmed" | "released";
  quantity: number;
  expiresAt: string;
  createdAt: string;
  product: { id: string; name: string; sku: string; imageUrl: string | null };
  warehouse: { id: string; name: string; location: string };
}

function useCountdown(expiresAt: string | null) {
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    if (!expiresAt) return;

    function tick() {
      const diff = Math.max(0, Math.floor((new Date(expiresAt!).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  return { secondsLeft, minutes, seconds };
}

export function ReservationCheckout({ reservationId }: { reservationId: string }) {
  const router = useRouter();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { secondsLeft, minutes, seconds } = useCountdown(
    reservation?.status === "pending" ? reservation.expiresAt : null
  );

  const fetchReservation = useCallback(async () => {
    try {
      const res = await fetch(`/api/reservations/${reservationId}`);
      if (res.status === 404) {
        setError("Reservation not found.");
        return;
      }
      if (!res.ok) throw new Error("Failed to load reservation");
      setReservation(await res.json());
    } catch {
      setError("Could not load reservation. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [reservationId]);

  useEffect(() => {
    fetchReservation();
  }, [fetchReservation]);

  // When the countdown hits 0, re-fetch to get the released status
  useEffect(() => {
    if (reservation?.status === "pending" && secondsLeft === 0) {
      const t = setTimeout(fetchReservation, 1500);
      return () => clearTimeout(t);
    }
  }, [secondsLeft, reservation?.status, fetchReservation]);

  async function handleConfirm() {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/confirm`, {
        method: "POST",
      });

      if (res.status === 410) {
        setActionError("Your reservation has expired. The units have been released back to stock.");
        fetchReservation();
        return;
      }
      if (!res.ok) {
        setActionError("Confirmation failed. Please try again.");
        return;
      }
      setReservation(await res.json());
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/release`, {
        method: "POST",
      });
      if (!res.ok) {
        setActionError("Cancellation failed. Please try again.");
        return;
      }
      setReservation(await res.json());
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="h-64 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-2 text-destructive p-4 border border-destructive/20 rounded-lg bg-destructive/5">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
        <Button variant="ghost" className="mt-4" onClick={() => router.push("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to products
        </Button>
      </div>
    );
  }

  if (!reservation) return null;

  const isExpired =
    reservation.status === "released" ||
    (reservation.status === "pending" && secondsLeft === 0);

  const statusConfig = {
    pending: {
      label: "Pending",
      variant: "warning" as const,
      icon: <Clock className="h-4 w-4" />,
    },
    confirmed: {
      label: "Confirmed",
      variant: "success" as const,
      icon: <CheckCircle2 className="h-4 w-4" />,
    },
    released: {
      label: "Released",
      variant: "secondary" as const,
      icon: <XCircle className="h-4 w-4" />,
    },
  };

  const status = statusConfig[reservation.status];

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to products
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Checkout</CardTitle>
            <Badge variant={status.variant} className="flex items-center gap-1">
              {status.icon}
              {status.label}
            </Badge>
          </div>
          <CardDescription>Reservation #{reservation.id.slice(-8).toUpperCase()}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Product info */}
          <div className="flex gap-4">
            {reservation.product.imageUrl && (
              <img
                src={reservation.product.imageUrl}
                alt={reservation.product.name}
                className="w-20 h-20 rounded-md object-cover bg-muted"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                <Package className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="font-medium">{reservation.product.name}</p>
                  <p className="text-sm text-muted-foreground font-mono">{reservation.product.sku}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Warehouse className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium">{reservation.warehouse.name}</p>
                  <p className="text-xs text-muted-foreground">{reservation.warehouse.location}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between py-3 border-t border-b">
            <span className="text-sm text-muted-foreground">Quantity</span>
            <span className="font-semibold">{reservation.quantity} unit{reservation.quantity !== 1 ? "s" : ""}</span>
          </div>

          {/* Countdown — only show for pending */}
          {reservation.status === "pending" && (
            <div
              className={`rounded-lg p-4 text-center ${
                secondsLeft <= 60
                  ? "bg-destructive/10 border border-destructive/20"
                  : "bg-muted"
              }`}
            >
              <p className="text-xs text-muted-foreground mb-1">Reservation expires in</p>
              <p
                className={`text-4xl font-mono font-bold tabular-nums ${
                  secondsLeft <= 60 ? "text-destructive" : ""
                }`}
              >
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </p>
              {secondsLeft <= 60 && secondsLeft > 0 && (
                <p className="text-xs text-destructive mt-1">Complete your purchase now!</p>
              )}
              {secondsLeft === 0 && (
                <p className="text-xs text-destructive mt-1">Reservation has expired</p>
              )}
            </div>
          )}

          {/* Confirmed state */}
          {reservation.status === "confirmed" && (
            <div className="rounded-lg p-4 bg-green-50 border border-green-200 text-center">
              <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="font-semibold text-green-800">Purchase confirmed!</p>
              <p className="text-sm text-green-700 mt-1">
                Your order has been placed successfully.
              </p>
            </div>
          )}

          {/* Released state */}
          {reservation.status === "released" && (
            <div className="rounded-lg p-4 bg-muted border text-center">
              <XCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="font-semibold">Reservation released</p>
              <p className="text-sm text-muted-foreground mt-1">
                The units have been returned to available stock.
              </p>
            </div>
          )}

          {/* Action error */}
          {actionError && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Action buttons — only for pending */}
          {reservation.status === "pending" && secondsLeft > 0 && (
            <div className="flex gap-3">
              <Button
                className="flex-1"
                onClick={handleConfirm}
                disabled={actionLoading}
              >
                {actionLoading ? "Processing..." : "Confirm purchase"}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={actionLoading}
              >
                Cancel
              </Button>
            </div>
          )}

          {/* After terminal state — go back */}
          {(reservation.status !== "pending" || secondsLeft === 0) && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push("/")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to products
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
