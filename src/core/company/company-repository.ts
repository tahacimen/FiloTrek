import { prisma } from "@/lib/db";
import { CompanyStatus, CompanyType } from "@/generated/prisma/client";

// `isDemo` scopes discovery to the caller's realm: real tenants only ever see
// real companies, demo (sandbox) tenants only ever see the demo world. Passing
// it is mandatory so a new call site can't accidentally leak across realms.
export function listCustomerCompanies(isDemo: boolean) {
  return prisma.company.findMany({
    where: { type: CompanyType.CUSTOMER, status: CompanyStatus.ACTIVE, isDemo },
    orderBy: { name: "asc" },
  });
}

export function listSupplierCompanies(isDemo: boolean) {
  return prisma.company.findMany({
    where: { type: CompanyType.SUPPLIER, status: CompanyStatus.ACTIVE, isDemo },
    orderBy: { name: "asc" },
  });
}

export function getCompanyById(companyId: string) {
  return prisma.company.findUnique({ where: { id: companyId } });
}

export function setApiKey(companyId: string, apiKey: string) {
  return prisma.company.update({ where: { id: companyId }, data: { apiKey } });
}

export function setWebhookUrl(companyId: string, webhookUrl: string | null) {
  return prisma.company.update({ where: { id: companyId }, data: { webhookUrl } });
}

export function setWebhookSecret(companyId: string, webhookSecret: string) {
  return prisma.company.update({
    where: { id: companyId },
    data: { webhookSecret },
  });
}
