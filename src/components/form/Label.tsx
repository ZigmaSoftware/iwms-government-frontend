import { forwardRef } from "react";
import type { LabelHTMLAttributes } from "react";

import { Label as ShadLabel } from "@/components/ui/label";

const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>((props, ref) => (
  <ShadLabel ref={ref} {...props} />
));

Label.displayName = "FormLabel";

export default Label;
