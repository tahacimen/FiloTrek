import { prisma } from "@/lib/db";
import { DemoRequestStatus } from "@/generated/prisma/client";

export function createDemoRequest(data: {
  fullName: string;
  companyName: string;
  phone: string;
  email: string;
  vehicleCount: number;
  message?: string | null;
}) {
  return prisma.demoRequest.create({ data });
}

export function listDemoRequests() {
  return prisma.demoRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export function findDemoRequestById(id: string) {
  return prisma.demoRequest.findUnique({ where: { id } });
}

export function updateDemoRequestStatus(id: string, status: DemoRequestStatus) {
  return prisma.demoRequest.update({ where: { id }, data: { status } });
}
