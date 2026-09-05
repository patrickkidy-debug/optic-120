import { InsuranceClaimStatus, InsuranceContractStatus } from '@oculo/shared-types';
import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/** Numéro de dossier : PEC-AAAA-00001, continu par établissement et par année. */
async function nextClaimNumber(tx: Tx, tenantId: string, at: Date): Promise<string> {
  const year = at.getFullYear();
  const count = await tx.insuranceClaim.count({
    where: { tenantId, number: { startsWith: `PEC-${year}-` } },
  });
  return `PEC-${year}-${String(count + 1).padStart(5, '0')}`;
}

/** Contrat actif de cet assureur dont le client est bénéficiaire, s'il y en a un. */
async function findMembership(tx: Tx, tenantId: string, insurerId: string, customerId: string | null) {
  if (!customerId) return null;
  const now = new Date();
  const rows = await tx.insuranceBeneficiary.findMany({
    where: {
      tenantId,
      customerId,
      contract: { insurerId, status: InsuranceContractStatus.ACTIVE },
    },
    include: { contract: { select: { id: true, startsAt: true, endsAt: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return (
    rows.find((r) => {
      if (r.contract.startsAt && r.contract.startsAt > now) return false;
      if (r.contract.endsAt && r.contract.endsAt < now) return false;
      return true;
    }) ?? null
  );
}

/**
 * Ouvre le dossier de prise en charge d'une vente assurée.
 *
 * Le dossier naît « en attente » : la part assurance a été demandée, elle n'est
 * ni acceptée ni encaissée. C'est lui, et non la vente, qui porte la créance
 * assurance ; l'encaissement n'arrive qu'avec un remboursement enregistré.
 */
export async function createClaimForSale(
  tx: Tx,
  params: {
    tenantId: string;
    userId: string;
    saleId: string;
    insurerId: string;
    customerId: string | null;
    totalAmount: number;
    insuranceAmount: number;
    at: Date;
  },
): Promise<void> {
  if (params.insuranceAmount <= 0) return;
  const membership = await findMembership(tx, params.tenantId, params.insurerId, params.customerId);
  await tx.insuranceClaim.create({
    data: {
      tenantId: params.tenantId,
      number: await nextClaimNumber(tx, params.tenantId, params.at),
      insurerId: params.insurerId,
      contractId: membership?.contractId ?? null,
      beneficiaryId: membership?.id ?? null,
      customerId: params.customerId,
      saleId: params.saleId,
      status: InsuranceClaimStatus.PENDING,
      totalAmount: params.totalAmount,
      requestedAmount: params.insuranceAmount,
      acceptedAmount: 0,
      patientAmount: Math.max(0, params.totalAmount - params.insuranceAmount),
      requestedAt: params.at,
      dueAt: new Date(params.at.getFullYear(), params.at.getMonth() + 1, 1),
      createdById: params.userId,
    },
  });
}

/**
 * Aligne le dossier sur une vente modifiée. Un dossier déjà arbitré ou
 * partiellement remboursé n'est pas touché : l'accord de l'assureur et l'argent
 * reçu ne se réécrivent pas depuis la caisse. Le dossier est créé s'il manque,
 * supprimé si la prise en charge est retirée.
 */
export async function syncClaimForSale(
  tx: Tx,
  params: {
    tenantId: string;
    userId: string;
    saleId: string;
    insurerId: string | null;
    customerId: string | null;
    totalAmount: number;
    insuranceAmount: number;
    at: Date;
  },
): Promise<void> {
  const claim = await tx.insuranceClaim.findFirst({
    where: { tenantId: params.tenantId, saleId: params.saleId },
    include: { _count: { select: { refunds: true } } },
  });

  if (!params.insurerId || params.insuranceAmount <= 0) {
    if (claim && claim._count.refunds === 0) {
      await tx.insuranceClaim.deleteMany({ where: { id: claim.id } });
    }
    return;
  }

  if (!claim) {
    await createClaimForSale(tx, { ...params, insurerId: params.insurerId });
    return;
  }

  const untouched =
    claim._count.refunds === 0 &&
    (claim.status === InsuranceClaimStatus.DRAFT || claim.status === InsuranceClaimStatus.PENDING);
  if (!untouched) return;

  await tx.insuranceClaim.updateMany({
    where: { id: claim.id },
    data: {
      insurerId: params.insurerId,
      customerId: params.customerId,
      totalAmount: params.totalAmount,
      requestedAmount: params.insuranceAmount,
      patientAmount: Math.max(0, params.totalAmount - params.insuranceAmount),
    },
  });
}

/**
 * Referme le dossier d'une vente annulée. S'il a déjà reçu de l'argent, il est
 * conservé : ce versement a bien eu lieu et doit rester traçable.
 */
export async function cancelClaimForSale(tx: Tx, tenantId: string, saleId: string): Promise<void> {
  const claim = await tx.insuranceClaim.findFirst({
    where: { tenantId, saleId },
    include: { _count: { select: { refunds: true } } },
  });
  if (!claim) return;
  if (claim._count.refunds > 0) {
    await tx.insuranceClaim.updateMany({
      where: { id: claim.id },
      data: { notes: [claim.notes, 'Vente annulée.'].filter(Boolean).join(' ') },
    });
    return;
  }
  await tx.insuranceClaim.deleteMany({ where: { id: claim.id } });
}
