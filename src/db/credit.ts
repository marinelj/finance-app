import { desc, eq } from 'drizzle-orm';

import type { ProductKind } from '@/domain/credit';
import type { DueInfo } from '@/domain/creditStatus';
import { planPayment, planUndo, type PaymentInput } from '@/domain/payments';
import type { ProductSaveResult } from '@/domain/productForm';

import { getDb } from './client';
import { newId, nowIso } from './ids';
import {
  creditProducts,
  customProductTypes,
  installments,
  payments,
  type CreditProductRow,
  type CustomProductType,
  type InstallmentRow,
} from './schema';

/** Inserts or updates a product, replacing its installments when the save result says so. */
export function saveProduct(id: string | null, result: ProductSaveResult): string {
  const productId = id ?? newId();
  const now = nowIso();
  getDb().transaction((tx) => {
    if (id) {
      tx.update(creditProducts)
        .set({ ...result.fields, updatedAt: now })
        .where(eq(creditProducts.id, id))
        .run();
    } else {
      tx.insert(creditProducts)
        .values({ ...result.fields, id: productId, createdAt: now, updatedAt: now })
        .run();
    }
    if (result.schedule) {
      tx.delete(installments).where(eq(installments.productId, productId)).run();
      const rows = result.schedule.installments.map((item) => ({
        id: newId(),
        productId,
        seq: item.seq,
        dueDate: item.dueDate,
        principal: item.principal,
        interest: item.interest,
        amount: item.amount,
        paidAt: item.paidAt,
      }));
      if (rows.length > 0) tx.insert(installments).values(rows).run();
    }
  });
  return productId;
}

export function setProductActive(id: string, isActive: boolean): void {
  getDb()
    .update(creditProducts)
    .set({ isActive, updatedAt: nowIso() })
    .where(eq(creditProducts.id, id))
    .run();
}

export function deleteProduct(id: string): void {
  getDb().transaction((tx) => {
    tx.delete(payments).where(eq(payments.productId, id)).run();
    tx.delete(installments).where(eq(installments.productId, id)).run();
    tx.delete(creditProducts).where(eq(creditProducts.id, id)).run();
  });
}

/** Records a payment and applies its effect on the product; returns the payment id. */
export function recordPayment(
  product: CreditProductRow,
  due: DueInfo | null,
  installment: InstallmentRow | null,
  input: PaymentInput
): string {
  const plan = planPayment(product, due, installment, input);
  const id = newId();
  const now = nowIso();
  getDb().transaction((tx) => {
    tx.update(creditProducts)
      .set({ ...plan.product, updatedAt: now })
      .where(eq(creditProducts.id, product.id))
      .run();
    if (plan.paidInstallmentId) {
      tx.update(installments)
        .set({ paidAt: input.date })
        .where(eq(installments.id, plan.paidInstallmentId))
        .run();
    }
    tx.insert(payments)
      .values({ id, productId: product.id, ...plan.record, createdAt: now })
      .run();
  });
  return id;
}

/**
 * Undoes a payment if it is still the product's most recent one (later payments build on it).
 * Returns whether anything changed.
 */
export function undoPayment(paymentId: string): boolean {
  const db = getDb();
  const payment = db.select().from(payments).where(eq(payments.id, paymentId)).get();
  if (!payment) return false;
  const latest = db
    .select({ id: payments.id })
    .from(payments)
    .where(eq(payments.productId, payment.productId))
    .orderBy(desc(payments.createdAt))
    .limit(1)
    .get();
  const product = db
    .select()
    .from(creditProducts)
    .where(eq(creditProducts.id, payment.productId))
    .get();
  if (!product || latest?.id !== payment.id) return false;

  const plan = planUndo(product, payment);
  db.transaction((tx) => {
    tx.update(creditProducts)
      .set({ ...plan.product, updatedAt: nowIso() })
      .where(eq(creditProducts.id, product.id))
      .run();
    if (plan.unpaidInstallmentId) {
      tx.update(installments)
        .set({ paidAt: null })
        .where(eq(installments.id, plan.unpaidInstallmentId))
        .run();
    }
    tx.delete(payments).where(eq(payments.id, payment.id)).run();
  });
  return true;
}

export type CustomTypeInput = {
  name: string;
  kind: ProductKind;
  hasGracePeriod: boolean;
  emoji: string;
  color: string;
};

export function createCustomType(input: CustomTypeInput): CustomProductType {
  const row: CustomProductType = {
    id: newId(),
    ...input,
    name: input.name.trim(),
    hasGracePeriod: input.kind !== 'installment_loan' && input.hasGracePeriod,
    createdAt: nowIso(),
  };
  getDb().insert(customProductTypes).values(row).run();
  return row;
}

/** Products of a deleted type keep their settings; they just lose the type label. */
export function deleteCustomType(id: string): void {
  getDb().transaction((tx) => {
    tx.update(creditProducts)
      .set({ customTypeId: null })
      .where(eq(creditProducts.customTypeId, id))
      .run();
    tx.delete(customProductTypes).where(eq(customProductTypes.id, id)).run();
  });
}
