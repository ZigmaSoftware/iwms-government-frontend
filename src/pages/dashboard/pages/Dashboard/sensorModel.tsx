import { type Dispatch, type SetStateAction } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

type SensorModalProps = {
  open: boolean;
  onClose: (open: boolean) => void;
  title: string;
  zones: string[];
  wards: string[];
  filters: Record<string, string>;
  setFilters: Dispatch<SetStateAction<Record<string, string>>>;
  onApply: () => void;
};

export function SensorModal({
  open,
  onClose,
  title,
  zones,
  wards,
  filters,
  setFilters,
  onApply,
}: SensorModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <p className="text-sm font-semibold mb-1">{t("common.zone")}</p>
            <Select
              value={filters.zone}
              onValueChange={(v) => setFilters({ ...filters, zone: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {zones.map((z) => (
                  <SelectItem value={z} key={z}>{z}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="text-sm font-semibold mb-1">{t("common.ward")}</p>
            <Select
              value={filters.ward}
              onValueChange={(v) => setFilters({ ...filters, ward: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {wards.map((w) => (
                  <SelectItem value={w} key={w}>{w}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end mt-5">
          <Button onClick={onApply}>{t("common.apply")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
