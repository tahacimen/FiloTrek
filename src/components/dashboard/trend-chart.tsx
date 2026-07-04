"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function TrendChart({
  data,
}: {
  data: { date: string; count: number }[];
}) {
  const chartData = data.map((row) => ({
    ...row,
    label: new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(row.date)),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: "1px solid var(--border)",
            fontSize: 12,
          }}
          labelFormatter={(label) => `${label} tarihinde tamamlanan sefer`}
        />
        <Area
          type="monotone"
          dataKey="count"
          name="Tamamlanan Sefer"
          stroke="var(--color-chart-1)"
          fill="url(#trendFill)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
