export interface GeofenceSite {
  siteName: string;
  siteType: string;
  latlong: string[]; // "lat,lng"
  type: "Polygon" | "Circle";
  radius: number;
}

export interface GeofenceApiResponse {
  data: {
    siteParent: {
      site: GeofenceSite[];
    }[];
  };
}
