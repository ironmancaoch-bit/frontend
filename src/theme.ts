/** Shared palette and text styles. One place, so three screens cannot drift. */
import { StyleSheet } from 'react-native';

export const c = {
  bg: '#101418',
  surface: '#1d242b',
  surfaceHi: '#252e37',
  line: '#2a333d',

  text: '#ffffff',
  body: '#c7d0d9',
  dim: '#7c8996',

  accent: '#2f6fed',
  accentDim: '#16304f',
  accentText: '#6fa8ff',

  warn: '#e8833a',
  warnBg: '#3a2416',
  warnText: '#e6d9cc',

  personal: '#4caf7d',
  general: '#d8a13a',
  off: '#7c8996',
};

export const t = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { padding: 16, paddingBottom: 32 },

  h1: { color: c.text, fontSize: 22, fontWeight: '700' },
  section: {
    color: c.text,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 10,
  },
  body: { color: c.body, fontSize: 14, lineHeight: 21 },
  hint: { color: c.dim, fontSize: 12, lineHeight: 18 },

  card: {
    backgroundColor: c.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    gap: 4,
  },
  cardTitle: { color: c.text, fontSize: 14, fontWeight: '600' },
});
