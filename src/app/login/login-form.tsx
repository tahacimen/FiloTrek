"use client";

import { useActionState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";

import { loginAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [error, formAction, isPending] = useActionState(
    loginAction.bind(null, callbackUrl),
    undefined
  );

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <Image
          src="/logo-icon.png"
          alt="FiloTrek"
          width={128}
          height={128}
          priority
          className="mx-auto mb-2 size-12 rounded-lg"
        />
        <CardTitle className="text-xl">FiloTrek&apos;e Giriş Yap</CardTitle>
        <CardDescription>
          Lojistik firması veya müşteri hesabınızla giriş yapın
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-posta</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="ornek@firma.com"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Şifre</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending && <Loader2 className="animate-spin" />}
            Giriş Yap
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
