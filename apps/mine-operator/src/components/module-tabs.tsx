"use client";

/**
 * The tab bars inside two modules. Shift Control has Shifts, Production, Handover, Exceptions and Reports; Shipments has Overview,
 * Mineral Inventory, Shipments, Logistics and History. Tabs are links, so each is a page of its own and the browser's back button
 * works. Task forms (record production, close shift, create shipment) open from a tab and are not tabs themselves.
 */
import { AlertTriangle, ArrowLeftRight, BarChart3, History, Layers, Package, TrendingUp, Truck, UsersRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useFeature } from "./use-entitlements";

type Tab<K extends string> = { key: K; label: string; href: string; icon: LucideIcon };

const shiftTabs: Tab<"shifts" | "production" | "handover" | "exceptions" | "reports">[] = [
  { key: "shifts", label: "Shifts", href: "/shifts", icon: UsersRound },
  { key: "production", label: "Production", href: "/shifts/production", icon: TrendingUp },
  { key: "handover", label: "Handover", href: "/shifts/handover", icon: ArrowLeftRight },
  { key: "exceptions", label: "Exceptions", href: "/shifts/exceptions", icon: AlertTriangle },
  { key: "reports", label: "Reports", href: "/shifts/reports", icon: BarChart3 },
];

const shipmentTabs: Tab<"overview" | "inventory" | "shipments" | "history">[] = [
  { key: "overview", label: "Overview", href: "/shipments", icon: Package },
  { key: "inventory", label: "Mineral Inventory", href: "/shipments/inventory", icon: Layers },
  { key: "shipments", label: "Shipments", href: "/shipments/list", icon: Truck },
  { key: "history", label: "History", href: "/shipments/history", icon: History },
];

function Tabs<K extends string>({ tabs, active, label }: { tabs: Tab<K>[]; active: K; label: string }) {
  return (
    <nav className="tabs module-tabs" aria-label={label}>
      {tabs.map(({ key, label: text, href, icon: Icon }) => (
        <Link key={key} href={href} className={`tab ${key === active ? "tab--active" : ""}`} aria-current={key === active ? "page" : undefined}>
          <Icon aria-hidden="true" /> {text}
        </Link>
      ))}
    </nav>
  );
}

export function ShiftControlTabs({ active }: { active: "shifts" | "production" | "handover" | "exceptions" | "reports" }) {
  // Detailed handovers are an Operations capability; without it the tab is not shown.
  const handovers = useFeature("shift_handover");
  return <Tabs tabs={handovers ? shiftTabs : shiftTabs.filter((tab) => tab.key !== "handover")} active={active} label="Shift Control sections" />;
}

export function ShipmentTabs({ active }: { active: "overview" | "inventory" | "shipments" | "history" }) {
  return <Tabs tabs={shipmentTabs} active={active} label="Shipments sections" />;
}
