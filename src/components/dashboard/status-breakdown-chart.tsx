"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = [
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-1)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export function StatusBreakdownChart({
  counts,
  labels,
  unitLabel,
}: {
  counts: Record<string, number>;
  labels: Record<string, string>;
  /** e.g. "Araç" / "Şoför" / "Sefer" — shown under the center total. */
  unitLabel: string;
}) {
  const data = Object.entries(counts)
    .filter(([, value]) => value > 0)
    .map(([status, value]) => ({ name: labels[status] ?? status, value }));

  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground py-16 text-center text-sm">
        Henüz veri bulunmuyor.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative size-24 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={34}
              outerRadius={46}
              paddingAngle={2}
              isAnimationActive={false}
            >
              {data.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg leading-none font-bold">{total}</span>
          <span className="text-muted-foreground text-[10px]">{unitLabel}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        {data.map((d, index) => (
          <div key={d.name} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              {d.name}
            </span>
            <span className="font-semibold">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
