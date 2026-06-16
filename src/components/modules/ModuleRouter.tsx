import { useModule } from '../../contexts/ModuleContext';
import { CollectionModule } from './CollectionModule';
import { Truck, Users, Scale, Droplet, MapPin, MessageSquare, UserCheck, Package } from 'lucide-react';
import { ModuleHeader } from './ModuleHeader';
import { KPITile } from '../ui/KPITile';

function GenericModuleDashboard({
  title,
  icon,
  color,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="h-full overflow-hidden">
      <ModuleHeader title={title} icon={icon} color={color} />

      <div className="grid grid-cols-4 gap-2 mb-3">
        <KPITile label="Total Records" value={1234} trend={5} compact color={color} />
        <KPITile label="Active" value={89} trend={3} compact color={color} />
        <KPITile label="Pending" value={45} trend={-2} compact color={color} />
        <KPITile label="Efficiency" value={94} unit="%" trend={8} compact color={color} />
      </div>

      <div className="grid grid-cols-2 gap-3" style={{ height: 'calc(100vh - 240px)' }}>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 flex items-center justify-center border border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <div className="text-6xl mb-4">{icon}</div>
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {title}
            </h3>
            <p className="text-sm text-gray-500">Module dashboard content coming soon</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 flex items-center justify-center border border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <div className="text-4xl mb-2">📊</div>
            <p className="text-sm text-gray-500">Analytics & Reports</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ModuleRouter() {
  const { activeModule } = useModule();

  if (!activeModule) return null;

  switch (activeModule) {
    case 'collection':
      return <CollectionModule />;

    case "d2d":
      return (
        <GenericModuleDashboard
          title="Door-to-Door Logistics"
          icon={<Truck className="w-16 h-16" />}
          color="#1E88E5"
        />
      );

    case "resource":
      return (
        <GenericModuleDashboard
          title="Resource Management"
          icon={<Users className="w-16 h-16" />}
          color="#FB8C00"
        />
      );

    case "weighbridge":
      return (
        <GenericModuleDashboard
          title="Weighbridge Management"
          icon={<Scale className="w-16 h-16" />}
          color="#8E24AA"
        />
      );

    case "waste":
      return (
        <GenericModuleDashboard
          title="Waste Management"
          icon={<Droplet className="w-16 h-16" />}
          color="#43A047"
        />
      );

    case "landfill":
      return (
        <GenericModuleDashboard
          title="Landfill Management"
          icon={<MapPin className="w-16 h-16" />}
          color="#6D4C41"
        />
      );

    case "grievance":
      return (
        <GenericModuleDashboard
          title="Grievance Redressal"
          icon={<MessageSquare className="w-16 h-16" />}
          color="#E53935"
        />
      );

    case "attendance":
      return (
        <GenericModuleDashboard
          title="Attendance Tracking"
          icon={<UserCheck className="w-16 h-16" />}
          color="#00ACC1"
        />
      );

    case "asset":
      return (
        <GenericModuleDashboard
          title="Asset Management"
          icon={<Package className="w-16 h-16" />}
          color="#5E35B1"
        />
      );

    default:
      return null;
  }
}
