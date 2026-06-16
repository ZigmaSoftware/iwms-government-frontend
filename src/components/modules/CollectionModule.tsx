import { Trash2, TrendingUp, Users, MapPin } from 'lucide-react';
import { ModuleHeader } from './ModuleHeader';
import { KPITile } from '../ui/KPITile';
import { DataCard } from '../ui/DataCard';
import { LeafletMapContainer } from '../map/LeafletMapContainer';
import { CompactTable } from '../ui/CompactTable';
import { StatusChip } from '../ui/StatusChip';
import { useModule } from '../../contexts/ModuleContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

const mockVehicles = [
  {
    vehicle_no: "TN-37-AB-1234",
    lat: 11.0212,
    lng: 76.9665,
    status: "Running" as const,
    driver: "Rajesh Kumar",
    speed: 48,
    updated_at: "2024-01-01T09:00:00Z",
    geo: {
      continent: "Asia",
      country: "India",
      state: "Tamil Nadu",
      district: "Coimbatore",
      zone: "East",
      ward: "Ward 12",
    },
  },
  {
    vehicle_no: "TN-37-CD-5678",
    lat: 11.0145,
    lng: 76.9558,
    status: "Idle" as const,
    driver: "Suresh M",
    speed: 0,
    updated_at: "2024-01-01T09:05:00Z",
    geo: {
      continent: "Asia",
      country: "India",
      state: "Tamil Nadu",
      district: "Coimbatore",
      zone: "West",
      ward: "Ward 28",
    },
  },
  {
    vehicle_no: "TN-37-EF-9012",
    lat: 11.0298,
    lng: 76.9732,
    status: "Running" as const,
    driver: "Kumar S",
    speed: 84,
    updated_at: "2024-01-01T09:12:00Z",
    geo: {
      continent: "Asia",
      country: "India",
      state: "Tamil Nadu",
      district: "Coimbatore",
      zone: "South",
      ward: "Ward 9",
    },
  },
];

const trendData = [
  { month: 'Jan', pickups: 4200, exceptions: 180 },
  { month: 'Feb', pickups: 4500, exceptions: 145 },
  { month: 'Mar', pickups: 4800, exceptions: 120 },
  { month: 'Apr', pickups: 5100, exceptions: 98 },
  { month: 'May', pickups: 5400, exceptions: 85 },
  { month: 'Jun', pickups: 5650, exceptions: 72 },
];

const operatorData = [
  { name: 'On Time', value: 85, color: '#43A047' },
  { name: 'Delayed', value: 12, color: '#FFA726' },
  { name: 'Missed', value: 3, color: '#EF5350' },
];

const tableData = [
  { route: 'Route A-12', operator: 'Team 1', pickups: 145, status: 'Completed', time: '08:45 AM' },
  { route: 'Route B-08', operator: 'Team 2', pickups: 132, status: 'In Progress', time: '09:12 AM' },
  { route: 'Route C-15', operator: 'Team 3', pickups: 156, status: 'Completed', time: '08:30 AM' },
  { route: 'Route D-22', operator: 'Team 4', pickups: 98, status: 'Delayed', time: '10:05 AM' },
];

