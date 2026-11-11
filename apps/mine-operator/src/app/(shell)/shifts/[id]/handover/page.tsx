import { ShiftDetailScreen } from "@/components/shift-detail-screen";

export default async function HandoverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ShiftDetailScreen id={id} handover />;
}
