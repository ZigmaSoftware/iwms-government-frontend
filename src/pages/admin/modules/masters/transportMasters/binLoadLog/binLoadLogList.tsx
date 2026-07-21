import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Column } from "primereact/column";

import { DataTable } from "@/components/common/SafeDataTable";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/helpers/admin/registry";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { normalizeList } from "@/utils/forms";

export default function BinLoadLogList() {
  const navigate = useNavigate();
  const { encTransportMaster, encBinLoadLog } = getEncryptedRoute();
  const { newPath, editPath } = createCrudRoutePaths(encTransportMaster, encBinLoadLog);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.binLoadLogs.readAll().then((res) => setRows(normalizeList(res))).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => navigate(newPath)}>New</Button></div>
      <DataTable value={rows} loading={loading} paginator rows={10}>
        <Column field="vehicle_id" header="Vehicle" />
        <Column field="property_id" header="Property" />
        <Column field="sub_property_id" header="Sub Property" />
        <Column field="weight_kg" header="Weight Kg" />
        <Column field="source_type" header="Source Type" />
        <Column field="event_time" header="Event Time" />
        <Column header="Action" body={(row) => <Button variant="outline" onClick={() => navigate(editPath(row.unique_id))}>Edit</Button>} />
      </DataTable>
    </div>
  );
}
