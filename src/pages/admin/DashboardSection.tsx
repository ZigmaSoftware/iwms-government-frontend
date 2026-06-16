import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GIcon } from "@/components/ui/gicon";

interface DashboardSectionProps {
  title: string;
  icon: string;
  children: React.ReactNode;
}

export function DashboardSection({
  title,
  icon,
  children,
}: DashboardSectionProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3">
        <GIcon name={icon} className="text-xl text-primary" />
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </CardContent>
    </Card>
  );
}
