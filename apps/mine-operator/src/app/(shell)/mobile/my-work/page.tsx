/**
 * Route page. Renders the phone's My work tab.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { MobileFieldScreen } from "@/components/mobile-field-screen";
export default function MyWorkPage() { return <MobileFieldScreen kind="my-work" />; }
