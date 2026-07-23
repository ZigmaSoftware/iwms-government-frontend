import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import ComponentCard from "@/components/common/ComponentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { FieldError } from "@/components/form/FieldError";
import { createCrudHelpers, customerCreationApi, propertiesApi, subPropertiesApi, userCreationApi, vehicleCreationApi } from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { normalizeList } from "@/utils/forms";
import {
  householdPickupEventSchema,
  type HouseholdPickupEventFormValues,
} from "@/schemas/masters/customerMasters/householdPickupEvent.schema";

type Option = { value: string; label: string };
type RecordRow = Record<string, any>;

const householdPickupEventApi = createCrudHelpers<RecordRow>("customer-masters/household-pickup-events");

const toOptions = (items: any[], labelKey: string): Option[] =>
  items.map((item) => ({ value: String(item?.unique_id ?? item?.id ?? ""), label: String(item?.[labelKey] ?? item?.unique_id ?? "") })).filter((item) => item.value);

export default function HouseholdPickupEventForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const { encCustomerMaster, encHouseholdPickupEvent } = getEncryptedRoute();
  const { listPath } = createCrudRoutePaths(encCustomerMaster, encHouseholdPickupEvent);
  const [customers, setCustomers] = useState<Option[]>([]);
  const [properties, setProperties] = useState<Option[]>([]);
  const [subProperties, setSubProperties] = useState<Option[]>([]);
  const [collectors, setCollectors] = useState<Option[]>([]);
  const [vehicles, setVehicles] = useState<Option[]>([]);
  const [saving, setSaving] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<HouseholdPickupEventFormValues>({
    resolver: zodResolver(householdPickupEventSchema),
    defaultValues: {
      customer_id: "",
      property_id: "",
      sub_property_id: "",
      pickup_time: "",
      weight_kg: "",
      collector_staff_id: "",
      vehicle_id: "",
      source: "",
    },
  });

  useEffect(() => {
    Promise.all([customerCreationApi.readAll(), propertiesApi.readAll(), subPropertiesApi.readAll(), userCreationApi.readAll(), vehicleCreationApi.readAll()])
      .then(([customerRes, propertyRes, subPropertyRes, userRes, vehicleRes]) => {
        setCustomers(toOptions(normalizeList(customerRes), "customer_name"));
        setProperties(toOptions(normalizeList(propertyRes), "property_name"));
        setSubProperties(toOptions(normalizeList(subPropertyRes), "sub_property_name"));
        setCollectors(toOptions(normalizeList(userRes), "staff_name"));
        setVehicles(toOptions(normalizeList(vehicleRes), "vehicle_no"));
      });
  }, []);

  useEffect(() => {
    if (!id) return;
    householdPickupEventApi.read(id).then((record) => {
      reset({
        customer_id: String(record.customer_id ?? ""),
        property_id: String(record.property_id ?? ""),
        sub_property_id: String(record.sub_property_id ?? ""),
        pickup_time: record.pickup_time ? String(record.pickup_time).slice(0, 16) : "",
        weight_kg: String(record.weight_kg ?? ""),
        collector_staff_id: String(record.collector_staff_id ?? ""),
        vehicle_id: String(record.vehicle_id ?? ""),
        source: String(record.source ?? ""),
      });
    });
  }, [id, reset]);

  const onValid = async (values: HouseholdPickupEventFormValues) => {
    setSaving(true);
    const payload = { ...values };
    try {
      if (isEdit && id) await householdPickupEventApi.update(id, payload);
      else await householdPickupEventApi.create(payload);
      navigate(listPath);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ComponentCard title={isEdit ? "Edit Household Pickup Event" : "Create Household Pickup Event"}>
      <form onSubmit={handleSubmit(onValid)} noValidate className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label>Customer</Label>
          <Controller
            control={control}
            name="customer_id"
            render={({ field }) => (
              <Select value={field.value ?? ""} onChange={field.onChange} options={customers} placeholder="Select Customer" />
            )}
          />
          <FieldError message={errors.customer_id?.message} />
        </div>
        <div>
          <Label>Property</Label>
          <Controller
            control={control}
            name="property_id"
            render={({ field }) => (
              <Select value={field.value ?? ""} onChange={field.onChange} options={properties} placeholder="Select Property" />
            )}
          />
          <FieldError message={errors.property_id?.message} />
        </div>
        <div>
          <Label>Sub Property</Label>
          <Controller
            control={control}
            name="sub_property_id"
            render={({ field }) => (
              <Select value={field.value ?? ""} onChange={field.onChange} options={subProperties} placeholder="Select Sub Property" />
            )}
          />
          <FieldError message={errors.sub_property_id?.message} />
        </div>
        <div>
          <Label>Pickup Time</Label>
          <Input type="datetime-local" {...register("pickup_time")} />
          <FieldError message={errors.pickup_time?.message} />
        </div>
        <div>
          <Label>Weight Kg</Label>
          <Input type="number" {...register("weight_kg")} />
          <FieldError message={errors.weight_kg?.message} />
        </div>
        <div>
          <Label>Collector</Label>
          <Controller
            control={control}
            name="collector_staff_id"
            render={({ field }) => (
              <Select value={field.value ?? ""} onChange={field.onChange} options={collectors} placeholder="Select Collector" />
            )}
          />
          <FieldError message={errors.collector_staff_id?.message} />
        </div>
        <div>
          <Label>Vehicle</Label>
          <Controller
            control={control}
            name="vehicle_id"
            render={({ field }) => (
              <Select value={field.value ?? ""} onChange={field.onChange} options={vehicles} placeholder="Select Vehicle" />
            )}
          />
          <FieldError message={errors.vehicle_id?.message} />
        </div>
        <div>
          <Label>Source</Label>
          <Input {...register("source")} />
          <FieldError message={errors.source?.message} />
        </div>
        <div className="flex gap-2 md:col-span-2">
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          <Button type="button" variant="outline" onClick={() => navigate(listPath)}>Cancel</Button>
        </div>
      </form>
    </ComponentCard>
  );
}
