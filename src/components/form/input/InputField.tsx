import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

import { Input } from "@/components/ui/input";

const InputField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>((props, ref) => (
  <Input ref={ref} {...props} />
));

InputField.displayName = "InputField";

export default InputField;
