/**
 * Route page. Renders the phone's profile tab.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { MobileFieldScreen } from "@/components/mobile-field-screen";
export default function MobileProfilePage() { return <MobileFieldScreen kind="profile" />; }
