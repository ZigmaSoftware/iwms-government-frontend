export type RouteId = string | number;

const trimSlashes = (segment: RouteId): string =>
  String(segment).replace(/^\/+|\/+$/g, "");

export function createRoutePath(...segments: RouteId[]): string {
  return `/${segments.map(trimSlashes).filter(Boolean).join("/")}`;
}

export function createCrudRoutePaths(masterSegment: string, moduleSegment: string) {
  const listPath = createRoutePath(masterSegment, moduleSegment);

  return {
    listPath,
    newPath: createRoutePath(listPath, "new"),
    editPath: (id: RouteId) => createRoutePath(listPath, id, "edit"),
  };
}

export function appendRouteQuery(
  path: string,
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  });

  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
}
