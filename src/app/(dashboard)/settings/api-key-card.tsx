"use client";

import { useState, useTransition } from "react";
import { CircleCheck, Copy, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { generateApiKeyAction } from "@/app/(dashboard)/settings/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Shown-once secret reveal, same convention as the invitation link — the plaintext value never persists past this render. */
export function ApiKeyCard({ hasApiKey }: { hasApiKey: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  function handleGenerate() {
    if (
      !confirm(
        hasApiKey
          ? "API anahtarını yenilemek istediğinize emin misiniz? Eski anahtar artık çalışmayacak."
          : "Bir API anahtarı oluşturmak istediğinize emin misiniz?"
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await generateApiKeyAction();
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      if (result?.secret) setRevealedKey(result.secret);
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="text-muted-foreground size-4" />
          API Anahtarı
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">
          <code>/api/v1/shipments</code> uç noktasına erişim için —{" "}
          <code>Authorization: Bearer &lt;anahtar&gt;</code> başlığıyla kullanılır.
        </p>
        <div className="flex items-center gap-2">
          {hasApiKey ? (
            <span className="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-500">
              <CircleCheck className="size-4" />
              Ayarlandı
            </span>
          ) : (
            <span className="text-muted-foreground text-sm">Henüz oluşturulmadı</span>
          )}
        </div>
        {revealedKey && (
          <div className="bg-muted flex flex-col gap-2 rounded-lg border p-3">
            <p className="text-xs font-medium">
              Bu anahtar yalnızca şimdi gösteriliyor — kaydedin, bir daha
              görüntülenemeyecek.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto text-xs">{revealedKey}</code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(revealedKey);
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
          variant={hasApiKey ? "outline" : "default"}
          disabled={isPending}
          onClick={handleGenerate}
          className="self-start"
        >
          {isPending && <Loader2 className="animate-spin" />}
          {hasApiKey ? "Anahtarı Yenile" : "Anahtar Oluştur"}
        </Button>
      </CardContent>
    </Card>
  );
}
