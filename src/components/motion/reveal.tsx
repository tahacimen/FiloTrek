"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

/**
 * Scroll-reveal sarmalayıcı: içerik görünüme girene kadar hafifçe aşağıda ve
 * saydam durur, girince yumuşakça belirir (globals.css'teki .logigo-reveal).
 *
 * Tasarım kararları:
 * - IntersectionObserver yoksa (çok eski tarayıcı) veya efekt başlatılamazsa
 *   içerik hemen görünür kılınır — hiçbir koşulda "gizli kalıp kaybolma" yok.
 * - `delay` ile sıralı (staggered) giriş; aynı satırdaki kartlar peş peşe
 *   belirir. Inline style CSP'de style-src 'unsafe-inline' ile serbest.
 * - Bir kez göründükten sonra gözlemci bırakılır (tek yönlü, geri gizlenmez).
 */
export function Reveal({
  children,
  as: Tag = "div",
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Gözlemci kurulamıyorsa (çok eski tarayıcı) hemen göster — güvenli
    // varsayılan. Effect gövdesinde senkron setState yerine bir sonraki
    // tick'e erteliyoruz (cascading render uyarısını önler).
    if (typeof IntersectionObserver === "undefined") {
      const t = setTimeout(() => setVisible(true), 0);
      return () => clearTimeout(t);
    }

    // threshold 0 = elemanın herhangi bir pikseli görünür olur olmaz tetikle.
    // Negatif rootMargin bilinçli olarak yok: aksi halde en alttaki (ya da
    // sıfır yükseklikli/boş) bir kart tetikleme bandına hiç giremeyip kalıcı
    // olarak gizli kalabiliyordu. Erken birkaç pikselde belirme, gizli
    // kalmaktan her zaman iyidir.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`logigo-reveal ${visible ? "is-visible" : ""} ${className}`.trim()}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
