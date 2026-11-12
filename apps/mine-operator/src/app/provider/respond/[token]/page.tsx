import type { Metadata } from "next";
import { ProviderResponseScreen } from "@/components/provider-response-screen";

export const metadata: Metadata = { title: "Request for quotation" };

export default async function ProviderRespondPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ProviderResponseScreen token={token} />;
}
