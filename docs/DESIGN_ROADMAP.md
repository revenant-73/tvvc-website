# TVVC Website Design Roadmap (Balanced Performance Edition)

This document outlines the transition to a high-energy, human-centric aesthetic that prioritizes core performance and accessibility.

## Progress Summary
- [x] **Phase 1: Performance Foundation** (Removed heavy SVG filters and scroll listeners)
- [x] **Phase 2: High-Impact Typography** (Syne font for headings)
- [x] **Phase 3: Human-Centric Details** (Hand-drawn underlines and tactile card styling)
- [ ] **Phase 4: Lightweight Motion** (CSS-only animations)

---

## Completed Optimizations
- **Global SVG Filter Removal**: Removed `noise`, `goo`, and `torn` filters from the root to eliminate scrolling stutter.
- **Marquee & Parallax Removal**: Removed complex JavaScript-driven scroll listeners to ensure 60fps performance on all devices.
- **Hero Centering**: Simplified the `h1` structure to ensure perfect centering and readability across all viewports.
- **Bento Grid Restoration**: Reverted to clean, structured grids for better content hierarchy and performance.
