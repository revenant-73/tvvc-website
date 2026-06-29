# TVVC Optimization & UX Roadmap
2→
3→**Date Created**: June 29, 2026
4→
5→This document tracks planned performance optimizations and user experience enhancements for the TVVC Website and Customer Portal.
6→
7→## 🚀 1. Performance Optimizations
8→
9→- [x] **Database Indexing**
10→  - **Description**: Add explicit indices to `users.email`, `registrations.parentEmail`, and `athletes.parentId`.
11→  - **Benefit**: Prevents full table scans in SQLite, keeping the dashboard fast as the database grows.
12→- [x] **Enable Astro Prefetching**
13→  - **Description**: Update `astro.config.mjs` to enable hover-based prefetching for internal links.
14→  - **Benefit**: Makes portal navigation feel instantaneous.
15→- [x] **Self-Host Fonts (@fontsource)**
16→  - **Description**: Replace Google Fonts with self-hosted versions via `@fontsource`.
17→  - **Benefit**: Reduces DNS lookups and eliminates Flash of Unstyled Text (FOUT).
18→- [x] **Advanced Image Formats**
19→  - **Description**: Add `avif` to the preferred formats in `Image` components.
20→  - **Benefit**: 20-30% better compression than WebP for faster mobile loading.
21→
22→## ✨ 2. User Experience (UX) Enhancements
23→
24→- [x] **PWA Support (Mobile Installability)**
25→  - **Description**: Add `manifest.json` and a service worker.
26→  - **Benefit**: Allows parents to "Install" the portal as an app on their home screen.
27→- [x] **Better Loading States**
28→  - **Description**: Add a global top-bar loading indicator or spinners for async actions (like Stripe portal redirect).
29→  - **Benefit**: Clearer visual feedback for users on slower connections.
30→- [x] **Form Persistence**
31→  - **Description**: Use local storage to save draft form data in registration and athlete profiles.
32→  - **Benefit**: Prevents data loss on accidental refreshes or disconnects.
33→
34→## 🛠️ 3. Accessibility & SEO
35→
36→- [x] **Dynamic OG Images**
37→  - **Description**: Implement dynamic Open Graph image generation for events.
38→  - **Benefit**: Richer, more professional link previews when shared on social media.
39→- [x] **A11y Audit & Fixes**
40→  - **Description**: Verify contrast ratios on "glass" components and add missing ARIA labels.
41→  - **Benefit**: Better experience for all users and improved search ranking.
42→
43→## 📅 4. Long-Term Portal Features
44→
45→- [ ] **Document Vault**: Upload birth certificates/physicals once.
46→- [ ] **Team Dashboards**: Team-specific feeds and schedules.
47→- [ ] **Growth Tracking**: Visualization of athlete stats over time.
48→