/* ─────────────────────────────────────────────────────────────────────
   District boundaries for every Indian state / UT, used by the State and
   District leader dashboard maps.

   One file per state lives in public/geo/states/<slug>.json (loaded on
   demand, so a leader only downloads their own state). Each is a GeoJSON
   FeatureCollection of districts — properties { name, center: [lat, lng] }
   where `center` is a point guaranteed inside the polygon — plus a foreign
   member `outline` with the dissolved state boundary.

   Built from udit-001/india-maps-data (district-level GeoJSON curated from
   public sources), simplified with mapshaper (topology-preserving) to
   ~1–250 KB per state.
   ──────────────────────────────────────────────────────────────────── */
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from "geojson";

export type LatLng = [number, number];

export type DistrictFeature = Feature<Polygon | MultiPolygon, { name: string; center: LatLng }>;

export interface StateGeo extends FeatureCollection<Polygon | MultiPolygon, { name: string; center: LatLng }> {
  state: string;
  outline: Geometry;
  features: DistrictFeature[];
}

const STATES: Array<{ slug: string; name: string; aliases?: string[] }> = [
  { slug: "andaman-and-nicobar-islands", name: "Andaman and Nicobar Islands", aliases: ["Andaman Nicobar", "A&N Islands"] },
  { slug: "andhra-pradesh", name: "Andhra Pradesh" },
  { slug: "arunachal-pradesh", name: "Arunachal Pradesh" },
  { slug: "assam", name: "Assam" },
  { slug: "bihar", name: "Bihar" },
  { slug: "chandigarh", name: "Chandigarh" },
  { slug: "chhattisgarh", name: "Chhattisgarh", aliases: ["Chattisgarh"] },
  { slug: "delhi", name: "Delhi", aliases: ["NCT of Delhi", "New Delhi", "National Capital Territory of Delhi"] },
  { slug: "dnh-and-dd", name: "Dadra and Nagar Haveli and Daman and Diu", aliases: ["Dadra and Nagar Haveli", "Daman and Diu", "DNH and DD"] },
  { slug: "goa", name: "Goa" },
  { slug: "gujarat", name: "Gujarat" },
  { slug: "haryana", name: "Haryana" },
  { slug: "himachal-pradesh", name: "Himachal Pradesh" },
  { slug: "jammu-and-kashmir", name: "Jammu and Kashmir", aliases: ["J&K"] },
  { slug: "jharkhand", name: "Jharkhand" },
  { slug: "karnataka", name: "Karnataka" },
  { slug: "kerala", name: "Kerala" },
  { slug: "ladakh", name: "Ladakh" },
  { slug: "lakshadweep", name: "Lakshadweep" },
  { slug: "madhya-pradesh", name: "Madhya Pradesh" },
  { slug: "maharashtra", name: "Maharashtra" },
  { slug: "manipur", name: "Manipur" },
  { slug: "meghalaya", name: "Meghalaya" },
  { slug: "mizoram", name: "Mizoram" },
  { slug: "nagaland", name: "Nagaland" },
  { slug: "odisha", name: "Odisha", aliases: ["Orissa"] },
  { slug: "puducherry", name: "Puducherry", aliases: ["Pondicherry"] },
  { slug: "punjab", name: "Punjab" },
  { slug: "rajasthan", name: "Rajasthan" },
  { slug: "sikkim", name: "Sikkim" },
  { slug: "tamil-nadu", name: "Tamil Nadu", aliases: ["Tamilnadu", "TN"] },
  { slug: "telangana", name: "Telangana" },
  { slug: "tripura", name: "Tripura" },
  { slug: "uttar-pradesh", name: "Uttar Pradesh", aliases: ["UP"] },
  { slug: "uttarakhand", name: "Uttarakhand", aliases: ["Uttaranchal"] },
  { slug: "west-bengal", name: "West Bengal" },
];

const stateKey = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z]/g, "").replace(/and/g, "");

const STATE_BY_KEY = new Map<string, string>();
for (const st of STATES) for (const n of [st.name, st.slug, ...(st.aliases ?? [])]) STATE_BY_KEY.set(stateKey(n), st.slug);

/** "Tamil Nadu" / "TAMILNADU" / "Orissa" → file slug, or null */
export const resolveStateSlug = (stateName: string | null | undefined): string | null =>
  stateName ? STATE_BY_KEY.get(stateKey(stateName)) ?? null : null;

const cache = new Map<string, Promise<StateGeo>>();

export const loadStateGeo = (slug: string): Promise<StateGeo> => {
  let p = cache.get(slug);
  if (!p) {
    p = fetch(`/geo/states/${slug}.json`).then((r) => {
      if (!r.ok) throw new Error(`No map for ${slug}`);
      return r.json() as Promise<StateGeo>;
    });
    p.catch(() => cache.delete(slug));
    cache.set(slug, p);
  }
  return p;
};

/* ── matching backend district names to map shapes ──
   DB names vary in spelling (Thoothukudi / Thoothukkudi / Tuticorin,
   Kanchipuram / Kancheepuram, The Nilgiris …) and some districts were
   renamed (Gulbarga → Kalaburagi), so compare a loose phonetic-ish key,
   then an alias table, then a unique prefix match. */
const DISTRICT_ALIASES: Record<string, string> = {
  // Tamil Nadu
  tuticorin: "Thoothukkudi",
  trichy: "Tiruchirappalli",
  kanniyakumari: "Kanyakumari",
  kanchipuram: "Kancheepuram",
  madras: "Chennai",
  nagai: "Nagapattinam",
  // carved out of Nagapattinam in 2020; drawn on Nagapattinam's shape
  mayiladuthurai: "Nagapattinam",
  // Karnataka renames
  bangalore: "Bengaluru Urban",
  bengaluru: "Bengaluru Urban",
  bangalorerural: "Bengaluru Rural",
  mysore: "Mysuru",
  gulbarga: "Kalaburagi",
  belgaum: "Belagavi",
  bellary: "Ballari",
  shimoga: "Shivamogga",
  tumkur: "Tumakuru",
  chikmagalur: "Chikkamagaluru",
  bagalkot: "Bagalkote",
  // elsewhere
  gurgaon: "Gurugram",
  mewat: "Nuh",
  allahabad: "Prayagraj",
  faizabad: "Ayodhya",
  calicut: "Kozhikode",
  trivandrum: "Thiruvananthapuram",
  cochin: "Ernakulam",
  bombay: "Mumbai",
  calcutta: "Kolkata",
};

const rawKey = (s: string) =>
  s.toLowerCase().replace(/[^a-z]/g, "").replace(/district$/, "").replace(/^the/, "");

const looseKey = (s: string) =>
  rawKey(s).replace(/h/g, "").replace(/(.)\1+/g, "$1").replace(/[aeiouy]+/g, "a");

/** returns name → feature resolver for one state's districts */
export const makeDistrictMatcher = (geo: StateGeo) => {
  const byKey = new Map(geo.features.map((f) => [looseKey(f.properties.name), f]));
  return (name: string): DistrictFeature | null => {
    const direct = byKey.get(looseKey(name));
    if (direct) return direct;
    const alias = DISTRICT_ALIASES[rawKey(name)];
    if (alias && byKey.get(looseKey(alias))) return byKey.get(looseKey(alias))!;
    const k = looseKey(name);
    if (k.length < 4) return null;
    const prefix = geo.features.filter((f) => {
      const fk = looseKey(f.properties.name);
      return fk.startsWith(k) || k.startsWith(fk);
    });
    return prefix.length === 1 ? prefix[0] : null;
  };
};
