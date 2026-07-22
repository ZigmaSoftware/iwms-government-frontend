import { z } from "zod";

/**
 * Relaxes fields that are currently hidden by column-permission visibility
 * (see `useFieldVisibility`) to optional, so a permission-gated form can
 * adopt a fully-required Zod schema without blocking submission on a field
 * the user was never shown in the first place.
 */
export function requireWhenVisible<Shape extends z.ZodRawShape>(
  schema: z.ZodObject<Shape>,
  isFieldVisible: (fieldKey: string) => boolean,
): z.ZodObject<Shape> {
  const relaxed = Object.fromEntries(
    Object.entries(schema.shape).map(([key, fieldSchema]) => [
      key,
      isFieldVisible(key) ? fieldSchema : (fieldSchema as z.ZodTypeAny).optional(),
    ]),
  ) as Shape;

  return z.object(relaxed) as z.ZodObject<Shape>;
}
