import { ReservationCheckout } from "@/components/ReservationCheckout";

export default function ReservationPage({ params }: { params: { id: string } }) {
  return <ReservationCheckout reservationId={params.id} />;
}
