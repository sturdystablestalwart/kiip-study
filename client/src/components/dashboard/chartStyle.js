// Issue #10 — shared AnyChart styling helpers used by all three
// Dashboard chart components.  Extracted so the per-chart files don't
// duplicate axis/theme wiring.

export function applyChartTheme(chart, theme) {
    chart.background().fill(theme.colors.bg.surface);
    chart.title().fontFamily(theme.typography.fontSans);
    chart.title().fontColor(theme.colors.text.primary);
    chart.title().fontSize(theme.typography.scale.h3.size);
    chart.title().fontWeight(theme.typography.scale.h3.weight);
}

export function styleAxis(axis, theme) {
    if (!axis) return;
    axis.labels().fontColor(theme.colors.text.muted);
    axis.labels().fontFamily(theme.typography.fontSans);
    axis.labels().fontSize(theme.typography.scale.micro.size);
    if (axis.title) {
        axis.title().fontColor(theme.colors.text.muted);
        axis.title().fontFamily(theme.typography.fontSans);
    }
    if (axis.stroke) {
        axis.stroke(theme.colors.border.subtle);
    }
    if (axis.ticks) {
        axis.ticks().stroke(theme.colors.border.subtle);
    }
}
