import type { Metadata } from "next";
import { MyProfileScreen } from "@/components/my-profile-screen";

export const metadata: Metadata = { title: "My profile" };
export default function ProfilePage() { return <MyProfileScreen />; }
