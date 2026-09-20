import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "#/components/ui/chart";
import { ClientOnly } from "./client-only";

const CHART_HEIGHT = 220;

// One series per picture, coloured from the same token the shelf uses, so
// light and night swap in one place; recharts only ever sees a variable.
const CONFIG: ChartConfig = {
  value: { color: "var(--viz-mark)", label: "value" },
};

const AXIS_TICK = { fill: "var(--ink-faint)", fontSize: 11 } as const;

export function VizCard({
  title,
  subtitle,
  aside,
  children,
}: {
  /** A control that belongs to this picture, set against the title. */
  aside?: ReactNode;
  children: ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <Card className="bg-paper-raised ring-rule">
      <CardHeader className="items-start">
        <CardTitle className="font-normal font-serif text-[20px] text-ink">
          {title}
        </CardTitle>
        {subtitle ? (
          <CardDescription className="text-ink-faint">
            {subtitle}
          </CardDescription>
        ) : null}
        {aside ? <CardAction>{aside}</CardAction> : null}
      </CardHeader>
      <CardContent className="min-w-0">{children}</CardContent>
    </Card>
  );
}

function Frame({ children }: { children: React.ReactElement }) {
  return (
    <ClientOnly
      fallback={<div aria-hidden="true" style={{ height: CHART_HEIGHT }} />}
    >
      <ChartContainer
        className="aspect-auto w-full"
        config={CONFIG}
        style={{ height: CHART_HEIGHT }}
      >
        {children}
      </ChartContainer>
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
  /** Which x labels to show; by default a dense axis thins itself out. */
  interval?: number | "preserveStartEnd" | "equidistantPreserveStart";
}

export function Bars({
  data,
  describe,
  interval = "equidistantPreserveStart",
}: BarsProps) {
  return (
    <Frame>
      <BarChart data={data} margin={{ bottom: 0, left: 0, right: 4, top: 8 }}>
        <CartesianGrid stroke="var(--rule)" vertical={false} />
        <XAxis
          axisLine={{ stroke: "var(--rule-strong)" }}
          dataKey="label"
          interval={interval}
          minTickGap={18}
          tick={AXIS_TICK}
          tickLine={false}
        />
        <YAxis axisLine={false} tick={AXIS_TICK} tickLine={false} width={36} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              className="bg-paper-raised text-ink"
              formatter={(value) => (
                <span className="font-medium text-ink">
                  {describe(Number(value))}
                </span>
              )}
            />
          }
          cursor={{ fill: "var(--paper-sunk)" }}
        />
        <Bar
          dataKey="value"
          fill="var(--color-value)"
          isAnimationActive={false}
          radius={[3, 3, 0, 0]}
        />
      </BarChart>
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
      <LineChart data={data} margin={{ bottom: 0, left: 0, right: 8, top: 8 }}>
        <CartesianGrid stroke="var(--rule)" vertical={false} />
        <XAxis
          axisLine={{ stroke: "var(--rule-strong)" }}
          dataKey="label"
          interval="preserveStartEnd"
          tick={AXIS_TICK}
          tickLine={false}
        />
        <YAxis
          axisLine={false}
          domain={[1, 5]}
          tick={AXIS_TICK}
          tickLine={false}
          ticks={[1, 2, 3, 4, 5]}
          width={24}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              className="bg-paper-raised text-ink"
              formatter={(value) => (
                <span className="font-medium text-ink">
                  {describe(Number(value))}
                </span>
              )}
            />
          }
        />
        <Line
          connectNulls
          dataKey="value"
          dot={{ fill: "var(--color-value)", r: 2.5, strokeWidth: 0 }}
          isAnimationActive={false}
          stroke="var(--color-value)"
          strokeWidth={1.5}
          type="monotone"
        />
      </LineChart>
    </Frame>
  );
}
