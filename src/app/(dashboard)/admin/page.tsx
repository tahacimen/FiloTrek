import { redirect } from "next/navigation";

import { requireTenantContext } from "@/core/shared/tenant-context";
import { listInvitations } from "@/core/invitation/invitation-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRequestOrigin } from "@/lib/request-origin";
import { InvitationFormDialog } from "@/app/(dashboard)/admin/invitation-form-dialog";
import { ManualAccountFormDialog } from "@/app/(dashboard)/admin/manual-account-form-dialog";
import { InvitationTable } from "@/app/(dashboard)/admin/invitation-table";

export default async function AdminPage() {
  const ctx = await requireTenantContext();
  if (!ctx.isPlatformAdmin) {
    redirect("/dashboard");
  }

  const [invitations, origin] = await Promise.all([
    listInvitations(ctx),
    getRequestOrigin(),
  ]);

  const rows = invitations.map((invitation) => ({
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    createdAt: invitation.createdAt,
    expiresAt: invitation.expiresAt,
    invitationUrl: `${origin}/davet/${invitation.token}`,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Yönetim</h1>
          <p className="text-muted-foreground text-sm">
            Yeni tedarikçi/müşteri firmaları için davet gönderin ve mevcut
            davetleri yönetin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ManualAccountFormDialog />
          <InvitationFormDialog />
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tüm Davetler ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <InvitationTable invitations={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
