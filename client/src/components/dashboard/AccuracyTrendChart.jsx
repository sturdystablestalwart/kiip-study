// Issue #10 — extracted from Dashboard.jsx.  Renders the accuracy-
// over-time line chart.  Props:
//   - data: [{ date, score }]  (stats.accuracyTrend)
// Owns its own AnyChart instance + ref; disposes on unmount.
import React, { useEffect, useRef } from 'react';
import styled, { useTheme } from 'styled-components';
import { useTranslation } from 'react-i18next';
import { useThemeMode } from '../../context/ThemeContext';
import { applyChartTheme, styleAxis } from './chartStyle';

const ChartContainer = styled.div`
    width: 100%;
    height: 300px;
`;

export default function AccuracyTrendChart({ data }) {
    const ref = useRef(null);
    const chartRef = useRef(null);
    const theme = useTheme();
    const { isDark } = useThemeMode();
    const { t } = useTranslation();

    useEffect(() => {
        if (!data?.length || !ref.current) return undefined;
        if (chartRef.current) {
            chartRef.current.dispose();
            chartRef.current = null;
        }
        const chart = window.anychart.line();
        chartRef.current = chart;
        const series = chart.line(data.map(d => [d.date, d.score]));
        series.stroke(theme.colors.accent.indigo, 2);
        series.name(t('dashboard.accuracyOverTime'));
        series.markers().enabled(true);
        series.markers().size(4);
        series.markers().fill(theme.colors.accent.indigo);
        series.markers().stroke(theme.colors.bg.surface, 1);
        chart.tooltip().format('{%value}%');
        chart.title(false);
        applyChartTheme(chart, theme);
        chart.title(false);
        chart.background().fill('transparent');
        const yAxis = chart.yAxis();
        styleAxis(yAxis, theme);
        yAxis.title(false);
        chart.yScale().minimum(0);
        chart.yScale().maximum(100);
        const xAxis = chart.xAxis();
        styleAxis(xAxis, theme);
        xAxis.title(false);
        chart.yGrid().enabled(true);
        chart.yGrid().stroke(theme.colors.border.subtle, 1, '5 5');
        chart.container(ref.current);
        chart.draw();
        return () => {
            if (chartRef.current) {
                chartRef.current.dispose();
                chartRef.current = null;
            }
        };
        // Issue #48 — theme is derived from isDark via ThemeContext; listing
        // both made every render re-fire the effect.  t is stable; reading it
        // for labels does not require it in deps.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, isDark]);

    return <ChartContainer ref={ref} />;
}
