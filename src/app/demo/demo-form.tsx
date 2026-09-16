"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Truck,
  User,
} from "lucide-react";

import { submitDemoRequestAction, type DemoFormState } from "@/app/demo/actions";
import { Logo } from "@/components/logo";

export function DemoForm() {
  const [state, formAction, isPending] = useActionState<DemoFormState, FormData>(
    submitDemoRequestAction,
    { status: "idle" }
  );

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
          Demo talebiniz bize ulaştı. En kısa sürede sizinle iletişime geçeceğiz.
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
        Demo Talep Et
      </h1>
      <p className="mb-8 text-[15px] leading-relaxed text-muted-foreground">
        Bilgilerinizi bırakın; ekibimiz size özel bir demo için en kısa sürede
        ulaşsın.
      </p>

      <form action={formAction} className="flex flex-col">
        <div>
          <label className={labelCls} htmlFor="fullName">
            Ad Soyad
          </label>
          <div className={fieldWrap}>
            <User className="size-[18px] shrink-0 text-muted-foreground" />
            <input
              id="fullName"
              name="fullName"
              required
              autoComplete="name"
              placeholder="Adınız Soyadınız"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="companyName">
            Firma Adı
          </label>
          <div className={fieldWrap}>
            <Building2 className="size-[18px] shrink-0 text-muted-foreground" />
            <input
              id="companyName"
              name="companyName"
              required
              autoComplete="organization"
              placeholder="Firma adınız"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="phone">
            Telefon
          </label>
          <div className={fieldWrap}>
            <Phone className="size-[18px] shrink-0 text-muted-foreground" />
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              autoComplete="tel"
              placeholder="05xx xxx xx xx"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="email">
            E-posta
          </label>
          <div className={fieldWrap}>
            <Mail className="size-[18px] shrink-0 text-muted-foreground" />
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="ornek@firma.com"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="vehicleCount">
            Araç Sayısı
          </label>
          <div className={fieldWrap}>
            <Truck className="size-[18px] shrink-0 text-muted-foreground" />
            <input
              id="vehicleCount"
              name="vehicleCount"
              type="number"
              min={0}
              required
              placeholder="Filonuzdaki araç sayısı"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="message">
            Mesaj
          </label>
          <div className={`${fieldWrap} items-start`}>
            <MessageSquare className="mt-0.5 size-[18px] shrink-0 text-muted-foreground" />
            <textarea
              id="message"
              name="message"
              rows={3}
              placeholder="İhtiyacınızı kısaca anlatın (opsiyonel)"
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        {state.status === "error" && (
          <p className="mb-4 text-sm font-medium text-destructive" role="alert">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-[15px] font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {isPending && <Loader2 className="size-[18px] animate-spin" />}
          Talebi Gönder
          {!isPending && <ArrowRight className="size-[18px]" />}
        </button>
      </form>
    </div>
  );
}
