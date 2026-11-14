import { ShiftAllocationScreen } from "@/components/shift-allocation-screen";

export default async function AllocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ShiftAllocationScreen id={id} />;
}
