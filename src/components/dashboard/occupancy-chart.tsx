"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { vehicleTypeLabels } from "@/lib/labels";
import type { VehicleType } from "@/generated/prisma/enums";

type OccupancyRow = {
  vehicleType: VehicleType;
  total: number;
  available: number;
  inUse: number;
  maintenance: number;
};

export function OccupancyChart({ data }: { data: OccupancyRow[] }) {
  const chartData = data
    .filter((row) => row.total > 0)
    .map((row) => ({
      name: vehicleTypeLabels[row.vehicleType],
      Müsait: row.available,
      Seferde: row.inUse,
      Bakımda: row.maintenance,
    }));

  if (chartData.length === 0) {
    return (
      <p className="text-muted-foreground py-16 text-center text-sm">
        Henüz araç bulunmuyor.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: "1px solid var(--border)",
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          dataKey="Müsait"
          stackId="a"
          fill="var(--color-chart-2)"
          radius={[0, 0, 0, 0]}
          isAnimationActive={false}
        />
        <Bar
          dataKey="Seferde"
          stackId="a"
          fill="var(--color-chart-1)"
          isAnimationActive={false}
        />
        <Bar
          dataKey="Bakımda"
          stackId="a"
          fill="var(--color-chart-4)"
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
