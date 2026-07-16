import { AlertTriangle } from "lucide-react";

import {
  getInvitationByToken,
  isInvitationExpired,
} from "@/core/invitation/invitation-service";
import { Logo } from "@/components/logo";
import { invitationRoleLabels } from "@/lib/labels";
import { InvitationAcceptForm } from "@/app/davet/[token]/invitation-accept-form";
import { InvitationStatus } from "@/generated/prisma/enums";

function InvalidInvitationScreen({ message }: { message: string }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col items-center justify-center px-6 py-10 text-center">
      <Logo className="mb-8 h-9 w-auto" />
      <AlertTriangle className="mb-4 size-10 text-destructive" />
      <h1 className="mb-2 text-xl font-bold tracking-tight">Davet geçersiz</h1>
      <p className="text-[15px] leading-relaxed text-muted-foreground">{message}</p>
    </div>
  );
}

export default async function InvitationAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await getInvitationByToken(token);

  if (!invitation) {
    return (
      <InvalidInvitationScreen message="Bu davet linki geçersiz. Lütfen davet eden kişiyle iletişime geçin." />
    );
  }
  if (invitation.status === InvitationStatus.ACCEPTED) {
    return (
      <InvalidInvitationScreen message="Bu davet zaten kullanılmış. Giriş yapmak için /login sayfasına gidin." />
    );
  }
  if (invitation.status === InvitationStatus.REVOKED) {
    return (
      <InvalidInvitationScreen message="Bu davet iptal edilmiş. Lütfen davet eden kişiyle iletişime geçin." />
    );
  }
  if (isInvitationExpired(invitation)) {
    return (
      <InvalidInvitationScreen message="Bu davetin süresi dolmuş. Lütfen yeni bir davet talep edin." />
    );
  }

  return (
    <InvitationAcceptForm
      token={token}
      email={invitation.email}
      roleLabel={invitationRoleLabels[invitation.role]}
    />
  );
}
