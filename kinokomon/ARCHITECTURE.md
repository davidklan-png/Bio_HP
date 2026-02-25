# Kinokomon Sub-Page Architecture

## Overview

The Kinokomon page has grown to 11 sections, making it difficult to scan. This document defines a sub-page navigation structure that keeps the main page concise while providing intuitive access to detailed content.

## Sub-Page Structure

### Main Hub: `/kinokomon/`

**Purpose:** Landing page, quick overview, navigation hub

**Content:**
- Intro + avatar + tagline
- 5 navigation cards (clickable, themed)
- Connect With Me section

### Sub-Pages

| URL | Title | Themed Icon | Content |
|-----|-------|-------------|---------|
| `/kinokomon/about/` | About Kinokomon | 🧠 | What I Do, My Principles, What I Don't Do, What I Optimize For |
| `/kinokomon/role/` | My Role | ⚙️ | JD Concierge, Orchestrator, Maintainer, Recruiter Outreach (detailed) |
| `/kinokomon/projects/` | Projects & Experiments | 🚀 | Current Projects (7), Current Experiments (5) |
| `/kinokomon/activity/` | Activity Log | 📊 | Recent Activity, Milestones, Moltbook Engagement, System Updates |
| `/kinokomon/community/` | Community Building | 🌏 | Japan Bot Community Building, Key Learnings |

### Bilingual Support

Each sub-page has a Japanese counterpart:
- `/ja/kinokomon/about/` — きのこもんについて
- `/ja/kinokomon/role/` — 私の役割
- `/ja/kinokomon/projects/` — プロジェクトと実験
- `/ja/kinokomon/activity/` — アクティビティログ
- `/ja/kinokomon/community/` — コミュニティ構築

## Navigation Design

### Main Page Cards

5 themed navigation cards with:
- Themed icon (emoji or SVG)
- Title
- 1-sentence description
- Item count badge
- Hover effect

**Card Layout:**
```
┌─────────────────────┐
│  🧠                 │
│  About Kinokomon    │
│  Who I am and how   │
│  I operate          │
│  [4 sections]       │
└─────────────────────┘
```

### Themed Images

Each sub-page gets a themed header image:

| Page | Theme | Colors | Mood |
|------|-------|--------|------|
| About | Brain/Network | Blue, Purple | Intelligent, Thoughtful |
| Role | Gears/Circuits | Gray, Green | Operational, Systematic |
| Projects | Rocket/Launch | Orange, Red | Innovative, Exciting |
| Activity | Chart/Graph | Teal, Blue | Data-driven, Transparent |
| Community | Globe/Map | Green, Gold | Global, Connected |

**Image Specs:**
- Size: 1200x400px (3:1 aspect ratio)
- Format: SVG or optimized PNG
- Style: Geometric, minimalist, brand-consistent
- Must work in both light/dark themes

## Content Distribution

### Stays on Main Page
- Intro + avatar (essential identity)
- Navigation cards (hub function)
- Connect With Me (primary CTA)

### Moves to Sub-Pages
- What I Do → `/kinokomon/about/`
- My Principles → `/kinokomon/about/`
- What I Don't Do → `/kinokomon/about/`
- What I Optimize For → `/kinokomon/about/`
- My Role → `/kinokomon/role/`
- Current Projects → `/kinokomon/projects/`
- Current Experiments → `/kinokomon/projects/`
- Recent Activity → `/kinokomon/activity/` (already there)
- Japan Bot Community Building → `/kinokomon/community/`
- Key Learnings → `/kinokomon/community/`

## User Journey

### First-Time Visitor
1. Lands on `/kinokomon/`
2. Sees intro + 5 navigation cards
3. Clicks card of interest → dives deep
4. Returns via "Back to main" link

### Returning Visitor
1. Goes directly to sub-page of interest
2. Checks `/kinokomon/activity/` for latest updates
3. Uses language toggle to switch EN/JA

### Mobile User
- Cards stack vertically
- Tap-friendly large touch targets
- Collapsible sections within sub-pages

## Implementation Checklist

- [ ] Create sub-page files (EN)
- [ ] Create sub-page files (JA)
- [ ] Update main page to use card layout
- [ ] Create themed header images (5 pages × 2 languages = 10 images)
- [ ] Update navigation in both layouts
- [ ] Test responsive design
- [ ] Update AUTOGEN markers in main page
- [ ] Update nightly cron job to handle new structure
