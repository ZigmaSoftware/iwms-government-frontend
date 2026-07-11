/* ─────────────────────────────────────────────────────────────────────
   Shared Tamil Nadu district geography + sample performance data.

   Source of truth for both the admin dashboard's TamilNaduDistrictMap and
   the State (Tamil Nadu) Dashboard page. Polygon points use an
   equirectangular projection:  x = longitude°E,  y = 14.0 − latitude°N
   (viewBox "76 0 5 6.5"  →  lon 76–81°E, lat 7.5–14°N).

   The performance/collection numbers here are illustrative sample data —
   swap for live per-district figures once a state-level API is available.
   ──────────────────────────────────────────────────────────────────── */

export interface DistrictInfo {
  id: string;
  name: string;
  /** SVG polygon points  x = longitude,  y = (14.0 – latitude) */
  points: string;
  perf: number;
  collected: number;
  target: number;
  vehicles: number;
  activeVehicles: number;
  grievances: number;
  resolved: number;
  segregationRate: number;
  localBodies: number;
  wet: number;
  dry: number;
  sanitary: number;
  special: number;
}

export const DISTRICTS: DistrictInfo[] = [
  {
    id: "thiruvallur",
    name: "Thiruvallur",
    points:
      "79.05,0.5 79.45,0.37 79.88,0.35 80.05,0.55 80.05,0.87 " +
      "80.05,1.1 79.85,1.1 79.55,1.12 79.35,1.22 79.2,1.35 " +
      "79.05,1.25 78.95,1.1 78.9,0.88 79.0,0.68",
    perf: 82, collected: 410, target: 500, vehicles: 48, activeVehicles: 42,
    grievances: 28, resolved: 24, segregationRate: 74, localBodies: 52,
    wet: 196, dry: 131, sanitary: 49, special: 33,
  },
  {
    id: "chennai",
    name: "Chennai",
    points:
      "80.05,0.87 80.27,0.87 80.33,0.9 80.33,1.1 80.27,1.15 " +
      "80.05,1.1",
    perf: 92, collected: 1250, target: 1350, vehicles: 85, activeVehicles: 80,
    grievances: 142, resolved: 134, segregationRate: 88, localBodies: 1,
    wet: 600, dry: 400, sanitary: 150, special: 100,
  },
  {
    id: "ranipet",
    name: "Ranipet",
    points:
      "78.9,0.88 79.0,0.68 79.05,0.5 79.45,0.5 79.5,0.65 " +
      "79.45,0.88 79.35,1.05 79.2,1.15 79.05,1.25 78.95,1.1",
    perf: 77, collected: 185, target: 240, vehicles: 22, activeVehicles: 17,
    grievances: 14, resolved: 12, segregationRate: 68, localBodies: 15,
    wet: 89, dry: 59, sanitary: 22, special: 15,
  },
  {
    id: "kancheepuram",
    name: "Kancheepuram",
    points:
      "79.35,1.22 79.55,1.12 79.85,1.1 80.05,1.1 80.27,1.15 " +
      "80.27,1.45 80.1,1.52 79.85,1.52 79.6,1.48 79.45,1.38 " +
      "79.3,1.45 79.2,1.35",
    perf: 83, collected: 320, target: 385, vehicles: 36, activeVehicles: 31,
    grievances: 22, resolved: 20, segregationRate: 76, localBodies: 18,
    wet: 154, dry: 102, sanitary: 38, special: 26,
  },
  {
    id: "chengalpattu",
    name: "Chengalpattu",
    points:
      "79.6,1.48 79.85,1.52 80.1,1.52 80.27,1.45 80.3,1.7 " +
      "80.2,1.78 79.95,1.8 79.75,1.72 79.6,1.6",
    perf: 80, collected: 290, target: 365, vehicles: 32, activeVehicles: 26,
    grievances: 19, resolved: 17, segregationRate: 72, localBodies: 22,
    wet: 139, dry: 93, sanitary: 35, special: 23,
  },
  {
    id: "vellore",
    name: "Vellore",
    points:
      "78.4,0.95 78.42,1.3 78.38,1.6 78.5,1.68 78.72,1.6 " +
      "78.95,1.55 79.05,1.4 79.05,1.25 79.2,1.15 79.2,1.35 " +
      "79.05,1.25 78.95,1.1 78.9,0.88 78.65,0.88",
    perf: 81, collected: 245, target: 305, vehicles: 30, activeVehicles: 25,
    grievances: 18, resolved: 16, segregationRate: 73, localBodies: 20,
    wet: 118, dry: 78, sanitary: 29, special: 20,
  },
  {
    id: "tirupattur",
    name: "Tirupattur",
    points:
      "78.42,1.3 78.4,0.95 78.65,0.88 78.9,0.88 78.88,1.1 " +
      "78.72,1.3 78.72,1.6 78.5,1.68 78.38,1.6",
    perf: 70, collected: 165, target: 235, vehicles: 18, activeVehicles: 13,
    grievances: 12, resolved: 10, segregationRate: 62, localBodies: 16,
    wet: 79, dry: 53, sanitary: 20, special: 13,
  },
  {
    id: "krishnagiri",
    name: "Krishnagiri",
    points:
      "77.5,1.05 77.8,0.92 78.15,0.87 78.4,0.95 78.42,1.3 " +
      "78.38,1.6 78.25,1.85 78.1,2.05 77.85,2.1 77.6,2.05 " +
      "77.45,1.9 77.45,1.6 77.5,1.35",
    perf: 71, collected: 210, target: 295, vehicles: 25, activeVehicles: 18,
    grievances: 16, resolved: 13, segregationRate: 63, localBodies: 24,
    wet: 101, dry: 67, sanitary: 25, special: 17,
  },
  {
    id: "tiruvannamalai",
    name: "Tiruvannamalai",
    points:
      "78.38,1.6 78.5,1.68 78.72,1.6 78.95,1.55 79.05,1.4 " +
      "79.2,1.35 79.3,1.45 79.45,1.38 79.45,1.55 79.5,1.75 " +
      "79.4,1.95 79.25,2.1 79.0,2.18 78.8,2.15 78.6,2.1 " +
      "78.4,2.0 78.25,1.85",
    perf: 72, collected: 220, target: 305, vehicles: 26, activeVehicles: 19,
    grievances: 17, resolved: 14, segregationRate: 64, localBodies: 28,
    wet: 106, dry: 70, sanitary: 26, special: 18,
  },
  {
    id: "dharmapuri",
    name: "Dharmapuri",
    points:
      "77.6,2.05 77.85,2.1 78.1,2.05 78.25,1.85 78.4,2.0 " +
      "78.6,2.1 78.55,2.3 78.45,2.45 78.2,2.5 77.95,2.45 " +
      "77.75,2.35 77.65,2.2",
    perf: 69, collected: 170, target: 245, vehicles: 20, activeVehicles: 14,
    grievances: 13, resolved: 10, segregationRate: 60, localBodies: 19,
    wet: 82, dry: 54, sanitary: 20, special: 14,
  },
  {
    id: "salem",
    name: "Salem",
    points:
      "77.75,2.35 77.95,2.45 78.2,2.5 78.45,2.45 78.55,2.3 " +
      "78.6,2.1 78.8,2.15 79.0,2.18 78.95,2.5 78.75,2.65 " +
      "78.5,2.7 78.3,2.65 78.1,2.55 77.9,2.55 77.75,2.45",
    perf: 87, collected: 520, target: 600, vehicles: 55, activeVehicles: 48,
    grievances: 35, resolved: 32, segregationRate: 81, localBodies: 8,
    wet: 250, dry: 166, sanitary: 62, special: 42,
  },
  {
    id: "kallakurichi",
    name: "Kallakurichi",
    points:
      "79.0,2.18 79.25,2.1 79.4,1.95 79.5,1.75 79.55,1.85 " +
      "79.65,2.05 79.6,2.3 79.45,2.45 79.25,2.5 79.05,2.45 " +
      "78.95,2.35 78.95,2.5",
    perf: 68, collected: 155, target: 228, vehicles: 18, activeVehicles: 12,
    grievances: 12, resolved: 9, segregationRate: 59, localBodies: 22,
    wet: 74, dry: 50, sanitary: 19, special: 12,
  },
  {
    id: "villupuram",
    name: "Villupuram",
    points:
      "79.45,1.55 79.45,1.38 79.6,1.48 79.75,1.72 79.95,1.8 " +
      "80.2,1.78 80.3,1.7 80.3,2.0 80.2,2.15 80.05,2.25 " +
      "79.85,2.35 79.7,2.4 79.6,2.3 79.65,2.05 79.55,1.85 " +
      "79.5,1.75",
    perf: 69, collected: 195, target: 282, vehicles: 23, activeVehicles: 16,
    grievances: 15, resolved: 12, segregationRate: 61, localBodies: 30,
    wet: 94, dry: 62, sanitary: 23, special: 16,
  },
  {
    id: "cuddalore",
    name: "Cuddalore",
    points:
      "79.6,2.3 79.7,2.4 79.85,2.35 80.05,2.25 80.2,2.15 " +
      "80.3,2.0 80.32,2.35 80.3,2.65 80.2,2.8 79.95,2.85 " +
      "79.75,2.82 79.6,2.7 79.5,2.55 79.45,2.45",
    perf: 72, collected: 200, target: 278, vehicles: 24, activeVehicles: 18,
    grievances: 16, resolved: 13, segregationRate: 64, localBodies: 25,
    wet: 96, dry: 64, sanitary: 24, special: 16,
  },
  {
    id: "nilgiris",
    name: "The Nilgiris",
    points:
      "76.5,1.95 76.7,1.75 77.15,1.55 77.5,1.35 77.45,1.6 " +
      "77.45,1.9 77.35,2.1 77.2,2.25 77.05,2.4 76.85,2.45 " +
      "76.65,2.35 76.5,2.15",
    perf: 85, collected: 145, target: 170, vehicles: 18, activeVehicles: 16,
    grievances: 9, resolved: 9, segregationRate: 82, localBodies: 6,
    wet: 70, dry: 46, sanitary: 17, special: 12,
  },
  {
    id: "erode",
    name: "Erode",
    points:
      "77.05,2.4 77.2,2.25 77.35,2.1 77.45,1.9 77.6,2.05 " +
      "77.65,2.2 77.75,2.35 77.75,2.45 77.65,2.55 77.6,2.7 " +
      "77.45,2.82 77.3,2.9 77.1,2.88 76.95,2.75 76.85,2.6 " +
      "76.85,2.45",
    perf: 76, collected: 310, target: 408, vehicles: 36, activeVehicles: 28,
    grievances: 22, resolved: 18, segregationRate: 69, localBodies: 14,
    wet: 149, dry: 99, sanitary: 37, special: 25,
  },
  {
    id: "namakkal",
    name: "Namakkal",
    points:
      "77.75,2.45 77.9,2.55 78.1,2.55 78.3,2.65 78.5,2.7 " +
      "78.5,2.9 78.35,3.05 78.15,3.1 77.95,3.05 77.8,2.95 " +
      "77.65,2.85 77.6,2.7 77.65,2.55",
    perf: 73, collected: 185, target: 253, vehicles: 22, activeVehicles: 16,
    grievances: 14, resolved: 12, segregationRate: 65, localBodies: 17,
    wet: 89, dry: 59, sanitary: 22, special: 15,
  },
  {
    id: "coimbatore",
    name: "Coimbatore",
    points:
      "76.5,2.15 76.65,2.35 76.85,2.45 76.85,2.6 76.95,2.75 " +
      "77.1,2.88 77.05,3.1 76.95,3.25 76.85,3.4 76.72,3.48 " +
      "76.6,3.35 76.55,3.15 76.45,2.95 76.4,2.65 76.45,2.4 " +
      "76.5,2.15",
    perf: 88, collected: 845, target: 960, vehicles: 70, activeVehicles: 62,
    grievances: 55, resolved: 51, segregationRate: 84, localBodies: 12,
    wet: 406, dry: 270, sanitary: 101, special: 68,
  },
  {
    id: "tiruppur",
    name: "Tiruppur",
    points:
      "77.1,2.88 77.3,2.9 77.45,2.82 77.6,2.7 77.65,2.85 " +
      "77.8,2.95 77.8,3.1 77.7,3.25 77.55,3.35 77.35,3.38 " +
      "77.2,3.3 77.1,3.18 77.05,3.1",
    perf: 84, collected: 460, target: 548, vehicles: 48, activeVehicles: 42,
    grievances: 30, resolved: 27, segregationRate: 78, localBodies: 9,
    wet: 221, dry: 147, sanitary: 55, special: 37,
  },
  {
    id: "karur",
    name: "Karur",
    points:
      "77.95,3.05 78.15,3.1 78.35,3.05 78.5,2.9 78.5,2.7 " +
      "78.75,2.65 78.95,2.5 78.95,2.35 79.05,2.45 79.25,2.5 " +
      "79.15,2.7 78.95,2.85 78.85,3.05 78.75,3.25 78.55,3.35 " +
      "78.35,3.35 78.15,3.3 77.95,3.2",
    perf: 74, collected: 175, target: 237, vehicles: 21, activeVehicles: 15,
    grievances: 13, resolved: 11, segregationRate: 66, localBodies: 10,
    wet: 84, dry: 56, sanitary: 21, special: 14,
  },
  {
    id: "perambalur",
    name: "Perambalur",
    points:
      "79.05,2.45 79.25,2.5 79.45,2.45 79.6,2.3 79.5,2.55 " +
      "79.5,2.75 79.4,2.9 79.25,2.98 79.1,2.95 79.0,2.8 " +
      "78.95,2.65 78.95,2.5",
    perf: 67, collected: 110, target: 164, vehicles: 13, activeVehicles: 9,
    grievances: 9, resolved: 7, segregationRate: 58, localBodies: 8,
    wet: 53, dry: 35, sanitary: 13, special: 9,
  },
  {
    id: "ariyalur",
    name: "Ariyalur",
    points:
      "79.5,2.55 79.6,2.7 79.75,2.82 79.95,2.85 80.2,2.8 " +
      "80.2,3.05 80.05,3.1 79.85,3.1 79.65,3.05 79.55,2.95 " +
      "79.5,2.75",
    perf: 65, collected: 95, target: 146, vehicles: 11, activeVehicles: 7,
    grievances: 8, resolved: 6, segregationRate: 56, localBodies: 7,
    wet: 46, dry: 30, sanitary: 11, special: 8,
  },
  {
    id: "tiruchirappalli",
    name: "Tiruchirappalli",
    points:
      "77.8,2.95 77.95,3.2 78.15,3.3 78.35,3.35 78.55,3.35 " +
      "78.75,3.25 78.85,3.05 78.95,2.85 79.15,2.7 79.25,2.98 " +
      "79.1,2.95 79.0,2.8 79.0,3.1 78.95,3.3 78.8,3.5 " +
      "78.65,3.6 78.45,3.65 78.25,3.6 78.1,3.45 78.0,3.3 " +
      "77.9,3.15 77.8,3.1",
    perf: 91, collected: 680, target: 748, vehicles: 58, activeVehicles: 53,
    grievances: 42, resolved: 39, segregationRate: 86, localBodies: 7,
    wet: 326, dry: 218, sanitary: 82, special: 54,
  },
  {
    id: "thanjavur",
    name: "Thanjavur",
    points:
      "79.0,3.1 79.0,2.8 79.1,2.95 79.25,2.98 79.4,2.9 " +
      "79.5,2.75 79.55,2.95 79.65,3.05 79.85,3.1 80.05,3.1 " +
      "80.05,3.35 79.95,3.5 79.75,3.55 79.55,3.6 79.35,3.6 " +
      "79.15,3.55 79.0,3.4",
    perf: 80, collected: 310, target: 388, vehicles: 34, activeVehicles: 28,
    grievances: 21, resolved: 18, segregationRate: 73, localBodies: 16,
    wet: 149, dry: 99, sanitary: 37, special: 25,
  },
  {
    id: "mayiladuthurai",
    name: "Mayiladuthurai",
    points:
      "79.85,3.1 80.05,3.1 80.2,3.05 80.3,2.65 80.32,2.9 " +
      "80.32,3.1 80.25,3.25 80.05,3.35 79.95,3.5 79.85,3.1",
    perf: 74, collected: 130, target: 176, vehicles: 15, activeVehicles: 11,
    grievances: 10, resolved: 8, segregationRate: 66, localBodies: 9,
    wet: 62, dry: 42, sanitary: 16, special: 10,
  },
  {
    id: "nagapattinam",
    name: "Nagapattinam",
    points:
      "79.95,3.5 80.05,3.35 80.25,3.25 80.32,3.1 80.32,3.5 " +
      "80.25,3.65 80.05,3.72 79.85,3.68 79.75,3.55 79.95,3.5",
    perf: 75, collected: 140, target: 187, vehicles: 16, activeVehicles: 12,
    grievances: 11, resolved: 9, segregationRate: 67, localBodies: 11,
    wet: 67, dry: 45, sanitary: 17, special: 11,
  },
  {
    id: "thiruvarur",
    name: "Thiruvarur",
    points:
      "79.15,3.55 79.35,3.6 79.55,3.6 79.75,3.55 79.85,3.68 " +
      "80.05,3.72 80.05,3.9 79.9,4.0 79.7,4.0 79.5,3.95 " +
      "79.3,3.9 79.15,3.8 79.1,3.65",
    perf: 75, collected: 125, target: 167, vehicles: 15, activeVehicles: 11,
    grievances: 10, resolved: 8, segregationRate: 67, localBodies: 10,
    wet: 60, dry: 40, sanitary: 15, special: 10,
  },
  {
    id: "pudukkottai",
    name: "Pudukkottai",
    points:
      "78.45,3.65 78.65,3.6 78.8,3.5 78.95,3.3 79.0,3.4 " +
      "79.15,3.55 79.1,3.65 79.15,3.8 79.3,3.9 79.3,4.1 " +
      "79.15,4.25 78.95,4.3 78.75,4.25 78.55,4.15 78.4,4.0 " +
      "78.3,3.85 78.3,3.65",
    perf: 74, collected: 160, target: 216, vehicles: 19, activeVehicles: 14,
    grievances: 12, resolved: 10, segregationRate: 66, localBodies: 14,
    wet: 77, dry: 51, sanitary: 19, special: 13,
  },
  {
    id: "dindigul",
    name: "Dindigul",
    points:
      "77.35,3.38 77.55,3.35 77.7,3.25 77.8,3.1 77.9,3.15 " +
      "78.0,3.3 78.1,3.45 78.25,3.6 78.3,3.65 78.3,3.85 " +
      "78.25,4.0 78.1,4.1 77.9,4.15 77.75,4.05 77.6,3.95 " +
      "77.5,3.8 77.45,3.6 77.35,3.5",
    perf: 78, collected: 270, target: 347, vehicles: 30, activeVehicles: 24,
    grievances: 19, resolved: 16, segregationRate: 71, localBodies: 20,
    wet: 130, dry: 86, sanitary: 32, special: 22,
  },
  {
    id: "madurai",
    name: "Madurai",
    points:
      "77.5,3.8 77.6,3.95 77.75,4.05 77.9,4.15 78.1,4.1 " +
      "78.25,4.0 78.3,3.85 78.4,4.0 78.55,4.15 78.55,4.35 " +
      "78.4,4.45 78.2,4.5 78.0,4.45 77.8,4.4 77.65,4.3 " +
      "77.55,4.15 77.5,4.0",
    perf: 85, collected: 720, target: 848, vehicles: 62, activeVehicles: 55,
    grievances: 46, resolved: 43, segregationRate: 80, localBodies: 7,
    wet: 346, dry: 230, sanitary: 86, special: 58,
  },
  {
    id: "theni",
    name: "Theni",
    points:
      "76.85,3.4 76.95,3.25 77.05,3.1 77.1,3.18 77.2,3.3 " +
      "77.35,3.38 77.35,3.5 77.45,3.6 77.5,3.8 77.5,4.0 " +
      "77.4,4.1 77.25,4.1 77.05,4.05 76.9,3.9 76.8,3.7 " +
      "76.75,3.55 76.8,3.4",
    perf: 73, collected: 155, target: 212, vehicles: 18, activeVehicles: 13,
    grievances: 12, resolved: 10, segregationRate: 65, localBodies: 12,
    wet: 74, dry: 50, sanitary: 19, special: 12,
  },
  {
    id: "sivaganga",
    name: "Sivaganga",
    points:
      "78.55,4.15 78.75,4.25 78.95,4.3 79.15,4.25 79.3,4.1 " +
      "79.3,3.9 79.5,3.95 79.5,4.2 79.45,4.45 79.3,4.55 " +
      "79.05,4.6 78.85,4.55 78.65,4.5 78.55,4.35",
    perf: 72, collected: 155, target: 215, vehicles: 18, activeVehicles: 13,
    grievances: 12, resolved: 10, segregationRate: 64, localBodies: 13,
    wet: 74, dry: 50, sanitary: 19, special: 12,
  },
  {
    id: "virudhunagar",
    name: "Virudhunagar",
    points:
      "77.55,4.15 77.65,4.3 77.8,4.4 78.0,4.45 78.2,4.5 " +
      "78.4,4.45 78.55,4.35 78.65,4.5 78.65,4.7 78.5,4.82 " +
      "78.3,4.85 78.1,4.8 77.9,4.72 77.7,4.65 77.55,4.5 " +
      "77.5,4.3",
    perf: 76, collected: 210, target: 276, vehicles: 24, activeVehicles: 18,
    grievances: 15, resolved: 13, segregationRate: 69, localBodies: 16,
    wet: 101, dry: 67, sanitary: 25, special: 17,
  },
  {
    id: "ramanathapuram",
    name: "Ramanathapuram",
    points:
      "78.65,4.5 78.85,4.55 79.05,4.6 79.3,4.55 79.45,4.45 " +
      "79.5,4.2 79.5,3.95 79.7,4.0 79.9,4.0 80.05,3.9 " +
      "80.05,4.2 80.0,4.55 79.85,4.8 79.6,4.95 79.35,5.0 " +
      "79.1,4.98 78.9,4.9 78.7,4.82 78.5,4.82",
    perf: 70, collected: 180, target: 257, vehicles: 21, activeVehicles: 15,
    grievances: 14, resolved: 11, segregationRate: 62, localBodies: 15,
    wet: 86, dry: 58, sanitary: 22, special: 14,
  },
  {
    id: "thoothukudi",
    name: "Thoothukudi",
    points:
      "77.7,4.65 77.9,4.72 78.1,4.8 78.3,4.85 78.5,4.82 " +
      "78.7,4.82 78.7,5.1 78.65,5.35 78.55,5.55 78.35,5.6 " +
      "78.15,5.55 78.0,5.4 77.85,5.2 77.75,4.95 77.65,4.8",
    perf: 77, collected: 230, target: 299, vehicles: 26, activeVehicles: 20,
    grievances: 17, resolved: 15, segregationRate: 70, localBodies: 10,
    wet: 110, dry: 74, sanitary: 28, special: 18,
  },
  {
    id: "tirunelveli",
    name: "Tirunelveli",
    points:
      "77.2,4.75 77.35,4.7 77.55,4.5 77.65,4.8 77.75,4.95 " +
      "77.85,5.2 78.0,5.4 78.15,5.55 78.35,5.6 78.35,5.75 " +
      "78.15,5.82 77.95,5.8 77.75,5.72 77.6,5.55 77.45,5.4 " +
      "77.35,5.2 77.2,5.0",
    perf: 79, collected: 290, target: 367, vehicles: 32, activeVehicles: 25,
    grievances: 21, resolved: 18, segregationRate: 72, localBodies: 8,
    wet: 139, dry: 93, sanitary: 35, special: 23,
  },
  {
    id: "tenkasi",
    name: "Tenkasi",
    points:
      "76.8,3.7 76.9,3.9 77.05,4.05 77.25,4.1 77.4,4.1 " +
      "77.5,4.3 77.5,4.5 77.35,4.7 77.2,4.75 77.2,5.0 " +
      "77.1,5.1 76.97,5.08 76.85,4.95 76.8,4.7 76.75,4.45 " +
      "76.72,4.15 76.75,3.9",
    perf: 71, collected: 155, target: 218, vehicles: 18, activeVehicles: 13,
    grievances: 12, resolved: 10, segregationRate: 63, localBodies: 14,
    wet: 74, dry: 50, sanitary: 19, special: 12,
  },
  {
    id: "kanyakumari",
    name: "Kanyakumari",
    points:
      "76.97,5.08 77.1,5.1 77.2,5.0 77.35,5.2 77.45,5.4 " +
      "77.6,5.55 77.75,5.72 77.95,5.8 77.55,5.93 77.2,5.75 " +
      "76.97,5.5",
    perf: 86, collected: 195, target: 227, vehicles: 22, activeVehicles: 19,
    grievances: 13, resolved: 12, segregationRate: 83, localBodies: 6,
    wet: 94, dry: 62, sanitary: 23, special: 16,
  },
];

