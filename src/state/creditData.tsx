import { asc, desc } from 'drizzle-orm';
import { createContext, useContext, type ReactNode } from 'react';

import { getDb } from '@/db/client';
import { fxTableFromRows } from '@/db/fx';
import { useLiveRows } from '@/db/live';
import {
  creditProducts,
  customProductTypes,
  fxRates,
  installments,
  payments,
  type CreditProductRow,
  type CustomProductType,
  type InstallmentRow,
  type PaymentRow,
} from '@/db/schema';
import {
  productStatus,
  sortByDue,
  summarizeCredit,
  type CreditSummary,
  type ProductStatus,
} from '@/domain/creditStatus';
import type { LocalDate } from '@/domain/dates';
import type { FxTable } from '@/domain/fx';
import { useToday } from '@/hooks/useToday';

import { usePreferences } from './preferences';

export type CreditData = {
  today: LocalDate;
  products: CreditProductRow[];
  installments: InstallmentRow[];
  /** Newest first. */
  payments: PaymentRow[];
  customTypes: CustomProductType[];
  fx: FxTable;
  /** Every product with its next due, sorted by days left (overdue first). */
  statuses: ProductStatus<CreditProductRow>[];
  summary: CreditSummary;
};

const readProducts = () =>
  getDb().select().from(creditProducts).orderBy(asc(creditProducts.createdAt)).all();
const readInstallments = () =>
  getDb()
    .select()
    .from(installments)
    .orderBy(asc(installments.dueDate), asc(installments.seq))
    .all();
const readPayments = () =>
  getDb().select().from(payments).orderBy(desc(payments.date), desc(payments.createdAt)).all();
const readCustomTypes = () =>
  getDb().select().from(customProductTypes).orderBy(asc(customProductTypes.createdAt)).all();
const readFx = () => fxTableFromRows(getDb().select().from(fxRates).all());

const CreditDataContext = createContext<CreditData | null>(null);

export function CreditDataProvider({ children }: { children: ReactNode }) {
  const { prefs } = usePreferences();
  const today = useToday();
  const products = useLiveRows(['credit_products'], readProducts);
  const installmentRows = useLiveRows(['installments'], readInstallments);
  const paymentRows = useLiveRows(['payments'], readPayments);
  const customTypes = useLiveRows(['custom_product_types'], readCustomTypes);
  const fx = useLiveRows(['fx_rates'], readFx);

  const statuses = sortByDue(
    products.map((product) => productStatus(product, installmentRows, today))
  );
  const summary = summarizeCredit(products, installmentRows, today, prefs.homeCurrency, fx);

  return (
    <CreditDataContext.Provider
      value={{
        today,
        products,
        installments: installmentRows,
        payments: paymentRows,
        customTypes,
        fx,
        statuses,
        summary,
      }}>
      {children}
    </CreditDataContext.Provider>
  );
}

export function useCreditData(): CreditData {
  const value = useContext(CreditDataContext);
  if (!value) throw new Error('useCreditData must be used inside <CreditDataProvider>');
  return value;
}

/** Everything the detail screen needs about one product; null once it is deleted. */
export function useProduct(id: string | undefined) {
  const data = useCreditData();
  const status = data.statuses.find((item) => item.product.id === id);
  if (!status) return null;
  return {
    ...status,
    installments: data.installments.filter((item) => item.productId === id),
    payments: data.payments.filter((item) => item.productId === id),
    customType: data.customTypes.find((type) => type.id === status.product.customTypeId) ?? null,
  };
}
