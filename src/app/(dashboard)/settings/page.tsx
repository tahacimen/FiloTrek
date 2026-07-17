import { redirect } from "next/navigation";

import { requireTenantContext } from "@/core/shared/tenant-context";
import * as companyService from "@/core/company/company-service";
import { ApiKeyCard } from "@/app/(dashboard)/settings/api-key-card";
import { WebhookCard } from "@/app/(dashboard)/settings/webhook-card";

export default async function SettingsPage() {
  const ctx = await requireTenantContext();
  if (ctx.companyRole !== "ADMIN") {
    redirect("/dashboard");
  }

  const settings = await companyService.getCompanySettings(ctx);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Entegrasyon Ayarları</h1>
        <p className="text-muted-foreground text-sm">
          Firmanızın kendi sistemlerinden okuma erişimi ve sefer durumu
          bildirimleri için API anahtarı ve webhook ayarları.
        </p>
      </div>

      <ApiKeyCard hasApiKey={settings.hasApiKey} />
      <WebhookCard
        webhookUrl={settings.webhookUrl}
        hasWebhookSecret={settings.hasWebhookSecret}
      />
    </div>
  );
}
