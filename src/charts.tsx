/**
 * Small, hand-drawn visuals. No chart library on purpose — everything here
 * is one shape driven by one number the engine already computed.
 *
 * WHAT IS DELIBERATELY ABSENT: trend lines. The feed carries ONE day. There
 * is no history array, no series, no previous values — verified across all
 * six generated athletes. A line chart here would need invented points, and
 * inventing a measurement is the one thing this product refuses to do.
 *
 * The bands and axes below carry NO training advice. Labelling "form +18 =
 * ready to race" would be a coaching claim with no citation behind it, which
 * the charter forbids. They show position and magnitude, nothing more, and
 * the only interpretive words used ("müde" / "frisch") are the feed schema's
 * own: "Negative = carrying fatigue; positive = fresh".
 */
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { c } from './theme';

// ---------------------------------------------------------------- ring

export function Ring({
  value,
  max,
  center,
  caption,
  size = 96,
  color = c.accentText,
}: {
  value: number;
  /** null / 0 ⇒ no target known: the ring stays a plain track. */
  max: number | null;
  center: string;
  caption: string;
  size?: number;
  color?: string;
}) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const hasTarget = max !== null && max > 0;
  const fraction = hasTarget ? Math.max(0, Math.min(1, value / max)) : 0;

  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G rotation={-90} originX={size / 2} originY={size / 2}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={c.surfaceHi}
              strokeWidth={stroke}
              fill="none"
            />
            {hasTarget ? (
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={color}
                strokeWidth={stroke}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - fraction)}
              />
            ) : null}
          </G>
        </Svg>
        <View style={s.ringCenter}>
          <Text style={s.ringValue}>{center}</Text>
        </View>
      </View>
      <Text style={s.caption}>{caption}</Text>
    </View>
  );
}

// ------------------------------------------------------------ form band

/** Where Form sits between carrying fatigue and being fresh. */
export function FormBand({ form }: { form: number | null }) {
  if (form === null) {
    return <Text style={s.unknown}>Form unbekannt</Text>;
  }
  // A fixed window so the marker means the same thing every morning. Values
  // outside it clamp to the ends rather than rescaling the axis under you.
  const LOW = -40;
  const HIGH = 40;
  const pos = Math.max(0, Math.min(1, (form - LOW) / (HIGH - LOW)));

  return (
    <View style={{ gap: 6 }}>
      <View style={s.band}>
        <View style={[s.bandHalf, { backgroundColor: c.warn, opacity: 0.35 }]} />
        <View style={[s.bandHalf, { backgroundColor: c.personal, opacity: 0.35 }]} />
        <View style={[s.marker, { left: `${pos * 100}%` }]} />
      </View>
      <View style={s.bandLabels}>
        <Text style={s.caption}>müde</Text>
        <Text style={s.caption}>0</Text>
        <Text style={s.caption}>frisch</Text>
      </View>
    </View>
  );
}

// ------------------------------------------------------------- load bars

