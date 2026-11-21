import { Text } from '@/shared/components/ui/text';
import { THEME } from '@/shared/lib/theme';
import { useAppliedTheme } from '@/shared/stores/theme-store';
import * as React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

type ScoreChartProps = {
  /** Percentages 0–100, oldest first. */
  points: number[];
  firstLabel: string;
  lastLabel: string;
  /** What a screen reader says in place of the picture. */
  label: string;
};

const WIDTH = 320;
const HEIGHT = 116;
const LEFT = 52;
const RIGHT = 310;
const GRID = [0, 50, 100];

/** Scores over a run of periods: a 0–100 line, oldest on the left. */
export function ScoreChart({
  points,
  firstLabel,
  lastLabel,
  label,
}: ScoreChartProps) {
  const colors = THEME[useAppliedTheme()];
  const x = (index: number) =>
    points.length === 1
      ? (LEFT + RIGHT) / 2
      : LEFT + (index * (RIGHT - LEFT)) / (points.length - 1);
  const y = (value: number) => 110 - value;
  const path = points
    .map(
      (value, index) =>
        `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(value).toFixed(1)}`,
    )
    .join(' ');

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      className="shadow-card border-border bg-card mx-4 rounded-3xl border px-3 pt-3 pb-2"
    >
      <Svg
        width="100%"
        style={{ aspectRatio: WIDTH / HEIGHT }}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        {GRID.map((value) => (
          <React.Fragment key={value}>
            <Line
              x1={LEFT}
              x2={RIGHT}
              y1={y(value)}
              y2={y(value)}
              stroke={colors.border}
              strokeWidth={1}
              strokeDasharray={value === 0 ? undefined : '3 3'}
            />
            <SvgText
              x={LEFT - 8}
              y={y(value) + 4}
              fontSize={12}
              textAnchor="end"
              fill={colors.mutedForeground}
            >
              {`${value}%`}
            </SvgText>
          </React.Fragment>
        ))}
        {points.length > 1 ? (
          <Path
            d={path}
            fill="none"
            stroke={colors.foreground}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {points.map((value, index) => (
          <Circle
            key={index}
            cx={x(index)}
            cy={y(value)}
            r={3.5}
            fill={colors.card}
            stroke={colors.foreground}
            strokeWidth={2}
          />
        ))}
      </Svg>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className={
          points.length === 1
            ? 'flex-row justify-center'
            : 'flex-row justify-between'
        }
        style={{
          paddingLeft: `${(LEFT / WIDTH) * 100}%`,
          paddingRight: `${((WIDTH - RIGHT) / WIDTH) * 100}%`,
        }}
      >
        <Text className="text-muted-foreground text-[12px] leading-tight">
          {firstLabel}
        </Text>
        {points.length > 1 ? (
          <Text className="text-muted-foreground text-[12px] leading-tight">
            {lastLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
