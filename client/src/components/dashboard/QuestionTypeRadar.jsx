// Issue #10 — extracted from Dashboard.jsx.  Renders the per-question-
// type accuracy radar chart.  Props:
//   - data: [{ type, accuracy }]  (typeStats.types)
import React, { useEffect, useRef } from 'react';
import styled, { useTheme } from 'styled-components';
import { useTranslation } from 'react-i18next';
import { useThemeMode } from '../../context/ThemeContext';

const ChartContainer = styled.div`
    width: 100%;
    height: 300px;
`;

// Issue #166 — labels resolve via t() against the dashboard.qtype.*
// keys at render time so chart re-labels follow the active UI language.
const QUESTION_TYPE_KEYS = {
    'mcq-single': 'dashboard.qtype.mcqSingle',
    'mcq-multiple': 'dashboard.qtype.mcqMultiple',
    'short-answer': 'dashboard.qtype.shortAnswer',
    'ordering': 'dashboard.qtype.ordering',
    'fill-in-the-blank': 'dashboard.qtype.fillInTheBlank',
};

export default function QuestionTypeRadar({ data }) {
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
        const chart = window.anychart.radar();
        chartRef.current = chart;
        const chartData = data.map(qt => [
            QUESTION_TYPE_KEYS[qt.type] ? t(QUESTION_TYPE_KEYS[qt.type]) : qt.type,
            qt.accuracy,
        ]);
        const series = chart.area(chartData);
        series.fill(theme.colors.accent.indigo, 0.2);
        series.stroke(theme.colors.accent.indigo, 2);
        series.markers().enabled(true);
        series.markers().size(4);
        series.markers().fill(theme.colors.accent.indigo);
        series.markers().stroke(theme.colors.bg.surface, 1);
        series.name(t('dashboard.byQuestionType'));
        chart.tooltip().format('{%value}%');
        chart.title(false);
        chart.background().fill('transparent');
        chart.yScale().minimum(0);
        chart.yScale().maximum(100);
        chart.yScale().ticks().interval(25);
        const yAxis = chart.yAxis();
        if (yAxis) {
            yAxis.labels().fontColor(theme.colors.text.faint);
            yAxis.labels().fontFamily(theme.typography.fontSans);
            yAxis.labels().fontSize(theme.typography.scale.micro.size);
            yAxis.stroke(theme.colors.border.subtle);
        }
        const xAxis = chart.xAxis();
        if (xAxis) {
            xAxis.labels().fontColor(theme.colors.text.muted);
            xAxis.labels().fontFamily(theme.typography.fontSans);
            xAxis.labels().fontSize(theme.typography.scale.micro.size);
        }
        chart.yGrid().enabled(true);
        chart.yGrid().stroke(theme.colors.border.subtle, 1, '3 3');
        chart.xGrid().enabled(true);
        chart.xGrid().stroke(theme.colors.border.subtle, 1);
        chart.container(ref.current);
        chart.draw();
        return () => {
            if (chartRef.current) {
                chartRef.current.dispose();
                chartRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, isDark]);

    return <ChartContainer ref={ref} />;
}
