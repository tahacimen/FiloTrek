"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";

import { loginAction } from "@/app/login/actions";
import { Logo } from "@/components/logo";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [error, formAction, isPending] = useActionState(
    loginAction.bind(null, callbackUrl),
    undefined
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex min-h-screen flex-col px-6 py-8 sm:px-10">
      <Link
        href="/"
        className="mb-auto inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Ana sayfaya dön
      </Link>

      <div className="mx-auto w-full max-w-[400px]">
        <Logo className="mb-8 h-9 w-auto" />
        <h1 className="mb-2 text-[30px] font-extrabold tracking-tight">
          Tekrar hoş geldiniz
        </h1>
        <p className="mb-8 text-[15px] leading-relaxed text-muted-foreground">
          Filo ve sevkiyatlarınızı yönetmek için hesabınıza giriş yapın.
        </p>

        <form action={formAction} className="flex flex-col">
          <label
            htmlFor="email"
            className="mb-1.5 block text-[13.5px] font-semibold text-foreground/80"
          >
            E-posta adresi
          </label>
          <div className="mb-4.5 flex items-center gap-2.5 rounded-xl border-[1.5px] border-input bg-background px-3.5 py-3 transition-colors focus-within:border-primary">
            <Mail className="size-[18px] shrink-0 text-muted-foreground" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="ornek@firma.com"
              className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/70"
            />
          </div>

          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="text-[13.5px] font-semibold text-foreground/80">
              Şifre
            </label>
            <Link href="/login" className="text-[13px] font-semibold text-brand">
              Şifremi unuttum
            </Link>
          </div>
          <div className="mb-6 flex items-center gap-2.5 rounded-xl border-[1.5px] border-input bg-background px-3.5 py-3 transition-colors focus-within:border-primary">
            <Lock className="size-[18px] shrink-0 text-muted-foreground" />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              placeholder="••••••••••"
              className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/70"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
            >
              {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
            </button>
          </div>

          {error && (
            <p className="mb-4 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-brand px-4 py-3.5 text-base font-bold text-brand-foreground shadow-[0_12px_26px_rgba(239,116,32,0.32)] transition hover:bg-brand/90 disabled:opacity-60"
          >
            {isPending && <Loader2 className="size-[18px] animate-spin" />}
            Panele Giriş Yap
            {!isPending && <ArrowRight className="size-[18px]" />}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          Hesabınız yok mu?{" "}
          <Link href="/#iletisim" className="font-bold text-primary">
            Demo talep edin
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-auto pt-8 text-center text-[12.5px] text-muted-foreground">
        © 2026 Tırpark · B2B Lojistik ve Filo Yönetimi
      </div>
    </div>
  );
}
