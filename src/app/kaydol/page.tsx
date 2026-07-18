import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { SignupForm } from "@/app/kaydol/signup-form";

// Same reason as the landing page: the strict per-request CSP nonce in
// proxy.ts only matches this page's own <script> tags if it re-renders per
// request, so opt out of static generation.
export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background px-6 py-8 sm:px-10">
      <Link
        href="/"
        className="mb-auto inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Ana sayfaya dön
      </Link>

      <div className="w-full py-10">
        <SignupForm />
      </div>

      <div className="mt-auto" />
    </div>
  );
}
