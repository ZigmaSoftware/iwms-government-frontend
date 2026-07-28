type FieldErrorProps = {
  message?: string;
};

/** Standard inline validation-error text, styled to match the shadcn form scaffold. */
export function FieldError({ message }: FieldErrorProps) {
  if (!message) return null;
  return <p className="text-sm font-medium text-destructive">{message}</p>;
}
