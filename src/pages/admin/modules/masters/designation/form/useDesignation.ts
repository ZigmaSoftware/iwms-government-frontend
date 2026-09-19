import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import notify from "@/lib/notify";

import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { designationSchema } from "@/schemas/masters/designation.schema";
import { extractErrorMessage } from "../../shared/recordHelpers";

import {
  loadDepartmentOptions,
  loadDesignationRecord,
  submitDesignation,
} from "./designation.form.functionality";
import type { DepartmentOption, DesignationFormValues } from "./designation.form.types";

/** Form state + submit/load handlers for the Designation create/edit page. */
export function useDesignationForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { encMasters, encDesignations } = getEncryptedRoute();
  const { listPath: LIST_PATH } = createCrudRoutePaths(encMasters, encDesignations);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentOption[]>([]);

  // Holds the edited record's department ID while the department list is
  // still loading; applied via setValue once the options are ready, since
  // the two loads race and the record can resolve first.
  const [pendingDepartmentId, setPendingDepartmentId] = useState("");

  const form = useForm<DesignationFormValues>({
    resolver: zodResolver(designationSchema),
    defaultValues: {
      designation_name: "",
      department_id: "",
      description: "",
      status: "active",
    },
  });

  useEffect(() => {
    let cancelled = false;
    void loadDepartmentOptions().then((options) => {
      if (!cancelled) setDepartmentOptions(options);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!pendingDepartmentId || departmentOptions.length === 0) return;
    if (departmentOptions.some((d) => d.value === pendingDepartmentId)) {
      form.setValue("department_id", pendingDepartmentId);
      setPendingDepartmentId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDepartmentId, departmentOptions]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void loadDesignationRecord(id).then((values) => {
      if (cancelled) return;
      form.reset(values);
      if (values.department_id) setPendingDepartmentId(values.department_id);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onValid = async (values: DesignationFormValues) => {
    setIsSubmitting(true);
    try {
      await submitDesignation(values, isEdit, id);
      notify.fire(t("common.success"), "Designation saved successfully", "success");
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
    departmentOptions,
    onSubmit: form.handleSubmit(onValid),
    onCancel: () => navigate(LIST_PATH),
  };
}
