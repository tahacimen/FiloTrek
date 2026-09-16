import { redirect } from "next/navigation";

// Public self-registration is closed — accounts are created by the owner only.
// The old application form is gone; anyone landing here is sent to the public
// "Demo Talep Et" lead form instead.
export default function KaydolPage() {
  redirect("/demo");
}