export function CollectionModule() {
  const { activeView } = useModule();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  const containerClass = cn(
    'h-full overflow-hidden rounded-3xl border p-4 space-y-4 transition-colors duration-300',
    isDarkMode
      ? 'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-slate-100 border-slate-800 shadow-[0_35px_80px_rgba(2,6,23,0.85)]'
      : 'bg-white text-slate-900 border-gray-100'
  );

  const cardTone = isDarkMode
    ? 'bg-slate-900/70 border-slate-800 text-slate-100 shadow-[0_25px_65px_rgba(2,6,23,0.55)]'
    : '';

  if (activeView === 'analytics') {
    return (
      <div className={containerClass}>
        <ModuleHeader title="Collection & Verification Analytics" icon={<Trash2 className="w-5 h-5" />} color="#43A047" />

        <div className="grid grid-cols-4 gap-2 mb-3">
          <KPITile label="Avg Completion" value={92} unit="%" trend={5} compact />
          <KPITile label="Daily Pickups" value={5650} trend={8} compact />
          <KPITile label="Exception Rate" value={1.3} unit="%" trend={-15} compact />
          <KPITile label="Active Teams" value={28} compact />
        </div>

        <div className="grid grid-cols-2 gap-3" style={{ height: 'calc(100vh - 240px)' }}>
          <DataCard title="Pickup Trends" compact className={cardTone}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.1} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="pickups" stroke="#43A047" strokeWidth={2} />
                <Line type="monotone" dataKey="exceptions" stroke="#EF5350" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </DataCard>

          <DataCard title="Performance Distribution" compact className={cardTone}>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={operatorData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}%`}
                >
                  {operatorData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </DataCard>

          <DataCard title="Weekly Comparison" compact className={cardTone}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={trendData.slice(-4)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.1} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="pickups" fill="#43A047" />
              </BarChart>
            </ResponsiveContainer>
          </DataCard>

          <DataCard title="Top Performers" compact className={cardTone}>
            <div className="space-y-2">
              {[
                { name: 'Team Alpha', score: 98, trend: 5 },
                { name: 'Team Beta', score: 95, trend: 3 },
                { name: 'Team Gamma', score: 92, trend: -2 },
                { name: 'Team Delta', score: 89, trend: 1 },
              ].map((team, idx) => (
                <div key={idx} className={cn(
                  'flex items-center justify-between p-2 rounded-lg',
                  isDarkMode ? 'bg-slate-900/70 border border-slate-800/70' : 'bg-gray-50'
                )}>
                  <div>
                    <p className="text-sm font-medium">{team.name}</p>
                    <p className="text-xs text-gray-500">Score: {team.score}%</p>
                  </div>
                  <div className={`text-sm font-semibold ${team.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {team.trend > 0 ? '+' : ''}{team.trend}%
                  </div>
                </div>
              ))}
            </div>
          </DataCard>
        </div>
      </div>
    );
  }

  if (activeView === 'map') {
    return (
      <div className={containerClass}>
        <ModuleHeader title="Collection Route Map" icon={<Trash2 className="w-5 h-5" />} color="#43A047" />
        <DataCard className={cn("h-[calc(100vh-200px)]", cardTone)}>
          <LeafletMapContainer vehicles={mockVehicles} height="100%" />
        </DataCard>
      </div>
    );
  }

  if (activeView === 'table') {
    return (
      <div className={containerClass}>
        <ModuleHeader title="Collection Data" icon={<Trash2 className="w-5 h-5" />} color="#43A047" />
        <DataCard className={cn("h-[calc(100vh-200px)]", cardTone)}>
          <CompactTable
            columns={[
              { key: 'route', label: 'Route' },
              { key: 'operator', label: 'Operator' },
              { key: 'pickups', label: 'Pickups' },
              { key: 'status', label: 'Status', render: (val) => <StatusChip status={String(val)} /> },
              { key: 'time', label: 'Time' },
            ]}
            data={tableData}
            maxHeight="calc(100vh - 280px)"
          />
        </DataCard>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <ModuleHeader title="Collection & Verification" icon={<Trash2 className="w-5 h-5" />} color="#43A047" />

      <div className="grid grid-cols-4 gap-2 mb-3">
        <KPITile label="Total Collections" value={5650} icon={<Trash2 className="w-5 h-5" />} trend={8} color="#43A047" compact />
        <KPITile label="Active Routes" value={28} icon={<MapPin className="w-5 h-5" />} color="#1E88E5" compact />
        <KPITile label="Operators" value={156} icon={<Users className="w-5 h-5" />} trend={3} color="#FB8C00" compact />
        <KPITile label="Efficiency" value={92} unit="%" icon={<TrendingUp className="w-5 h-5" />} trend={5} color="#43A047" compact />
      </div>

      <div className="grid grid-cols-3 gap-3" style={{ height: 'calc(100vh - 240px)' }}>
        <div className="col-span-2">
          <DataCard title="Route Heatmap" className={cn("h-full", cardTone)}>
            <LeafletMapContainer vehicles={mockVehicles} height="calc(100vh - 300px)" />
          </DataCard>
        </div>

        <div className="space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 240px)' }}>
          <DataCard title="Today's Summary" compact className={cardTone}>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-600 dark:text-gray-400">Completed</span>
                <span className="text-sm font-bold text-green-600">145</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-600 dark:text-gray-400">In Progress</span>
                <span className="text-sm font-bold text-yellow-600">12</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-600 dark:text-gray-400">Pending</span>
                <span className="text-sm font-bold text-red-600">8</span>
              </div>
            </div>
          </DataCard>

          <DataCard title="Recent Routes" compact className={cardTone}>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {tableData.slice(0, 4).map((item, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'p-2 rounded text-xs',
                    isDarkMode ? 'bg-slate-900/70 border border-slate-800/70 text-slate-200' : 'bg-gray-50'
                  )}
                >
                  <div className="font-medium">{item.route}</div>
                  <div className={cn("flex justify-between mt-1", isDarkMode ? "text-slate-400" : "text-gray-500")}>
                    <span>{item.operator}</span>
                    <StatusChip status={item.status} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          </DataCard>
        </div>
      </div>
    </div>
  );
}
