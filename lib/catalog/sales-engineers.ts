/**
 * Sales Engineer roster — the human PTI engineer the customer should
 * contact about a quote. Selected on the final Send step (no default,
 * the rep must pick one) and surfaced in:
 *
 *   1. The customer-facing Quote PDF "Sales Engineer" block
 *   2. Engineering JSON (`sales_engineer` key)
 *   3. Any future mailto draft (subject + sender contact info)
 *
 * Stored on the revision under `outputs.salesEngineerId`. The id is the
 * canonical lookup key; never change one without a migration plan.
 */

export type SalesEngineer = {
  id: string;
  name: string;
  email: string;
  phone: string;
};

export const SALES_ENGINEERS: SalesEngineer[] = [
  {
    id: 'devin-schuler',
    name: 'Devin Schuler',
    email: 'devin@plastanks.com',
    phone: '513-874-5047',
  },
  {
    id: 'sam-patrick',
    name: 'Sam Patrick',
    email: 'sam@plastanks.com',
    phone: '513-874-5047',
  },
  {
    id: 'nate-patrick',
    name: 'Nate Patrick',
    email: 'nate@plastanks.com',
    phone: '513-874-5047',
  },
];

const BY_ID: Record<string, SalesEngineer> = Object.fromEntries(
  SALES_ENGINEERS.map((e) => [e.id, e]),
);

export function findSalesEngineer(id: string | null | undefined): SalesEngineer | null {
  if (!id) return null;
  return BY_ID[id] ?? null;
}
