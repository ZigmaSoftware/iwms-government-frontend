import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import notify from "@/lib/notify";

import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { departmentSchema } from "@/schemas/masters/department.schema";
import { extractErrorMessage } from "../../shared/recordHelpers";

import { loadDepartmentRecord, submitDepartment } from "./department.form.functionality";
import type { DepartmentFormValues } from "./department.form.types";

/** Form state + submit/load handlers for the Department create/edit page. */
export function useDepartmentForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { encMasters, encDepartments } = getEncryptedRoute();
  const { listPath: LIST_PATH } = createCrudRoutePaths(encMasters, encDepartments);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      department_name: "",
      department_code: "",
      description: "",
      status: "active",
    },
  });

  useEffect(() => {
    if (!id) return;
    void loadDepartmentRecord(id).then((values) => form.reset(values));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onValid = async (values: DepartmentFormValues) => {
    setIsSubmitting(true);
    try {
      await submitDepartment(values, isEdit, id);
      notify.fire(t("common.success"), "Department saved successfully", "success");
      navigate(LIST_PATH);
    } catch (error) {
      notify.fire(t("common.error"), extractErrorMessage(error, "Save failed"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    t,
    isEdit,
    isSubmitting,
    form,
    onSubmit: form.handleSubmit(onValid),
    onCancel: () => navigate(LIST_PATH),
  };
}
