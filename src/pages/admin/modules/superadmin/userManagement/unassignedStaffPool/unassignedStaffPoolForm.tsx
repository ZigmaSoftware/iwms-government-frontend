import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ComponentCard from "@/components/common/ComponentCard";
import { Button } from "@/components/ui/button";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { dailyTripAssignmentApi, unassignedStaffPoolApi, userCreationApi } from "@/helpers/admin";
import Swal from "@/lib/notify";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { normalizeList } from "@/utils/forms";

type Option = { value: string; label: string };

const toOptions = (items: any[], labelKey: string, fallbackKey = "unique_id"): Option[] =>
  items
    .map((item) => ({
      value: String(item?.unique_id ?? item?.id ?? ""),
      label: String(item?.[labelKey] ?? item?.[fallbackKey] ?? item?.unique_id ?? ""),
    }))
    .filter((item) => item.value);

export default function UnassignedStaffPoolForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const { encUserManagement, encUnassignedStaffPool } = getEncryptedRoute();
  const { listPath } = createCrudRoutePaths(encUserManagement, encUnassignedStaffPool);

  const [role, setRole] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [dailyTripAssignmentId, setDailyTripAssignmentId] = useState("");
  const [status, setStatus] = useState("AVAILABLE");
  const [operators, setOperators] = useState<Option[]>([]);
  const [drivers, setDrivers] = useState<Option[]>([]);
  const [assignments, setAssignments] = useState<Option[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([userCreationApi.readAll(), dailyTripAssignmentApi.readAll()]).then(([userRes, assignmentRes]) => {
      const users = normalizeList(userRes);
      setOperators(toOptions(users.filter((user: any) => String(user?.staffusertype_name ?? "").toLowerCase() === "operator"), "staff_name"));
      setDrivers(toOptions(users.filter((user: any) => String(user?.staffusertype_name ?? "").toLowerCase() === "driver"), "staff_name"));
      setAssignments(toOptions(normalizeList(assignmentRes), "trip_no"));
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    unassignedStaffPoolApi.read(id).then((record: any) => {
      setOperatorId(String(record.operator_id ?? ""));
      setDriverId(String(record.driver_id ?? ""));
      setDailyTripAssignmentId(String(record.daily_trip_assignment_id ?? ""));
      setStatus(String(record.status ?? "AVAILABLE"));
      setRole(record.operator_id ? "operator" : record.driver_id ? "driver" : "");
    });
  }, [id]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!role || (role === "operator" && !operatorId) || (role === "driver" && !driverId)) {
      Swal.fire("Missing details", "Select a role and staff member.", "warning");
      return;
    }
    setSaving(true);
    const payload = {
      operator_id: role === "operator" ? operatorId : null,
      driver_id: role === "driver" ? driverId : null,
      daily_trip_assignment_id: dailyTripAssignmentId || null,
      status,
    };
    try {
      if (isEdit && id) await unassignedStaffPoolApi.update(id, payload);
      else await unassignedStaffPoolApi.create(payload);
      navigate(listPath);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ComponentCard title={isEdit ? "Edit Unassigned Staff" : "Create Unassigned Staff"}>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label>Role</Label>
          <Select value={role} onChange={(value) => setRole(String(value))} options={[{ value: "operator", label: "Operator" }, { value: "driver", label: "Driver" }]} placeholder="Select Role" />
        </div>
        {role === "operator" && (
          <div>
            <Label>Operator</Label>
            <Select value={operatorId} onChange={(value) => setOperatorId(String(value))} options={operators} placeholder="Select Operator" />
          </div>
        )}
        {role === "driver" && (
          <div>
            <Label>Driver</Label>
            <Select value={driverId} onChange={(value) => setDriverId(String(value))} options={drivers} placeholder="Select Driver" />
          </div>
        )}
        <div>
          <Label>Daily Trip Assignment</Label>
          <Select value={dailyTripAssignmentId} onChange={(value) => setDailyTripAssignmentId(String(value))} options={assignments} placeholder="Select Assignment" />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onChange={(value) => setStatus(String(value))} options={[{ value: "AVAILABLE", label: "Available" }, { value: "ASSIGNED", label: "Assigned" }]} placeholder="Select Status" />
        </div>
        <div className="flex gap-2 md:col-span-2">
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          <Button type="button" variant="outline" onClick={() => navigate(listPath)}>Cancel</Button>
        </div>
      </form>
    </ComponentCard>
  );
}
