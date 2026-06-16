import type { LocationData, ComplaintData, ActivityData, KPIData } from "@/types";

export const mockLocationData: LocationData = {
  country: 'India',
  state: 'Tamil Nadu',
  city: 'Coimbatore',
  zone: 'East Zone',
  ward: 'Ward 23',
  vehicles: [
    { vehicle_no: 'TN-37-AB-1234', lat: 11.0212, lng: 76.9665, status: 'Running', speed: 45, driver: 'Rajesh Kumar' },
    { vehicle_no: 'TN-37-CD-5678', lat: 11.0145, lng: 76.9558, status: 'Idle', speed: 0, driver: 'Suresh M' },
    { vehicle_no: 'TN-37-EF-9012', lat: 11.0298, lng: 76.9732, status: 'Overspeeding', speed: 85, driver: 'Kumar S' },
    { vehicle_no: 'TN-37-GH-3456', lat: 11.0089, lng: 76.9812, status: 'Running', speed: 52, driver: 'Ravi P' },
    { vehicle_no: 'TN-37-IJ-7890', lat: 11.0356, lng: 76.9445, status: 'Stopped', speed: 0, driver: 'Anand R' },
    { vehicle_no: 'TN-37-KL-2468', lat: 11.0178, lng: 76.9601, status: 'Running', speed: 48, driver: 'Vijay N' },
    { vehicle_no: 'TN-37-MN-1357', lat: 11.0267, lng: 76.9512, status: 'Idle', speed: 0, driver: 'Arun K' },
  ],
};

export const homeKPIs: KPIData[] = [
  { label: 'Total Collections', value: 5650, trend: 8, icon: 'trash' },
  { label: 'Active Vehicles', value: 156, trend: 3, icon: 'truck' },
  { label: 'Pending Complaints', value: 23, trend: -12, icon: 'alert' },
  { label: 'System Efficiency', value: 94, unit: '%', trend: 5, icon: 'trending-up' },
];

export const recentComplaints: ComplaintData[] = [
  { id: "C001", title: "Missed Collection - Ward 12", status: "Open", priority: "High", timestamp: "2h ago", year: "2025" },
  { id: "C002", title: "Vehicle Breakdown - Route A8", status: "In Progress", priority: "High", timestamp: "4h ago", year: "2025" },
  { id: "C003", title: "Late Arrival - Zone East", status: "Open", priority: "Medium", timestamp: "5h ago", year: "2025" },
  { id: "C004", title: "Equipment Malfunction", status: "Resolved", priority: "Low", timestamp: "1d ago", year: "2025" },
  { id: "C005", title: "Route Deviation", status: "In Progress", priority: "Medium", timestamp: "6h ago", year: "2025" },
];

export const recentActivities: ActivityData[] = [
  { id: 'A001', action: 'Route A-12 completed', user: 'Driver #45', timestamp: '10m ago', type: 'success' },
  { id: 'A002', action: 'Delay reported on Route B-08', user: 'Supervisor Team 2', timestamp: '25m ago', type: 'warning' },
  { id: 'A003', action: 'Weighbridge entry recorded', user: 'Operator #12', timestamp: '1h ago', type: 'info' },
  { id: 'A004', action: 'Complaint #C004 resolved', user: 'Support Team', timestamp: '2h ago', type: 'success' },
  { id: 'A005', action: 'Vehicle TN-37-EF-9012 maintenance', user: 'Technician #8', timestamp: '3h ago', type: 'warning' },
  { id: 'A006', action: 'New route created', user: 'Admin', timestamp: '4h ago', type: 'info' },
];

export const collectionModuleData = {
  kpis: [
    { label: 'Total Collections', value: 5650, trend: 8 },
    { label: 'Active Routes', value: 28, trend: 0 },
    { label: 'Operators', value: 156, trend: 3 },
    { label: 'Efficiency', value: 92, unit: '%', trend: 5 },
  ],
  routes: [
    { route: 'Route A-12', operator: 'Team 1', pickups: 145, status: 'Completed', time: '08:45 AM', zone: 'East' },
    { route: 'Route B-08', operator: 'Team 2', pickups: 132, status: 'In Progress', time: '09:12 AM', zone: 'West' },
    { route: 'Route C-15', operator: 'Team 3', pickups: 156, status: 'Completed', time: '08:30 AM', zone: 'North' },
    { route: 'Route D-22', operator: 'Team 4', pickups: 98, status: 'Delayed', time: '10:05 AM', zone: 'South' },
    { route: 'Route E-07', operator: 'Team 5', pickups: 123, status: 'Completed', time: '09:00 AM', zone: 'Central' },
    { route: 'Route F-19', operator: 'Team 6', pickups: 141, status: 'In Progress', time: '09:30 AM', zone: 'East' },
  ],
  trendData: [
    { month: 'Jan', pickups: 4200, exceptions: 180, efficiency: 88 },
    { month: 'Feb', pickups: 4500, exceptions: 145, efficiency: 90 },
    { month: 'Mar', pickups: 4800, exceptions: 120, efficiency: 91 },
    { month: 'Apr', pickups: 5100, exceptions: 98, efficiency: 92 },
    { month: 'May', pickups: 5400, exceptions: 85, efficiency: 93 },
    { month: 'Jun', pickups: 5650, exceptions: 72, efficiency: 94 },
  ],
};

export const moduleConfigs = [
  { id: 'collection', name: 'Collection & Verification', color: '#43A047' },
  { id: 'd2d', name: 'Door-to-Door Logistics', color: '#1E88E5' },
  { id: 'resource', name: 'Resource Management', color: '#FB8C00' },
  { id: 'weighbridge', name: 'Weighbridge Management', color: '#8E24AA' },
  { id: 'waste', name: 'Waste Management', color: '#43A047' },
  { id: 'landfill', name: 'Landfill Management', color: '#6D4C41' },
  { id: 'grievance', name: 'Grievance Redressal', color: '#E53935' },
  { id: 'attendance', name: 'Attendance Tracking', color: '#00ACC1' },
  { id: 'asset', name: 'Asset Management', color: '#5E35B1' },
];
