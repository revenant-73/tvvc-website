# TVVC Optimization & UX Roadmap

**Date Created**: June 29, 2026

This document tracks planned performance optimizations and user experience enhancements for the TVVC Website and Customer Portal.

## 🚀 1. Performance Optimizations

- [x] **Speed Up Public Tryouts Page**
  - **Description**: Keep `/tryouts` static by moving tryout-prep clinic availability out of the blocking Astro render path and into a small async API fetch. Defer non-critical React hydration for the fundraising modal and global toaster.
  - **Benefit**: The public tryouts landing page can return prebuilt HTML immediately instead of waiting on Turso, while still showing near-real-time clinic availability after first paint.
- [x] **Database Indexing**
  - **Description**: Add explicit indices to `users.email`, `registrations.parentEmail`, and `athletes.parentId`.
  - **Benefit**: Prevents full table scans in SQLite, keeping the dashboard fast as the database grows.
- [x] **Enable Astro Prefetching**
  - **Description**: Update `astro.config.mjs` to enable hover-based prefetching for internal links.
  - **Benefit**: Makes portal navigation feel instantaneous.
- [x] **Self-Host Fonts (@fontsource)**
  - **Description**: Replace Google Fonts with self-hosted versions via `@fontsource`.
  - **Benefit**: Reduces DNS lookups and eliminates Flash of Unstyled Text (FOUT).
- [x] **Advanced Image Formats**
  - **Description**: Add `avif` to the preferred formats in `Image` components.
  - **Benefit**: 20-30% better compression than WebP for faster mobile loading.

## ✨ 2. User Experience (UX) Enhancements

- [x] **PWA Support (Mobile Installability)**
  - **Description**: Add `manifest.json` and a service worker.
  - **Benefit**: Allows parents to "Install" the portal as an app on their home screen.
- [x] **Better Loading States**
  - **Description**: Add a global top-bar loading indicator or spinners for async actions like Stripe portal redirects.
  - **Benefit**: Clearer visual feedback for users on slower connections.
- [x] **Form Persistence**
  - **Description**: Use local storage to save draft form data in registration and athlete profiles.
  - **Benefit**: Prevents data loss on accidental refreshes or disconnects.

## 🛠️ 3. Accessibility & SEO

- [x] **Dynamic OG Images**
  - **Description**: Implement dynamic Open Graph image generation for events.
  - **Benefit**: Richer, more professional link previews when shared on social media.
- [x] **A11y Audit & Fixes**
  - **Description**: Verify contrast ratios on "glass" components and add missing ARIA labels.
  - **Benefit**: Better experience for all users and improved search ranking.

## 📅 4. Long-Term Portal Features

- [ ] **Document Vault**: Upload birth certificates/physicals once.
- [ ] **Team Dashboards**: Team-specific feeds and schedules.
- [ ] **Growth Tracking**: Visualization of athlete stats over time.
