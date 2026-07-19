"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const MONTHS_TR = [
  "Oca", "Şub", "Mar", "Nis", "May", "Haz",
  "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
];

function formatMonth(key: string) {
  const [year, month] = key.split("-").map(Number);
  // Show the year only on January, to keep the axis uncluttered.
  return month === 1 ? `${MONTHS_TR[0]} ${year}` : MONTHS_TR[month - 1];
}

const revenueFormatter = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 0,
});

/**
 * Supplier dashboard: monthly revenue (agreed price of completed shipments,
 * bars) alongside completed-shipment count (line, right axis) — replaces the
 * old fleet-occupancy chart with a business-performance view.
 */
export function MonthlyRevenueChart({
  data,
}: {
  data: { month: string; revenue: number; count: number }[];
}) {
  const chartData = data.map((row) => ({ ...row, label: formatMonth(row.month) }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          yAxisId="revenue"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={70}
          tickFormatter={(v: number) =>
            v >= 1000 ? `${Math.round(v / 1000)}B₺` : `${v}₺`
          }
        />
        <YAxis
          yAxisId="count"
          orientation="right"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          width={32}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: "1px solid var(--border)",
            fontSize: 12,
          }}
          formatter={(value, name) =>
            name === "Ciro"
              ? [`${revenueFormatter.format(Number(value))} ₺`, name]
              : [`${Number(value)} sefer`, name]
          }
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          yAxisId="revenue"
          dataKey="revenue"
          name="Ciro"
          fill="var(--color-chart-1)"
          radius={[6, 6, 0, 0]}
          maxBarSize={44}
          isAnimationActive={false}
        />
        <Line
          yAxisId="count"
          type="monotone"
          dataKey="count"
          name="Sefer"
          stroke="var(--color-chart-2)"
          strokeWidth={2}
          dot={{ r: 3 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