/** Fitness against fatigue on ONE shared scale, so the gap is readable. */
export function LoadBars({
  ctl,
  atl,
}: {
  ctl: number | null;
  atl: number | null;
}) {
  if (ctl === null || atl === null) {
    return <Text style={s.unknown}>Fitness und Ermüdung unbekannt</Text>;
  }
  const scale = Math.max(ctl, atl, 1);

  const row = (label: string, value: number, color: string) => (
    <View style={s.barRow}>
      <Text style={s.barLabel}>{label}</Text>
      <View style={s.barTrack}>
        <View
          style={[
            s.barFill,
            { width: `${(value / scale) * 100}%`, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={s.barValue}>{value.toFixed(0)}</Text>
    </View>
  );

  return (
    <View style={{ gap: 8 }}>
      {row('Fitness', ctl, c.accentText)}
      {row('Ermüdung', atl, c.warn)}
    </View>
  );
}

// -------------------------------------------------------------- tier bar

/** How much of what you are shown is actually about YOU. */
export function TierBar({
  personal,
  general,
  unavailable,
}: {
  personal: number;
  general: number;
  unavailable: number;
}) {
  const total = Math.max(1, personal + general + unavailable);
  const seg = (n: number, color: string) =>
    n > 0 ? (
      <View style={{ flex: n / total, backgroundColor: color }} />
    ) : null;

  return (
    <View style={{ gap: 8 }}>
      <View style={s.stack}>
        {seg(personal, c.personal)}
        {seg(general, c.general)}
        {seg(unavailable, c.off)}
      </View>
      <View style={s.legend}>
        <Legend color={c.personal} text={`${personal} deine Daten`} />
        <Legend color={c.general} text={`${general} allgemein`} />
        <Legend color={c.off} text={`${unavailable} fehlt`} />
      </View>
    </View>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <View style={s.legendItem}>
      <View style={[s.dot, { backgroundColor: color }]} />
      <Text style={s.caption}>{text}</Text>
    </View>
  );
}

// ----------------------------------------------------------- compare bar

/** One value against the athlete's own baseline. Unknown stays unknown. */
export function CompareBar({
  value,
  baseline,
  format,
  valueLabel,
  baselineLabel,
  missing,
}: {
  value: number | null;
  baseline: number | null;
  format: (n: number) => string;
  valueLabel: string;
  baselineLabel: string;
  /** Shown when `value` is null — names the missing input, never a zero. */
  missing: string;
}) {
  if (baseline === null || baseline <= 0) {
    return <Text style={s.unknown}>{missing}</Text>;
  }
  const scale = Math.max(baseline, value ?? 0) * 1.15;

  return (
    <View style={{ gap: 8 }}>
      <View style={s.barRow}>
        <Text style={s.barLabel}>{valueLabel}</Text>
        <View style={s.barTrack}>
          {value !== null ? (
            <View
              style={[
                s.barFill,
                { width: `${(value / scale) * 100}%`, backgroundColor: c.accentText },
              ]}
            />
          ) : null}
          {/* The baseline is a line across the track, not a second bar. */}
          <View style={[s.tick, { left: `${(baseline / scale) * 100}%` }]} />
        </View>
        <Text style={[s.barValue, value === null && s.unknownInline]}>
          {value === null ? '—' : format(value)}
        </Text>
      </View>
      <Text style={s.caption}>
        {value === null ? missing : `${baselineLabel} ${format(baseline)}`}
      </Text>
    </View>
  );
}

// ------------------------------------------------------------- sparkline

/**
 * The local history, drawn from feeds this device has collected.
 *
 * The engine's feed carries one day and no series, so this is the only
 * trend in the app — and it starts the morning the athlete first opens it.
 * With fewer than two points there is nothing to draw, and it says so
 * instead of drawing a flat line that looks like stability.
 */
export function Sparkline({
  points,
  label,
  height = 44,
  color = c.accentText,
}: {
  points: { date: string; value: number | null }[];
  label: string;
  height?: number;
  color?: string;
}) {
  const usable = points.filter(
    (p): p is { date: string; value: number } => p.value !== null,
  );

  if (usable.length < 2) {
    return (
      <View style={{ gap: 4 }}>
        <Text style={s.caption}>{label}</Text>
        <Text style={s.unknown}>
          {usable.length === 0
            ? 'Noch kein Verlauf aufgezeichnet.'
            : 'Erst ein Tag aufgezeichnet — ab zwei entsteht eine Kurve.'}
        </Text>
      </View>
    );
  }

  const W = 100;
  const values = usable.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = W / (usable.length - 1);

  const xy = usable.map((p, i) => ({
    x: i * step,
    y: height - 6 - ((p.value - min) / span) * (height - 12),
  }));
  const d = xy.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  const last = xy[xy.length - 1];

  return (
    <View style={{ gap: 4 }}>
      <Text style={s.caption}>
        {label} · {usable.length} Tage
      </Text>
      <Svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none">
        <Path d={d} stroke={color} strokeWidth={1.6} fill="none" vectorEffect="non-scaling-stroke" />
        <Circle cx={last.x} cy={last.y} r={2.4} fill={color} />
      </Svg>
      <View style={s.legend}>
        <Text style={s.caption}>{usable[0].date} · {min.toFixed(0)}</Text>
        <Text style={s.caption}>{usable[usable.length - 1].date} · {max.toFixed(0)}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  ringValue: { color: c.text, fontSize: 22, fontWeight: '700' },
  caption: { color: c.dim, fontSize: 11 },
  unknown: { color: c.dim, fontSize: 14, fontStyle: 'italic' },

  band: {
    height: 10,
    borderRadius: 5,
    flexDirection: 'row',
    overflow: 'visible',
    backgroundColor: c.surfaceHi,
  },
  bandHalf: { flex: 1 },
  marker: {
    position: 'absolute',
    top: -3,
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: c.text,
    marginLeft: -2,
  },
  bandLabels: { flexDirection: 'row', justifyContent: 'space-between' },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { color: c.dim, fontSize: 11, width: 62 },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.surfaceHi,
    overflow: 'hidden',
  },
  barFill: { height: 8, borderRadius: 4 },
  barValue: { color: c.text, fontSize: 13, fontWeight: '600', width: 44, textAlign: 'right' },
  unknownInline: { color: c.dim, fontWeight: '400' },
  tick: { position: 'absolute', top: -2, width: 2, height: 12, backgroundColor: c.text, opacity: 0.7 },

  stack: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
