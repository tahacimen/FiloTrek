import Image from "next/image";

/** The full horizontal FiloTrek lockup (icon + wordmark) — shared by every header across dashboard/driver/gate. */
export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/logo-full.png"
      alt="FiloTrek"
      width={1400}
      height={305}
      priority
      className={className}
    />
  );
}
