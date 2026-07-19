"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Mail } from "lucide-react";

import { loginAction } from "@/app/login/actions";

/**
 * The real, working login form embedded in the landing hero card — replaces
 * the old decorative (non-functional) placeholder fields. Reuses the exact
 * same server action as /login; an empty callbackUrl lets loginAction pick the
 * account-type default target (dashboard / driver / gate).
 */
export function HeroLoginForm() {
  const [error, formAction, isPending] = useActionState(
    loginAction.bind(null, ""),
    undefined
  );

  const fieldWrap =
    "flex items-center gap-2 rounded-[10px] border-[1.5px] border-[#e2ddd4] px-3 py-2.5 transition-colors focus-within:border-[#f5b301]";
  const inputCls =
    "w-full bg-transparent text-sm text-[#1a1a1a] outline-none placeholder:text-[#9aa2b5]";

  return (
    <form action={formAction}>
      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="hero-email"
            className="mb-1.5 block text-[12.5px] font-medium text-[#6b7488]"
          >
            E-posta
          </label>
          <div className={fieldWrap}>
            <Mail className="size-4 shrink-0 text-[#9aa2b5]" />
            <input
              id="hero-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="ornek@firma.com"
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="hero-password"
            className="mb-1.5 block text-[12.5px] font-medium text-[#6b7488]"
          >
            Şifre
          </label>
          <div className={fieldWrap}>
            <input
              id="hero-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className={`${inputCls} tracking-widest`}
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="mb-2 text-[13px] font-medium text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-[#1e1e1e] px-4 py-3 text-[15px] font-semibold text-white transition hover:bg-[#0a0a0a] disabled:opacity-60"
        >
          {isPending ? (
            <Loader2 className="size-[17px] animate-spin" />
          ) : (
            <>
              Giriş Yap <ArrowRight className="size-[17px]" />
            </>
          )}
        </button>
        <Link href="/login" className="text-[13.5px] leading-tight text-[#6b7488]">
          Şifremi
          <br />
          unuttum
        </Link>
      </div>
    </form>
  );
}
