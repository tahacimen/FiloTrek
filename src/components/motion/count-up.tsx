"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Görünüme girince 0'dan hedefe sayan animasyonlu sayaç (istatistik kartları).
 * requestAnimationFrame + easeOutCubic ile; ek kütüphane yok.
 *
 * - Görünürlük IntersectionObserver ile tetiklenir, bir kez oynatılır.
 * - prefers-reduced-motion açıksa animasyon atlanır, hedef değer direkt yazılır.
 * - prefix/suffix ile "%98", "12 dk", "500+" gibi biçimler desteklenir; suffix
 *   ayrı bir className alabildiği için "+" marka renginde vurgulanabilir.
 */
export function CountUp({
  to,
  prefix = "",
  suffix = "",
  suffixClassName = "",
  duration = 1400,
  className = "",
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  suffixClassName?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced =
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;

    const run = () => {
      if (started.current) return;
      started.current = true;
      if (reduced || typeof requestAnimationFrame === "undefined") {
        setValue(to);
        return;
      }
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setValue(Math.round(eased * to));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    if (typeof IntersectionObserver === "undefined") {
      run();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            run();
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [to, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value}
      {suffix && <span className={suffixClassName}>{suffix}</span>}
    </span>
  );
}
