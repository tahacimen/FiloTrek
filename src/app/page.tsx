import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  Clock,
  Container,
  Forklift,
  Globe,
  Handshake,
  LogIn,
  Mail,
  MapPin,
  MapPinned,
  MessageCircle,
  Package,
  Phone,
  Route,
  Search,
  Send,
  Snowflake,
  Truck,
  Zap,
} from "lucide-react";

import { Logo } from "@/components/logo";

// Forces per-request rendering rather than a build-time static export — this
// page has no dynamic data of its own, but the strict CSP in proxy.ts stamps
// a fresh nonce on every response, and Next.js can only tag this page's own
// <script> tags with that nonce if it actually re-renders per request. A
// statically-generated version of this page bakes in whatever (non-matching)
// nonce existed at build time, which the browser then rejects at runtime —
// confirmed via a real production build + Playwright run: every script on a
// static "/" 404'd its CSP check while every other (already-dynamic, e.g.
// auth-gated) route passed.
export const dynamic = "force-dynamic";

const NAV_LINKS = [
  { href: "#nasil", label: "Nasıl Çalışır" },
  { href: "#hizmetler", label: "Hizmetler" },
  { href: "#hakkimizda", label: "Hakkımızda" },
  { href: "#iletisim", label: "İletişim" },
];

const STEPS = [
  { n: 1, title: "Talebinizi alıyoruz", icon: Package },
  { n: 2, title: "Fiyat hesaplar, teklif sunarız", icon: Handshake },
  { n: 3, title: "Sözleşme imzalanır", icon: Clock },
  { n: 4, title: "Araç atanır, işe başlanır", icon: Truck },
  { n: 5, title: "Canlı sevkiyat takibi", icon: MapPinned },
  { n: 6, title: "Teslimat & ödeme tamamlanır", icon: CalendarCheck, brand: true },
];

const SERVICES = [
  { label: "Parsiyel Taşımacılık", icon: Package },
  { label: "Soğuk Zincir (Frigorifik)", icon: Snowflake },
  { label: "Konteyner Taşımacılığı", icon: Container },
  { label: "Proje & Ağır Yük", icon: Forklift },
  { label: "Ekspres Gönderi", icon: Zap, brand: true },
];

