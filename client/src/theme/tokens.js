/* ─── Color palettes ─── */

const lightColors = {
  bg: { canvas: '#F7F2E8', surface: '#FFFFFF', surfaceAlt: '#FAF7F1' },
  border: { subtle: '#E6DDCF' },
  text: { primary: '#1F2328', muted: '#5B5F64', faint: '#6B6F74' },
  accent: { clay: '#A0634A', clayHover: '#8B5340', moss: '#657655', indigo: '#2A536D' },
  state: {
    success: '#2F6B4F', warning: '#B07A2A', danger: '#B43A3A',
    infoBg: '#EEF3F5', correctBg: '#EEF5EF', wrongBg: '#F7EEEE',
  },
  focus: { ring: '#2A536D', shadow: 'rgba(42,83,109,0.12)' },
  focusDanger: { shadow: 'rgba(180,58,58,0.12)' },
  selection: { bg: '#F1E6D8' },
  scrim: 'rgba(31, 35, 40, 0.45)',
  onAccent: '#FFFFFF',
  interactive: {
    hoverBg: '#F2EDE4',
    activeBg: '#EBE5DA',
    disabledBg: '#F0ECE4',
    disabledText: '#B0AFA8',
  },
};

const darkColors = {
  bg: { canvas: '#1A1A1A', surface: '#242424', surfaceAlt: '#2C2C2C' },
  border: { subtle: '#3A3A3A' },
  text: { primary: '#E8E4DC', muted: '#9A9A9A', faint: '#7A7A7A' },
  accent: { clay: '#D08A6E', clayHover: '#B87358', moss: '#8A9B74', indigo: '#4A8BB0' },
  state: {
    success: '#4A9B6F', warning: '#D4A03A', danger: '#D45A5A',
    infoBg: '#1E2A2F', correctBg: '#1E2F1E', wrongBg: '#2F1E1E',
  },
  focus: { ring: '#4A8BB0', shadow: 'rgba(74,139,176,0.18)' },
  focusDanger: { shadow: 'rgba(212,90,90,0.18)' },
  selection: { bg: '#3A2E20' },
  scrim: 'rgba(0, 0, 0, 0.6)',
  onAccent: '#FFFFFF',
  interactive: {
    hoverBg: '#2E2E2E',
    activeBg: '#363636',
    disabledBg: '#2A2A2A',
    disabledText: '#555555',
  },
};

/* ─── Shared (theme-agnostic) ─── */

const shared = {
  typography: {
    fontSans:
      "Inter, 'BIZ UDPGothic', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    scale: {
      h1: { size: 32, line: 40, weight: 650 },
      h2: { size: 24, line: 32, weight: 650 },
      h3: { size: 18, line: 26, weight: 650 },
      body: { size: 16, line: 26, weight: 500 },
      small: { size: 14, line: 22, weight: 450 },
      micro: { size: 12, line: 18, weight: 450 },
    },
    maxLineLengthChars: 72,
  },

  layout: {
    maxWidth: 1040,
    grid: 8,
    space: [0, 4, 8, 12, 16, 24, 32, 40, 48, 64],
    radius: { sm: 10, md: 14, lg: 18, pill: 999 },
    shadow: {
      sm: '0 1px 2px rgba(20,20,20,0.06)',
      md: '0 6px 18px rgba(20,20,20,0.10)',
    },
    controlHeights: { button: 44, input: 48, compact: 36 },
    breakpoints: { mobile: 480, tablet: 768, laptop: 1024 },
  },

  motion: {
    fastMs: 120,
    baseMs: 160,
    ease: 'ease-out',
  },

  zIndex: {
    dropdown: 100,
    sticky: 500,
    modal: 1000,
    overlay: 1500,
    palette: 2000,
    toast: 9999,
  },
};

/* ─── Assembled themes ─── */

export const lightTheme = { colors: lightColors, ...shared };
export const darkTheme = { colors: darkColors, ...shared };

/* ─── Default export (backward compat) ─── */

const tokens = lightTheme;
export default tokens;
