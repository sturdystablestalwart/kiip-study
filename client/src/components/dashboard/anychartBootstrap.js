// Issue #10 — single side-effect entry-point that loads only the
// AnyChart modules Dashboard's chart components need + applies the
// optional commercial licence key.  Imported once at page level so
// downstream chart components can assume window.anychart exists.
//
// Module list mirrors the #6 modular-import work; tightening or
// expanding the chart palette starts here.
import 'anychart/dist/js/anychart-base.min.js';
import 'anychart/dist/js/anychart-cartesian.min.js';
import 'anychart/dist/js/anychart-radar.min.js';
import 'anychart/dist/js/anychart-ui.min.js';
import 'anychart/dist/js/anychart-exports.min.js';
import 'anychart/dist/js/anychart-default-theme.min.js';

const LICENSE_KEY = import.meta.env.VITE_ANYCHART_LICENSE_KEY;
if (LICENSE_KEY && typeof window !== 'undefined' && window.anychart) {
    window.anychart.licenseKey(LICENSE_KEY);
}
