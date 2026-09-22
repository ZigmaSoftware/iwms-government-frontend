import { useTranslation } from "react-i18next";
import ComponentCard from "@/components/common/ComponentCard";

import AreaTypeFields from "./AreaTypeFields";
import { useAreaTypePage } from "./useAreaType";

export default function AreaTypeForm() {
  const { t } = useTranslation();
  const {
    title,
    isEdit,
    isReady,
    isSubmitting,
    states,
    districts,
    initialPayload,
    formKey,
    onCancel,
    onSubmit,
  } = useAreaTypePage();

  if (!isReady) {
    return (
      <ComponentCard title={title}>
        <div className="p-6 text-sm text-gray-500">{t("common.loading")}</div>
      </ComponentCard>
    );
  }

  return (
    <ComponentCard title={title}>
      <AreaTypeFields
        key={formKey}
        initialPayload={initialPayload}
        isEdit={isEdit}
        isSubmitting={isSubmitting}
        onCancel={onCancel}
        onSubmit={onSubmit}
        states={states}
        districts={districts}
      />
    </ComponentCard>
  );
}