const STATS = [
  { value: "500+", label: "aktif firma", sub: "tedarikçi ve müşteri tek platformda" },
  { value: "12 dk", label: "ortalama eşleşme", sub: "yük ilanından araç atamasına" },
  { value: "%98", label: "müşteri memnuniyeti", sub: "zamanında ve eksiksiz teslimat" },
  { value: "7/24", label: "canlı takip", sub: "sürücü, araç ve sevkiyat izleme" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-[#151a29]">
      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-[#e7ebf3] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-[74px] max-w-[1240px] items-center gap-6 px-5 sm:px-8">
          <Link href="/" className="shrink-0">
            <Logo className="h-8 w-auto" />
          </Link>
          <nav className="ml-2 hidden items-center gap-7 text-[15px] font-medium text-[#3d4560] lg:flex">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-[#123a8a]">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3.5">
            <span className="hidden items-center gap-1.5 text-sm font-semibold text-[#123a8a] sm:flex">
              <Phone className="size-4" />
              0850 840 00 00
            </span>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-[#ef7420] px-5 py-2.5 text-[15px] font-semibold text-white shadow-[0_6px_16px_rgba(239,116,32,0.28)] transition hover:bg-[#e0680f]"
            >
              <LogIn className="size-[17px]" />
              Giriş Yap
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden bg-[#0d2a63]">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(115deg,#12306e,#12306e_22px,#15366f_22px,#15366f_44px)]" />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,#0d2a63_34%,rgba(13,42,99,0.72)_52%,rgba(13,42,99,0.15)_82%)]" />
        <div className="relative mx-auto max-w-[1240px] px-5 pb-16 pt-12 sm:px-8 sm:pb-[72px] sm:pt-14">
          <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <h1 className="max-w-[640px] text-[34px] font-extrabold leading-[1.08] tracking-tight text-white sm:text-[52px]">
              Türkiye&apos;nin B2B filo ve yük yönetim platformu
            </h1>
            <p className="max-w-[250px] text-[14.5px] leading-relaxed text-white/70 md:text-right">
              Tedarikçi ve müşteri firmaları tek panelde buluşturur; yükünüzü
              doğru araçla saniyeler içinde eşleştirir.
            </p>
          </div>

          <div className="grid max-w-[1010px] gap-5 lg:grid-cols-[1fr_340px]">
            {/* login card */}
            <div className="rounded-2xl bg-white p-6 shadow-[0_24px_60px_rgba(6,20,54,0.38)] sm:p-7">
              <div className="mb-4 flex items-center gap-2 text-[19px] font-bold text-[#151a29]">
                <Truck className="size-5 text-[#123a8a]" />
                Sisteme Giriş Yap
              </div>
              <div className="mb-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <span className="mb-1.5 block text-[12.5px] font-medium text-[#6b7488]">
                    E-posta
                  </span>
                  <div className="flex items-center gap-2 rounded-[10px] border-[1.5px] border-[#dde3ee] px-3 py-2.5 text-[#9aa2b5]">
                    <Mail className="size-4" />
                    <span className="text-sm">ornek@firma.com</span>
                  </div>
                </div>
                <div>
                  <span className="mb-1.5 block text-[12.5px] font-medium text-[#6b7488]">
                    Şifre
                  </span>
                  <div className="flex items-center gap-2 rounded-[10px] border-[1.5px] border-[#dde3ee] px-3 py-2.5 text-[#9aa2b5]">
                    <span className="text-sm tracking-widest">••••••••</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/login"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-[#123a8a] px-4 py-3 text-[15px] font-semibold text-white transition hover:bg-[#0f3277]"
                >
                  Panele Giriş <ArrowRight className="size-[17px]" />
                </Link>
                <Link href="/login" className="text-[13.5px] leading-tight text-[#6b7488]">
                  Şifremi
                  <br />
                  unuttum
                </Link>
              </div>
              <div className="mt-4 border-t border-[#eef1f7] pt-3.5 text-[13.5px] text-[#6b7488]">
                Hesabınız yok mu?{" "}
                <a href="#iletisim" className="font-semibold text-[#ef7420]">
                  Demo talep edin →
                </a>
              </div>
            </div>

            {/* right column */}
            <div className="flex flex-col gap-3.5">
              <a
                href="#iletisim"
                className="rounded-2xl bg-[#ef7420] p-5 text-white shadow-[0_18px_40px_rgba(239,116,32,0.35)] transition hover:bg-[#e0680f]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[17px] font-bold">Demo Talep Et</span>
                  <CalendarCheck className="size-[22px]" />
                </div>
                <div className="mt-1 text-[13px] text-white/85">
                  Ücretsiz 14 gün deneyin
                </div>
              </a>
              <div className="rounded-2xl bg-white p-5 shadow-[0_16px_40px_rgba(6,20,54,0.3)]">
                <div className="mb-2.5 flex items-center gap-2 text-[15px] font-bold text-[#151a29]">
                  <MapPin className="size-[18px] text-[#123a8a]" />
                  Sevkiyat Takibi
                </div>
                <div className="flex items-center overflow-hidden rounded-[10px] border-[1.5px] border-[#dde3ee]">
                  <span className="flex-1 px-3 py-2.5 text-[13.5px] text-[#9aa2b5]">
                    Sevkiyat no. girin
                  </span>
                  <button
                    type="button"
                    className="flex items-center bg-[#123a8a] px-3.5 py-3 text-white"
                    aria-label="Sevkiyat ara"
                  >
                    <Search className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-b border-[#e7ebf3] bg-[#f5f7fb]">
        <div className="mx-auto grid max-w-[1240px] grid-cols-2 gap-y-8 px-5 py-12 sm:px-8 md:grid-cols-4 md:gap-6">
          {STATS.map((s, i) => (
            <div
              key={s.label}
              className={`text-center ${i > 0 ? "md:border-l md:border-[#e2e7f0]" : ""}`}
            >
              <div className="text-[38px] font-extrabold leading-none tracking-tight text-[#123a8a] sm:text-[48px]">
                {s.value.includes("+") ? (
                  <>
                    {s.value.replace("+", "")}
                    <span className="text-[#ef7420]">+</span>
                  </>
                ) : (
                  s.value
                )}
              </div>
              <div className="mt-1 text-[15px] font-bold text-[#2a3350]">{s.label}</div>
              <div className="mt-1.5 text-[13px] leading-snug text-[#7b8399]">{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* NASIL ÇALIŞIR */}
      <section id="nasil" className="bg-white">
        <div className="mx-auto max-w-[1240px] px-5 py-16 sm:px-8">
          <div className="inline-flex items-center gap-2 rounded-xl bg-[#123a8a] px-5 py-2.5 text-[19px] font-bold text-white shadow-[0_8px_20px_rgba(18,58,138,0.25)]">
            <Route className="size-5" />
            Nasıl Çalışır
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((step) => (
              <div
                key={step.n}
                className="flex items-center gap-4 rounded-2xl border-[1.5px] border-[#e2e7f0] bg-white p-4 shadow-[0_12px_28px_rgba(20,40,90,0.08)]"
              >
                <div
                  className={`flex size-11 shrink-0 items-center justify-center rounded-full text-[17px] font-extrabold text-white ${
                    step.brand ? "bg-[#ef7420]" : "bg-[#123a8a]"
                  }`}
                >
                  {step.n}
                </div>
                <div className="flex items-center gap-3">
                  <step.icon
                    className={`size-5 ${step.brand ? "text-[#ef7420]" : "text-[#123a8a]"}`}
                  />
                  <span className="text-[15px] font-bold leading-snug text-[#151a29]">
                    {step.title}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HAKKIMIZDA */}
      <section id="hakkimizda" className="bg-[#f5f7fb]">
        <div className="mx-auto grid max-w-[1240px] items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
          <div className="flex aspect-[16/11] items-end justify-center rounded-[18px] bg-[repeating-linear-gradient(45deg,#dde3ee,#dde3ee_14px,#e8ecf4_14px,#e8ecf4_28px)] pb-4 shadow-[0_20px_50px_rgba(20,40,90,0.12)]">
            <span className="font-mono text-xs text-[#8a93a8]">[ filo / depo fotoğrafı ]</span>
          </div>
          <div>
            <div className="mb-3.5 text-[13px] font-bold uppercase tracking-[1.5px] text-[#ef7420]">
              Tırpark Hakkında
            </div>
            <h2 className="mb-4.5 text-[28px] font-extrabold leading-tight tracking-tight text-[#151a29] sm:text-[34px]">
              Lojistiği baştan sona tek panelden yönetin
            </h2>
            <p className="mb-4 text-base leading-relaxed text-[#4a5268]">
              Tırpark, tedarikçi nakliye firmalarını ve yük sahibi müşteri
              işletmeleri tek platformda buluşturan B2B filo yönetim sistemidir.
              Yük ilanı, teklif, sözleşme, araç–sürücü ataması ve teslimat
              sürecini uçtan uca dijitalleştirir.
            </p>
            <p className="mb-6 text-base leading-relaxed text-[#4a5268]">
              Tır, kamyon, kamyonet ve panelvandan oluşan filonuzu;
              sürücülerinizi ve tüm sevkiyatlarınızı canlı olarak izleyin.
              Yüksek kalite ve güvenilirlik standardıyla çalışın.
            </p>
            <div className="flex flex-wrap gap-3.5">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-[10px] bg-[#123a8a] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[#0f3277]"
              >
                Hemen Başla <ArrowRight className="size-[17px]" />
              </Link>
              <a
                href="#iletisim"
                className="inline-flex items-center gap-2 rounded-[10px] border-[1.5px] border-[#cdd6e6] px-6 py-3 text-[15px] font-semibold text-[#123a8a]"
              >
                Bize Ulaşın
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* HIZMETLER */}
      <section id="hizmetler" className="bg-white">
        <div className="mx-auto max-w-[1240px] px-5 py-16 sm:px-8">
          <div className="mb-11 text-center">
            <div className="mb-3 text-[13px] font-bold uppercase tracking-[1.5px] text-[#ef7420]">
              Taşıma Çözümlerimiz
            </div>
            <h2 className="text-[28px] font-extrabold tracking-tight text-[#151a29] sm:text-[34px]">
              Her yüke uygun taşıma tipi
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
            {SERVICES.map((s) => (
              <div key={s.label} className="text-center">
                <div
                  className={`mx-auto mb-4 flex size-[78px] items-center justify-center rounded-[20px] ${
                    s.brand ? "bg-[#fff2e8] text-[#ef7420]" : "bg-[#eef2fb] text-[#123a8a]"
                  }`}
                >
                  <s.icon className="size-[34px]" />
                </div>
                <div className="rounded-[11px] border border-[#e7ebf3] bg-[#f5f7fb] px-2.5 py-3 text-sm font-semibold leading-snug text-[#2a3350]">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="iletisim" className="bg-[#123a8a] text-white">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
          <div>
            <span className="inline-flex rounded-xl bg-white px-3.5 py-2">
              <Logo className="h-[30px] w-auto" />
            </span>
            <p className="mt-4.5 max-w-[260px] text-sm leading-relaxed text-white/70">
              Tedarikçi ve müşteri firmaları buluşturan B2B filo ve yük yönetim
              platformu.
            </p>
            <div className="mt-5 flex gap-2.5">
              {[Globe, MessageCircle, Send].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="flex size-[38px] items-center justify-center rounded-[10px] bg-white/10 hover:bg-white/20"
                >
                  <Icon className="size-[18px]" />
                </a>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-4 text-sm font-bold">Platform</div>
            <div className="flex flex-col gap-2.5 text-sm text-white/70">
              <a href="#nasil" className="hover:text-white">Nasıl Çalışır</a>
              <a href="#hizmetler" className="hover:text-white">Hizmetler</a>
              <a href="#" className="hover:text-white">Fiyatlandırma</a>
              <a href="#iletisim" className="hover:text-white">Demo Talep Et</a>
            </div>
          </div>
          <div>
            <div className="mb-4 text-sm font-bold">Kurumsal</div>
            <div className="flex flex-col gap-2.5 text-sm text-white/70">
              <a href="#hakkimizda" className="hover:text-white">Hakkımızda</a>
              <a href="#" className="hover:text-white">KVKK Politikası</a>
              <a href="#" className="hover:text-white">Kullanım Koşulları</a>
              <a href="#" className="hover:text-white">SSS</a>
            </div>
          </div>
          <div>
            <div className="mb-4 text-sm font-bold">İletişim</div>
            <div className="flex flex-col gap-3 text-sm text-white/80">
              <span className="flex items-center gap-2.5">
                <Phone className="size-4 text-[#ef9a5e]" />0850 840 00 00
              </span>
              <span className="flex items-center gap-2.5">
                <Mail className="size-4 text-[#ef9a5e]" />taha.cimen@tırpark.com
              </span>
              <span className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 text-[#ef9a5e]" />Ümraniye, İstanbul
              </span>
              <span className="flex items-center gap-2.5">
                <Clock className="size-4 text-[#ef9a5e]" />7/24 destek hattı
              </span>
            </div>
          </div>
        </div>
        <div className="border-t border-white/15">
          <div className="mx-auto flex max-w-[1240px] flex-col gap-1 px-5 py-4 text-[13px] text-white/60 sm:flex-row sm:justify-between sm:px-8">
            <span>© 2026 Tırpark. Tüm hakları saklıdır.</span>
            <span>Türkiye genelinde hizmet</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
