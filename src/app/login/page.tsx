import { Handshake, MapPinned, Radio, Truck } from "lucide-react";

import { LoginForm } from "@/app/login/login-form";

const FEATURES = [
  {
    icon: Truck,
    title: "Araç & filo yönetimi",
    sub: "Tır, kamyon, kamyonet, panelvan",
  },
  {
    icon: Handshake,
    title: "Teklif & sözleşme",
    sub: "Hızlı fiyatlandırma ve onay",
  },
  {
    icon: MapPinned,
    title: "Uçtan uca izlenebilirlik",
    sub: "Yüklemeden teslimata kadar",
  },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* LEFT: form */}
      <LoginForm callbackUrl={callbackUrl ?? ""} />

      {/* RIGHT: brand panel (desktop only) */}
      <div className="relative hidden overflow-hidden bg-[#1e1e1e] lg:flex lg:flex-col lg:justify-center lg:p-16">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(115deg,#242424,#242424_26px,#2c2c2c_26px,#2c2c2c_52px)]" />
        <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(24,24,24,0.55),rgba(24,24,24,0.9))]" />

        <div className="relative max-w-[420px]">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-[13px] font-semibold text-white">
            <Radio className="size-[15px] text-[#f5b301]" />
            Canlı sevkiyat takibi
          </div>
          <h2 className="mb-4.5 text-[38px] font-extrabold leading-[1.15] tracking-tight text-white">
            Filonuzun tamamı tek ekranda
          </h2>
          <p className="mb-10 text-base leading-relaxed text-white/75">
            Yük ilanı, teklif, araç–sürücü ataması ve teslimatı uçtan uca
            yönetin. Her adımı gerçek zamanlı izleyin.
          </p>

          <div className="flex flex-col gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-center gap-3.5 text-white">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/12">
                  <f.icon className="size-[22px] text-[#f5b301]" />
                </span>
                <div>
                  <div className="text-[15px] font-bold">{f.title}</div>
                  <div className="text-[13.5px] text-white/60">{f.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