/* Traced TN state boundary (AP border NE → Bay of Bengal → Kanyakumari tip
   → Kerala border → Karnataka border → back to AP NE). */
export const TN_OUTLINE =
  "79.88,0.35 80.27,0.87 80.33,0.9 80.33,1.1 " +
  "80.33,1.5 80.3,1.7 80.3,2.0 80.32,2.35 80.3,2.65 80.32,2.9 80.32,3.1 " +
  "80.32,3.5 80.25,3.65 80.05,3.72 80.05,3.9 80.05,4.2 80.0,4.55 " +
  "79.85,4.8 79.6,4.95 79.35,5.0 79.1,4.98 78.9,4.9 78.7,4.82 " +
  "78.65,5.35 78.55,5.55 78.35,5.75 78.15,5.82 " +
  "77.95,5.8 77.55,5.93 77.2,5.75 76.97,5.5 " +
  "76.85,4.95 76.8,4.7 76.75,4.45 76.72,4.15 76.75,3.9 76.8,3.7 " +
  "76.75,3.55 76.72,3.48 76.6,3.35 76.55,3.15 76.45,2.95 76.4,2.65 " +
  "76.45,2.4 76.5,2.15 " +
  "76.5,1.95 76.7,1.75 77.15,1.55 77.5,1.3 77.8,1.1 " +
  "78.15,0.87 78.5,0.6 78.9,0.45 79.45,0.37";

/** Centroid of a district polygon in the map's projected coordinates. */
export function districtCentroid(points: string): { x: number; y: number } {
  const pts = points.trim().split(/\s+/).map((p) => {
    const [x, y] = p.split(",").map(Number);
    return { x, y };
  });
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  };
}
