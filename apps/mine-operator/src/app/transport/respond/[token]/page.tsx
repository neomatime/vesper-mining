/**
 * The page a transporter opens from the link in a collection request, to confirm a collection time or decline. It needs no
 * sign-in; the token in the address identifies the request.
 */
import type { Metadata } from "next";
import { TransportResponseScreen } from "@/components/transport-response-screen";

export const metadata: Metadata = { title: "Collection request" };

export default async function TransportRespondPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <TransportResponseScreen token={token} />;
}
