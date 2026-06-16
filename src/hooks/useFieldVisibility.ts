import { useCallback } from "react";

import { usePermission } from "@/contexts/PermissionContext";
import {
  filterPayloadByFieldVisibility,
  getMissingVisibleFields,
  isFieldVisibleByPermission,
  type FieldPermissionMap,
  type PayloadRecord,
} from "@/utils/permissions";

export function useFieldVisibility(
  moduleName: string,
  screenName: string,
  fieldPermissionMap: FieldPermissionMap,
) {
  const { hasColumnPermission } = usePermission();

  const isFieldVisible = useCallback(
    (fieldKey: string): boolean =>
      isFieldVisibleByPermission(fieldKey, fieldPermissionMap, (fieldName) =>
        hasColumnPermission(moduleName, screenName, fieldName),
      ),
    [fieldPermissionMap, hasColumnPermission, moduleName, screenName],
  );

  const filterPayload = useCallback(
    <T extends PayloadRecord>(payload: T, alwaysInclude: string[] = []): Partial<T> =>
      filterPayloadByFieldVisibility(payload, isFieldVisible, alwaysInclude),
    [isFieldVisible],
  );

  const getMissingRequiredFields = useCallback(
    (
      requiredFieldKeys: string[],
      getFieldValue: (fieldKey: string) => unknown,
    ): string[] =>
      getMissingVisibleFields(requiredFieldKeys, getFieldValue, isFieldVisible),
    [isFieldVisible],
  );

  return {
    isFieldVisible,
    showField: isFieldVisible,
    showColumn: isFieldVisible,
    filterPayload,
    getMissingRequiredFields,
  };
}
