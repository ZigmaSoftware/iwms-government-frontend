import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { GIcon } from "@/components/ui/gicon";

interface MetricCardProps {
  title: string;
  value: number;
  icon: string;
  loading?: boolean;
}

export function MetricCard({
  title,
  value,
  icon,
  loading = false,
}: MetricCardProps) {
  return (
    <Card className="hover:shadow-md transition">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <GIcon name={icon} className="text-lg text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-3xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}
