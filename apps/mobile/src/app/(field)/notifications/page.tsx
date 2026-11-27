/**
 * Route page. Renders the phone's notifications tab.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { MobileFieldScreen } from "@/components/mobile-field-screen";
export default function MobileNotificationsPage() { return <MobileFieldScreen kind="notifications" />; }
