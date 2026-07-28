export function capitalize(val?: string | number | null): string {
  if (val === undefined || val === null || val === "") return "";
  const s = String(val);
  const firstVisibleCharacter = s.search(/\S/);
  if (firstVisibleCharacter < 0) return s;
  return (
    s.slice(0, firstVisibleCharacter) +
    s.charAt(firstVisibleCharacter).toLocaleUpperCase() +
    s.slice(firstVisibleCharacter + 1)
  );
}

export type CapitalizeApiFormDataOptions = {
  includeFields?: readonly string[];
  excludeFields?: readonly string[];
};

const DEFAULT_TEXT_FIELDS = new Set([
  "address",
  "area",
  "description",
  "details",
  "label",
  "landmark",
  "name",
  "reason",
  "remark",
  "remarks",
  "street",
  "title",
]);

const DEFAULT_TEXT_SUFFIXES = [
  "_address",
  "_area",
  "_description",
  "_details",
  "_label",
  "_landmark",
  "_name",
  "_reason",
  "_remark",
  "_remarks",
  "_street",
  "_title",
];

const DEFAULT_EXCLUDED_FIELDS = new Set([
  "blob_name",
  "document_name",
  "file_name",
  "filename",
  "login_name",
  "object_name",
  "path_name",
  "storage_name",
  "user_name",
  "username",
]);

const normalizeFieldName = (field: string): string =>
  field.trim().toLowerCase();

const normalizedFieldSet = (fields: readonly string[] = []): Set<string> =>
  new Set(fields.map(normalizeFieldName));

const shouldCapitalizeNormalizedField = (
  normalizedField: string,
  includedFields: Set<string>,
  excludedFields: Set<string>,
): boolean => {
  if (excludedFields.has(normalizedField)) return false;
  if (includedFields.has(normalizedField)) return true;
  return (
    DEFAULT_TEXT_FIELDS.has(normalizedField) ||
    DEFAULT_TEXT_SUFFIXES.some((suffix) => normalizedField.endsWith(suffix))
  );
};

export const shouldCapitalizeFormField = (
  field: string,
  options: CapitalizeApiFormDataOptions = {},
): boolean => {
  const normalizedField = normalizeFieldName(field);
  const includedFields = normalizedFieldSet(options.includeFields);
  const excludedFields = new Set([
    ...DEFAULT_EXCLUDED_FIELDS,
    ...normalizedFieldSet(options.excludeFields),
  ]);

  return shouldCapitalizeNormalizedField(
    normalizedField,
    includedFields,
    excludedFields,
  );
};

/**
 * Capitalizes human-readable strings in an API payload before it hydrates a
 * form. Technical values such as IDs, UUIDs, email addresses, URLs, enum
 * codes, usernames, registration numbers and filenames remain unchanged.
 *
 * The returned value is a new object/array; the original API payload is not
 * mutated.
 */
export const capitalizeApiFormData = <T>(
  value: T,
  options: CapitalizeApiFormDataOptions = {},
): T => {
  const includedFields = normalizedFieldSet(options.includeFields);
  const excludedFields = new Set([
    ...DEFAULT_EXCLUDED_FIELDS,
    ...normalizedFieldSet(options.excludeFields),
  ]);

  const visit = (item: unknown, field = ""): unknown => {
    if (typeof item === "string") {
      return field &&
        shouldCapitalizeNormalizedField(
          normalizeFieldName(field),
          includedFields,
          excludedFields,
        )
        ? capitalize(item)
        : item;
    }

    if (Array.isArray(item)) {
      return item.map((entry) => visit(entry, field));
    }

    if (
      !item ||
      typeof item !== "object" ||
      item instanceof Date ||
      (typeof Blob !== "undefined" && item instanceof Blob) ||
      (typeof FormData !== "undefined" && item instanceof FormData)
    ) {
      return item;
    }

    return Object.fromEntries(
      Object.entries(item as Record<string, unknown>).map(([key, entry]) => [
        key,
        visit(entry, key),
      ]),
    );
  };

  return visit(value) as T;
};
