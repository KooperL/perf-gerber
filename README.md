# perf-gerber

perf-gerber is a browser-based tool for designing perfboard-style PCBs *quickly* and exporting them as manufacturable Gerber files.

It is intentionally simple, opinionated, and focused on a single job:
turning a perfboard layout into real PCB files without needing a full EDA suite.

## What this project is for

Use perf-gerber when you want to:

- Design custom perfboard / protoboard PCBs
- Quickly lay out point-to-point style traces
- Generate Gerber + drill files compatible with common PCB fabs
- Prototype circuits that would normally be hand-wired on perfboard
- Create single- or double-sided perfboard layouts with plated holes


## What this project is not for

This tool is not a general-purpose PCB CAD replacement.
Do not use perf-gerber and expect:

- Complex or dense PCBs, there is no way to save progress beyond exporting
- Multi-layer boards beyond simple top/bottom copper
- Automatic routing, DRC, or schematic-driven workflows
- Precision mechanical layouts or irregular footprints

If you need nets, components, rules, or simulations —
use KiCad, EasyEDA, Altium, etc.