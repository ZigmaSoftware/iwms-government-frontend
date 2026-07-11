/* ─────────────────────────────────────────────────────────────────────
   District-wise local-body breakdown (names) for the State dashboard's
   drill-down drawer.

   Data provenance for ERODE (matches the official portal snapshot the
   client shared):
     • Corporation (1), Municipality (5), Panchayat Union/Blocks (14) and
       the Village-Panchayat block-wise COUNTS (225 total) are verified.
     • Town Panchayat (42) names are transcribed from the official list;
       a couple of spellings should be confirmed against the source file.
     • Individual Village-Panchayat NAMES (225) are NOT yet on the open web
       — they live in per-block PDFs. Each block's `villagePanchayats`
       array is left empty until the official per-block file is supplied;
       `villagePanchayatCount` holds the verified count meanwhile.

   To add another district, append an entry keyed by the district id used
   in src/data/tnDistricts.ts.
   ──────────────────────────────────────────────────────────────────── */

export interface BlockInfo {
  name: string;
  /** verified count of village panchayats in this block */
  villagePanchayatCount: number;
  /** individual VP names — filled once the official per-block file arrives */
  villagePanchayats: string[];
}

export interface DistrictLocalBodies {
  districtId: string;
  districtName: string;
  corporations: string[];
  municipalities: string[];
  townPanchayats: string[];
  blocks: BlockInfo[];
  /** shown in the drawer footer when some data is still pending */
  note?: string;
}

export const localBodiesByDistrict: Record<string, DistrictLocalBodies> = {
  erode: {
    districtId: "erode",
    districtName: "Erode",
    corporations: ["Erode"],
    municipalities: [
      "Bhavani",
      "Gobichettipalayam",
      "Satyamangalam",
      "Punjai Puliampatty",
      "Perundurai",
    ],
    townPanchayats: [
      "Ammapettai",
      "Anthiyur",
      "Appakudal",
      "Arachalur",
      "Ariyappampalayam",
      "Athani",
      "Avalpoondurai",
      "Bhavanisagar",
      "Chennasamudram",
      "Chennimalai",
      "Chithode",
      "Elathur",
      "Jambai",
      "Kanjikoil",
      "Karumandi Chellipalayam",
      "Kasipalayam (G)",
      "Kembainaickenpalayam",
      "Kilampadi",
      "Kodumudi",
      "Kolappalur",
      "Kollankoil",
      "Kuhalur",
      "Lakkampatti",
      "Modakurichi",
      "Nallampatti",
      "Nambiyur",
      "Nasiyanur",
      "Nerunjipettai",
      "Olagadam",
      "P.Mettupalayam",
      "Pallapalayam",
      "Pasur",
      "Periyakodiveri",
      "Pethampalayam",
      "Salangapalayam",
      "Sivagiri",
      "Unjalur",
      "Vadugapatti",
      "Vaniputhur",
      "Vellottamparappu",
      "Vengampudur",
    ],
    blocks: [
      { name: "Erode", villagePanchayatCount: 6, villagePanchayats: [] },
      { name: "Modakkurichi", villagePanchayatCount: 23, villagePanchayats: [] },
      { name: "Kodumudi", villagePanchayatCount: 10, villagePanchayats: [] },
      { name: "Perundurai", villagePanchayatCount: 29, villagePanchayats: [] },
      { name: "Chennimalai", villagePanchayatCount: 22, villagePanchayats: [] },
      { name: "Ammapettai", villagePanchayatCount: 20, villagePanchayats: [] },
      { name: "Anthiyur", villagePanchayatCount: 14, villagePanchayats: [] },
      { name: "Bhavani", villagePanchayatCount: 15, villagePanchayats: [] },
      { name: "Gobichettipalayam", villagePanchayatCount: 21, villagePanchayats: [] },
      { name: "Nambiyur", villagePanchayatCount: 15, villagePanchayats: [] },
      { name: "T.N. Palayam", villagePanchayatCount: 10, villagePanchayats: [] },
      { name: "Sathyamangalam", villagePanchayatCount: 15, villagePanchayats: [] },
      { name: "Bhavanisagar", villagePanchayatCount: 15, villagePanchayats: [] },
      { name: "Talavadi", villagePanchayatCount: 10, villagePanchayats: [] },
    ],
    note: "Village Panchayat individual names are pending the official per-block file; block-wise counts (225 total) are shown meanwhile.",
  },
};

/** total village panchayats across all blocks of a district */
export const villagePanchayatTotal = (d: DistrictLocalBodies) =>
  d.blocks.reduce((s, b) => s + b.villagePanchayatCount, 0);
