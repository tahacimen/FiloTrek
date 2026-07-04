import { prisma } from "@/lib/db";
import { CompanyStatus, CompanyType } from "@/generated/prisma/client";

export function listCustomerCompanies() {
  return prisma.company.findMany({
    where: { type: CompanyType.CUSTOMER, status: CompanyStatus.ACTIVE },
    orderBy: { name: "asc" },
  });
}

export function listSupplierCompanies() {
  return prisma.company.findMany({
    where: { type: CompanyType.SUPPLIER, status: CompanyStatus.ACTIVE },
    orderBy: { name: "asc" },
  });
}

export function getCompanyById(companyId: string) {
  return prisma.company.findUnique({ where: { id: companyId } });
}
