"use client";

import { useActionState, useState, useTransition } from "react";
import { CircleCheck, Copy, Loader2, Webhook } from "lucide-react";
import { toast } from "sonner";

import {
  generateWebhookSecretAction,
  setWebhookUrlAction,
  type SettingsFormState,
} from "@/app/(dashboard)/settings/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WebhookCard({
  webhookUrl,
  hasWebhookSecret,
}: {
  webhookUrl: string | null;
  hasWebhookSecret: boolean;
}) {
  const [urlState, urlFormAction, isUrlPending] = useActionState<
    SettingsFormState,
    FormData
  >(setWebhookUrlAction, undefined);

  const [isSecretPending, startSecretTransition] = useTransition();
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  function handleGenerateSecret() {
    if (
      !confirm(
        hasWebhookSecret
          ? "Webhook secret'ı yenilemek istediğinize emin misiniz? Eski secret artık geçersiz olacak."
          : "Bir webhook secret oluşturmak istediğinize emin misiniz?"
      )
    ) {
      return;
    }
    startSecretTransition(async () => {
      const result = await generateWebhookSecretAction();
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      if (result?.secret) setRevealedSecret(result.secret);
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Webhook className="text-muted-foreground size-4" />
          Webhook
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          Bir sefer durumu her değiştiğinde belirttiğiniz URL&apos;e imzalı bir
          POST isteği gönderilir (<code>X-Logigo-Signature</code> başlığı).
        </p>

        <form action={urlFormAction} className="flex flex-col gap-2">
          <Label htmlFor="webhookUrl">Webhook URL</Label>
          <div className="flex gap-2">
            <Input
              id="webhookUrl"
              name="webhookUrl"
              type="url"
              defaultValue={webhookUrl ?? ""}
              placeholder="https://sizin-sisteminiz.com/webhooks/logigo"
              className="flex-1"
            />
            <Button type="submit" variant="outline" disabled={isUrlPending}>
              {isUrlPending && <Loader2 className="animate-spin" />}
              Kaydet
            </Button>
          </div>
          {urlState?.error && (
            <p className="text-sm text-destructive" role="alert">
              {urlState.error}
            </p>
          )}
        </form>

        <div className="flex flex-col gap-2 border-t pt-4">
          <div className="flex items-center gap-2">
            {hasWebhookSecret ? (
              <span className="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-500">
                <CircleCheck className="size-4" />
                Secret ayarlandı
              </span>
            ) : (
              <span className="text-muted-foreground text-sm">
                Henüz secret oluşturulmadı
              </span>
            )}
          </div>
          {revealedSecret && (
            <div className="bg-muted flex flex-col gap-2 rounded-lg border p-3">
              <p className="text-xs font-medium">
                Bu secret yalnızca şimdi gösteriliyor — kaydedin, bir daha
                görüntülenemeyecek.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto text-xs">
                  {revealedSecret}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(revealedSecret);
                    toast.success("Kopyalandı");
                  }}
                >
                  <Copy />
                  Kopyala
                </Button>
              </div>
            </div>
          )}
          <Button
            type="button"
            variant={hasWebhookSecret ? "outline" : "default"}
            disabled={isSecretPending}
            onClick={handleGenerateSecret}
            className="self-start"
          >
            {isSecretPending && <Loader2 className="animate-spin" />}
            {hasWebhookSecret ? "Secret'ı Yenile" : "Secret Oluştur"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
