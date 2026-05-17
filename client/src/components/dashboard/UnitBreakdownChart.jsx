// Issue #10 — extracted from Dashboard.jsx.  Renders the per-unit
// score bar chart.  Props:
//   - data: [{ unit, avgScore }]  (stats.unitBreakdown)
import React, { useEffect, useRef } from 'react';
import styled, { useTheme } from 'styled-components';
import { useTranslation } from 'react-i18next';
import { useThemeMode } from '../../context/ThemeContext';
import { styleAxis } from './chartStyle';

const ChartContainer = styled.div`
    width: 100%;
    height: 300px;
`;

export default function UnitBreakdownChart({ data }) {
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
        const chart = window.anychart.bar();
        chartRef.current = chart;
        const series = chart.bar(data.map(u => [u.unit || 'N/A', u.avgScore]));
        series.fill(theme.colors.accent.moss);
        series.stroke(theme.colors.accent.moss, 1);
        series.name(t('dashboard.scoreByUnit'));
        chart.tooltip().format('{%value}%');
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
        // Issue #48 — narrow deps; see AccuracyTrendChart for rationale.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, isDark]);

    return <ChartContainer ref={ref} />;
}
