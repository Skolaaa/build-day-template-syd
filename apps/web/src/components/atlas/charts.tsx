import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ClientOnly } from "./client-only";

const CHART_HEIGHT = 220;

// Colours live in CSS (see styles.css) so light and night swap in one place;
// recharts only ever sees a variable reference.
const TOOLTIP_STYLE = {
  background: "var(--paper-raised)",
  border: "1px solid var(--rule-strong)",
  borderRadius: 3,
  boxShadow: "0 8px 20px -12px var(--shadow)",
  color: "var(--ink)",
  fontSize: 12.5,
  padding: "6px 10px",
} as const;

export function VizCard({
  title,
  subtitle,
  children,
}: {
  children: ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <section className="viz-card">
      <header className="mb-4">
        <h2 className="viz-title">{title}</h2>
        {subtitle ? <p className="viz-subtitle">{subtitle}</p> : null}
      </header>
      {children}
    </section>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <ClientOnly
      fallback={<div aria-hidden="true" style={{ height: CHART_HEIGHT }} />}
    >
      <div style={{ height: CHART_HEIGHT, width: "100%" }}>{children}</div>
    </ClientOnly>
  );
}

export interface Datum {
  label: string;
  value: number;
}

interface BarsProps {
  data: Datum[];
  /** How to say a value in the tooltip: "1,204 words". */
  describe: (value: number) => string;
  /** Show only every n-th x label, for dense axes. */
  interval?: number;
}

export function Bars({ data, describe, interval = 0 }: BarsProps) {
  return (
    <Frame>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ bottom: 0, left: 0, right: 4, top: 8 }}>
          <CartesianGrid stroke="var(--rule)" vertical={false} />
          <XAxis
            axisLine={{ stroke: "var(--rule-strong)" }}
            dataKey="label"
            interval={interval}
            tick={{ fill: "var(--ink-faint)", fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tick={{ fill: "var(--ink-faint)", fontSize: 11 }}
            tickLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: "var(--paper-sunk)" }}
            formatter={(value) => [describe(Number(value)), ""]}
            separator=""
          />
          <Bar dataKey="value" fill="var(--viz-mark)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}

interface MoodLineProps {
  data: { label: string; value: number | null }[];
  describe: (value: number) => string;
}

export function MoodLine({ data, describe }: MoodLineProps) {
  return (
    <Frame>
      <ResponsiveContainer>
        <LineChart
          data={data}
          margin={{ bottom: 0, left: 0, right: 8, top: 8 }}
        >
          <CartesianGrid stroke="var(--rule)" vertical={false} />
          <XAxis
            axisLine={{ stroke: "var(--rule-strong)" }}
            dataKey="label"
            interval="preserveStartEnd"
            tick={{ fill: "var(--ink-faint)", fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            domain={[1, 5]}
            tick={{ fill: "var(--ink-faint)", fontSize: 11 }}
            tickLine={false}
            ticks={[1, 2, 3, 4, 5]}
            width={24}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value) => [describe(Number(value)), ""]}
            separator=""
          />
          <Line
            connectNulls
            dataKey="value"
            dot={{ fill: "var(--viz-mark)", r: 2.5, strokeWidth: 0 }}
            stroke="var(--viz-mark)"
            strokeWidth={1.5}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </Frame>
  );
}
