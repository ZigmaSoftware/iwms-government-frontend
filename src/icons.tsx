
import type { FC, SVGProps } from "react";
import { Pencil, Trash2, Eye, EyeOff } from "lucide-react";

export const PencilIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
  <Pencil className="h-4 w-4" strokeWidth={1.8} {...props} />
);

export const TrashBinIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
  <Trash2 className="h-4 w-4" strokeWidth={1.8} {...props} />
);

export const EyeIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
  <Eye className="h-4 w-4" strokeWidth={1.8} {...props} />
);

export const EyeOffIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
  <EyeOff className="h-4 w-4" strokeWidth={1.8} {...props} />
);
