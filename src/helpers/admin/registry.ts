import { adminEndpoints, type AdminEntity } from "./endpoints";
import { createCrudHelpers, type CrudHelpers } from "./crudHelpers";

type AdminApiRegistry = {
  [K in AdminEntity]: CrudHelpers;
};

export const adminApi: AdminApiRegistry = Object.entries(adminEndpoints).reduce(
  (map, [key, path]) => {
    map[key as AdminEntity] = createCrudHelpers(path);
    return map;
  },
  {} as AdminApiRegistry
);

export const getAdminApi = (entity: AdminEntity) => adminApi[entity];

export * from "./endpoints";
export * from "./crudHelpers";
