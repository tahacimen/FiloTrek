"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, User } from "lucide-react";

import { acceptInvitationAction } from "@/app/davet/[token]/actions";
import { Logo } from "@/components/logo";

export function InvitationAcceptForm({
  token,
  email,
  roleLabel,
}: {
  token: string;
  email: string;
  roleLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(
    acceptInvitationAction.bind(null, token),
    undefined
  );
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const mismatch = passwordConfirm.length > 0 && password !== passwordConfirm;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col justify-center px-6 py-10">
      <Logo className="mb-8 h-9 w-auto" />
      <h1 className="mb-2 text-[28px] font-extrabold tracking-tight">
        Hesabınızı oluşturun
      </h1>
      <p className="mb-6 text-[15px] leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">{email}</span> adresi,{" "}
        <span className="font-semibold text-foreground">{roleLabel}</span> hesabı
        oluşturmak üzere davet edildi.
      </p>

      <form
        action={formAction}
        onSubmit={(event) => {
          if (mismatch) event.preventDefault();
        }}
        className="flex flex-col"
      >
        <div className="mb-4.5 flex items-center gap-2.5 rounded-xl border-[1.5px] border-input bg-muted px-3.5 py-3">
          <Mail className="size-[18px] shrink-0 text-muted-foreground" />
          <span className="text-[15px] text-muted-foreground">{email}</span>
        </div>

        <label
          htmlFor="companyName"
          className="mb-1.5 block text-[13.5px] font-semibold text-foreground/80"
        >
          Firma Adı
        </label>
        <div className="mb-4.5 flex items-center gap-2.5 rounded-xl border-[1.5px] border-input bg-background px-3.5 py-3 transition-colors focus-within:border-primary">
          <input
            id="companyName"
            name="companyName"
            required
            placeholder="Firma A.Ş."
            className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/70"
          />
        </div>

        <label
          htmlFor="fullName"
          className="mb-1.5 block text-[13.5px] font-semibold text-foreground/80"
        >
          Ad Soyad
        </label>
        <div className="mb-4.5 flex items-center gap-2.5 rounded-xl border-[1.5px] border-input bg-background px-3.5 py-3 transition-colors focus-within:border-primary">
          <User className="size-[18px] shrink-0 text-muted-foreground" />
          <input
            id="fullName"
            name="fullName"
            required
            placeholder="Ad Soyad"
            className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/70"
          />
        </div>

        <label
          htmlFor="password"
          className="mb-1.5 block text-[13.5px] font-semibold text-foreground/80"
        >
          Şifre
        </label>
        <div className="mb-4.5 flex items-center gap-2.5 rounded-xl border-[1.5px] border-input bg-background px-3.5 py-3 transition-colors focus-within:border-primary">
          <Lock className="size-[18px] shrink-0 text-muted-foreground" />
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="En az 8 karakter"
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

        <label
          htmlFor="passwordConfirm"
          className="mb-1.5 block text-[13.5px] font-semibold text-foreground/80"
        >
          Şifre (Tekrar)
        </label>
        <div className="mb-1.5 flex items-center gap-2.5 rounded-xl border-[1.5px] border-input bg-background px-3.5 py-3 transition-colors focus-within:border-primary">
          <Lock className="size-[18px] shrink-0 text-muted-foreground" />
          <input
            id="passwordConfirm"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder="Şifrenizi tekrar girin"
            className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/70"
          />
        </div>
        {mismatch && (
          <p className="mb-4 text-sm text-destructive" role="alert">
            Şifreler eşleşmiyor.
          </p>
        )}
        {!mismatch && state?.error && (
          <p className="mb-4 mt-3 text-sm text-destructive" role="alert">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="mt-4 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-brand px-4 py-3.5 text-base font-bold text-brand-foreground shadow-[0_12px_26px_rgba(245,179,1,0.32)] transition hover:bg-brand/90 disabled:opacity-60"
        >
          {isPending && <Loader2 className="size-[18px] animate-spin" />}
          Hesabı Oluştur
          {!isPending && <ArrowRight className="size-[18px]" />}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        Zaten hesabınız var mı?{" "}
        <Link href="/login" className="font-bold text-primary">
          Giriş yapın
        </Link>
      </div>
    </div>
  );
}
