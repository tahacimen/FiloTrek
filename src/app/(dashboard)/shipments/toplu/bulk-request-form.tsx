"use client";

import { useActionState } from "react";
import { CheckCircle2, Download, Loader2, Upload } from "lucide-react";

import {
  bulkRequestAction,
  type BulkFormState,
} from "@/app/(dashboard)/shipments/toplu/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BulkRequestForm() {
  const [state, formAction, isPending] = useActionState<BulkFormState, FormData>(
    bulkRequestAction,
    undefined
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">1. Şablonu indirin</p>
        <Button asChild variant="outline" className="w-fit">
          <a href="/api/bulk-template">
            <Download />
            Excel Şablonunu İndir
          </a>
        </Button>
        <p className="text-muted-foreground text-xs">
          Şablondaki &quot;Açıklama&quot; sayfası her kolonu anlatır. Örnek
          satırı silip kendi taleplerinizi girin.
        </p>
        <p className="text-muted-foreground text-xs">
          <b>Teslim noktası:</b> ya <b>Cariler</b> ekranında kayıtlı ünvanı{" "}
          <b>birebir</b> yazın, ya da <b>Cari Ünvanı</b>&apos;nı boş bırakıp{" "}
          <b>Teslim İl + İlçe</b>&apos;yi doldurun.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-3">
        <p className="text-sm font-medium">2. Doldurulmuş dosyayı yükleyin</p>
        <div className="flex flex-col gap-2">
          <Label htmlFor="file">Excel Dosyası (.xlsx)</Label>
          <Input
            id="file"
            name="file"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
          />
        </div>
        <Button type="submit" disabled={isPending} className="w-fit">
          {isPending ? <Loader2 className="animate-spin" /> : <Upload />}
          Yükle ve Talepleri Oluştur
        </Button>
      </form>

      {state && "error" in state && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      {state && "result" in state && (
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="size-4" />
            {state.result.created} talep oluşturuldu
            {state.result.errors.length > 0 &&
              `, ${state.result.errors.length} satır atlandı`}
            .
          </div>
          {state.result.errors.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground text-xs font-medium">
                Atlanan satırlar:
              </p>
              <ul className="flex flex-col gap-0.5 text-xs">
                {state.result.errors.map((e) => (
                  <li key={e.row} className="text-destructive">
                    Satır {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
