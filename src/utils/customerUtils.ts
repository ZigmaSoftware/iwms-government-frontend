export type CustomerRecord = {
  id?: number | string;
  unique_id?: string;
  is_active?: boolean;
} & Record<string, any>;

export type ActiveRecord = {
  id?: number | string;
  unique_id?: string;
  is_active?: boolean;
} & Record<string, any>;

function normalizeList(data: any): ActiveRecord[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (data && Array.isArray(data.data)) {
    return data.data;
  }
  if (data && Array.isArray(data.results)) {
    return data.results;
  }
  return [];
}

export function normalizeCustomerArray(data: any): CustomerRecord[] {
  return normalizeList(data) as CustomerRecord[];
}

export function filterActiveRecords<T extends ActiveRecord>(
  records: T[],
  includeIds: Array<number | string> = []
): T[] {
  const includeSet = new Set(includeIds.map((value) => String(value)));

  return records.filter((record) => {
    const rawId = record?.unique_id ?? record?.id;
    if (rawId === undefined || rawId === null) return false;
    const normalizedId = String(rawId);

    return (record.is_active ?? true) || includeSet.has(normalizedId);
  });
}

export function filterActiveCustomers(
  customers: CustomerRecord[],
  includeIds: Array<number | string> = []
): CustomerRecord[] {
  return filterActiveRecords<CustomerRecord>(customers, includeIds);
}
