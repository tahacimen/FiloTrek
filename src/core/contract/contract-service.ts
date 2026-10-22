import { prisma } from "@/lib/db";
import { requireCompanyType } from "@/core/shared/authorization";
import type { TenantContext } from "@/core/shared/tenant-context";
import { NotFoundError, ValidationError } from "@/core/shared/errors";
import * as contractRepository from "@/core/contract/contract-repository";
import * as companyRepository from "@/core/company/company-repository";
import { contractRateInputSchema } from "@/lib/validation/contract-rate";
import {
  CompanyType,
  ContractPricingMethod,
  type Prisma,
} from "@/generated/prisma/client";

export async function listContractRates(ctx: TenantContext) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  return contractRepository.listContractRatesForSupplier(ctx);
}

async function assertCustomer(customerCompanyId: string, isDemo: boolean) {
  const company = await companyRepository.getCompanyById(customerCompanyId);
  if (!company || company.type !== CompanyType.CUSTOMER || company.isDemo !== isDemo) {
    throw new ValidationError("Geçerli bir müşteri firma seçin.");
  }
}

export async function createContractRate(ctx: TenantContext, rawInput: unknown) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  const input = contractRateInputSchema.parse(rawInput);
  await assertCustomer(input.customerCompanyId, ctx.isDemo);
  return contractRepository.createContractRateRecord(ctx, input);
}

export async function updateContractRate(
  ctx: TenantContext,
  id: string,
  rawInput: unknown
) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  const input = contractRateInputSchema.parse(rawInput);
  const existing = await contractRepository.getContractRateForSupplier(ctx, id);
  if (!existing) throw new NotFoundError("Sözleşme kalemi bulunamadı.");
  await assertCustomer(input.customerCompanyId, ctx.isDemo);
  await contractRepository.updateContractRateRecord(ctx, id, input);
}

export async function removeContractRate(ctx: TenantContext, id: string) {
  requireCompanyType(ctx, CompanyType.SUPPLIER);
  const existing = await contractRepository.getContractRateForSupplier(ctx, id);
  if (!existing) throw new NotFoundError("Sözleşme kalemi bulunamadı.");
  await contractRepository.deactivateContractRateRecord(ctx, id);
}

export type ContractMatchParams = {
  destinationProvince: string | null;
  destinationDistrict: string | null;
  distanceKm: number;
  tonnage: number;
};

type RateRow = {
  method: ContractPricingMethod;
  destinationProvince: string | null;
  destinationDistrict: string | null;
  amount: { toNumber(): number } | number;
};

function amountOf(r: RateRow): number {
  return typeof r.amount === "number" ? r.amount : r.amount.toNumber();
}

/**
 * Pure matcher (G2): given a supplier/customer pair's active rates and a
 * shipment's facts, return the agreed price, or null when nothing applies.
 * Specificity wins: a district-specific lane (3) > a province lane (2) >
 * PER_KM (1) > PER_TON (0). A lane rate whose destination doesn't match the
 * shipment is simply ignored, letting a general rate act as the fallback.
 */
export function pickContractPrice(
  rates: RateRow[],
  params: ContractMatchParams
): number | null {
  let best: { score: number; price: number } | null = null;

  for (const rate of rates) {
    let score = -1;
    let price = 0;

    if (rate.method === ContractPricingMethod.LANE_FIXED) {
      if (
        !rate.destinationProvince ||
        !params.destinationProvince ||
        rate.destinationProvince !== params.destinationProvince
      ) {
        continue;
      }
      if (rate.destinationDistrict) {
        if (rate.destinationDistrict !== params.destinationDistrict) continue;
        score = 3;
      } else {
        score = 2;
      }
      price = amountOf(rate);
    } else if (rate.method === ContractPricingMethod.PER_KM) {
      score = 1;
      price = amountOf(rate) * params.distanceKm;
    } else if (rate.method === ContractPricingMethod.PER_TON) {
      score = 0;
      price = amountOf(rate) * params.tonnage;
    }

    if (score >= 0 && (best === null || score > best.score)) {
      best = { score, price };
    }
  }

  if (!best) return null;
  return Math.round(best.price * 100) / 100;
}

/**
 * DB-backed wrapper: fetch the pair's active rates and apply pickContractPrice.
 * Returns the agreed price or null. Accepts a tx client so it can run inside
 * the request-creation path.
 */
export async function findContractPrice(
  client: Prisma.TransactionClient | typeof prisma,
  supplierCompanyId: string,
  customerCompanyId: string,
  params: ContractMatchParams
): Promise<number | null> {
  const rates = await contractRepository.listActiveRatesForPair(
    client,
    supplierCompanyId,
    customerCompanyId
  );
  if (rates.length === 0) return null;
  return pickContractPrice(rates, params);
}
