"use client";

import { useState } from "react";
import { Copy, Loader2, Mail, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";

import {
  emailDriverLoginLinkAction,
  getDriverLoginLinkAction,
} from "@/app/(dashboard)/drivers/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { SerializableDriver } from "@/app/(dashboard)/drivers/types";

/** TR phone → wa.me format (digits, country code, no leading 0 / no +). */
function toWhatsAppPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("90")) return digits;
  if (digits.startsWith("0")) return `90${digits.slice(1)}`;
  return `90${digits}`;
}

/**
 * Free-channel sharing of a driver's passwordless login link: WhatsApp
 * (drivers have a phone, rarely an e-mail), copy-to-clipboard, and e-mail as a
 * fallback. The link is issued once when the dialog first opens; all three
 * channels share that same URL (the e-mail action re-reads the current token
 * rather than rotating it).
 */
export function DriverShareDialog({ driver }: { driver: SerializableDriver }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailing, setEmailing] = useState(false);

  async function onOpenChange(next: boolean) {
    setOpen(next);
    if (next && !url) {
      setLoading(true);
      const result = await getDriverLoginLinkAction(driver.id);
      setLoading(false);
      if ("error" in result) {
        toast.error(result.error);
        setOpen(false);
        return;
      }
      setUrl(result.url);
    }
  }

  function copy() {
    if (!url) return;
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Bağlantı kopyalandı."))
      .catch(() => toast.error("Kopyalanamadı."));
  }

  async function sendEmail() {
    setEmailing(true);
    const result = await emailDriverLoginLinkAction(driver.id);
    setEmailing(false);
    if (result?.error) toast.error(result.error);
    else toast.success("Bağlantı e-posta ile gönderildi.");
  }

  const waHref = url
    ? `https://wa.me/${toWhatsAppPhone(driver.phone)}?text=${encodeURIComponent(
        `Merhaba ${driver.fullName}, Logigo sefer paneline giriş bağlantınız: ${url}`
      )}`
    : "#";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Giriş Bağlantısı Paylaş">
          <span className="sr-only">Giriş Bağlantısı Paylaş</span>
          <Share2 />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Giriş Bağlantısı Paylaş</DialogTitle>
          <DialogDescription>
            {driver.fullName} — bu bağlantıyla şifresiz giriş yapıp seferlerini,
            rampa rezervasyonunu ve yol tarifini görür.
          </DialogDescription>
        </DialogHeader>

        {loading || !url ? (
          <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Bağlantı hazırlanıyor…
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input readOnly value={url} className="text-xs" onFocus={(e) => e.target.select()} />
              <Button variant="outline" size="icon" onClick={copy} title="Kopyala">
                <span className="sr-only">Kopyala</span>
                <Copy />
              </Button>
            </div>

            <Button
              asChild
              className="bg-[#25D366] text-white hover:bg-[#1eb955]"
            >
              <a href={waHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle />
                WhatsApp&apos;tan Gönder
              </a>
            </Button>

            {driver.email && (
              <Button variant="outline" onClick={sendEmail} disabled={emailing}>
                {emailing ? <Loader2 className="animate-spin" /> : <Mail />}
                E-posta ile Gönder
              </Button>
            )}

            <p className="text-muted-foreground text-xs">
              Not: Yeni bir bağlantı oluşturulduğunda önceki bağlantı geçersiz
              olur.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
