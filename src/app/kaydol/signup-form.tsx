"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  Mail,
  Phone,
  User,
} from "lucide-react";

import { submitSignupAction, type SignupFormState } from "@/app/kaydol/actions";
import { Logo } from "@/components/logo";

const ROLES = [
  {
    value: "SUPPLIER_COMPANY",
    title: "Nakliyeci firmayım",
    sub: "Araç filom var, yük taşımak istiyorum",
  },
  {
    value: "CUSTOMER_COMPANY",
    title: "Yük sahibiyim",
    sub: "Yüküm var, taşıyacak araç arıyorum",
  },
];

export function SignupForm() {
  const [state, formAction, isPending] = useActionState<SignupFormState, FormData>(
    submitSignupAction,
    { status: "idle" }
  );
  const [role, setRole] = useState("CUSTOMER_COMPANY");

  if (state.status === "success") {
    return (
      <div className="mx-auto flex w-full max-w-[460px] flex-col items-center py-10 text-center">
        <span className="mb-5 flex size-16 items-center justify-center rounded-full bg-success/15 text-success">
          <CheckCircle2 className="size-8" />
        </span>
        <h1 className="mb-2 text-[26px] font-extrabold tracking-tight">
          Talebiniz alındı
        </h1>
        <p className="mb-8 text-[15px] leading-relaxed text-muted-foreground">
          Kayıt talebiniz ekibimize iletildi. Başvurunuz incelendikten sonra
          hesabınız oluşturulacak ve e-posta adresinize giriş bilgileriniz
          gönderilecektir.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-[15px] font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <ArrowLeft className="size-4" />
          Ana sayfaya dön
        </Link>
      </div>
    );
  }

  const fieldWrap =
    "mb-4 flex items-center gap-2.5 rounded-xl border-[1.5px] border-input bg-background px-3.5 py-3 transition-colors focus-within:border-primary";
  const inputCls =
    "w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/70";
  const labelCls = "mb-1.5 block text-[13.5px] font-semibold text-foreground/80";

  return (
    <div className="mx-auto w-full max-w-[460px]">
      <Logo className="mb-8 h-9 w-auto" />
      <h1 className="mb-2 text-[30px] font-extrabold tracking-tight">
        Yeni kayıt oluştur
      </h1>
      <p className="mb-8 text-[15px] leading-relaxed text-muted-foreground">
        Bilgilerinizi bırakın; başvurunuzu inceleyip hesabınızı oluşturalım.
      </p>

      <form action={formAction} className="flex flex-col">
        <span className={labelCls}>Hesap türü</span>
        <div className="mb-4 grid gap-2.5 sm:grid-cols-2">
          {ROLES.map((r) => (
            <label
              key={r.value}
              className={`cursor-pointer rounded-xl border-[1.5px] p-3.5 transition-colors ${
                role === r.value
                  ? "border-primary bg-primary/5"
                  : "border-input hover:border-primary/40"
              }`}
            >
              <input
                type="radio"
                name="role"
                value={r.value}
                checked={role === r.value}
                onChange={(e) => setRole(e.target.value)}
                className="sr-only"
              />
              <span className="block text-[14.5px] font-bold">{r.title}</span>
              <span className="mt-0.5 block text-[12.5px] leading-snug text-muted-foreground">
                {r.sub}
              </span>
            </label>
          ))}
        </div>

        <label htmlFor="companyName" className={labelCls}>
          Firma adı
        </label>
        <div className={fieldWrap}>
          <Building2 className="size-[18px] shrink-0 text-muted-foreground" />
          <input
            id="companyName"
            name="companyName"
            required
            placeholder="Örnek Lojistik A.Ş."
            className={inputCls}
          />
        </div>

        <label htmlFor="fullName" className={labelCls}>
          Ad soyad
        </label>
        <div className={fieldWrap}>
          <User className="size-[18px] shrink-0 text-muted-foreground" />
          <input
            id="fullName"
            name="fullName"
            required
            placeholder="Adınız Soyadınız"
            className={inputCls}
          />
        </div>

        <label htmlFor="email" className={labelCls}>
          E-posta adresi
        </label>
        <div className={fieldWrap}>
          <Mail className="size-[18px] shrink-0 text-muted-foreground" />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="ornek@firma.com"
            className={inputCls}
          />
        </div>

        <label htmlFor="phone" className={labelCls}>
          Telefon <span className="font-normal text-muted-foreground">(opsiyonel)</span>
        </label>
        <div className={fieldWrap}>
          <Phone className="size-[18px] shrink-0 text-muted-foreground" />
          <input
            id="phone"
            name="phone"
            type="tel"
            placeholder="0500 000 00 00"
            className={inputCls}
          />
        </div>

        <label htmlFor="message" className={labelCls}>
          Mesaj <span className="font-normal text-muted-foreground">(opsiyonel)</span>
        </label>
        <textarea
          id="message"
          name="message"
          rows={3}
          placeholder="Kısaca ihtiyacınızdan bahsedin…"
          className="mb-4 resize-none rounded-xl border-[1.5px] border-input bg-background px-3.5 py-3 text-[15px] outline-none transition-colors focus-within:border-primary placeholder:text-muted-foreground/70"
        />

        {state.status === "error" && (
          <p className="mb-4 rounded-lg bg-destructive/10 px-3.5 py-2.5 text-[13.5px] font-medium text-destructive">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-[15px] font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {isPending ? (
            <>
              <Loader2 className="size-[18px] animate-spin" />
              Gönderiliyor…
            </>
          ) : (
            <>
              Kaydı Gönder <ArrowRight className="size-[17px]" />
            </>
          )}
        </button>

        <p className="mt-4 text-center text-[13.5px] text-muted-foreground">
          Zaten hesabınız var mı?{" "}
          <Link href="/login" className="font-semibold text-brand">
            Giriş yapın
          </Link>
        </p>
      </form>
    </div>
  );
}
