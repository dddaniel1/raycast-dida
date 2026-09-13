---
name: Dida 365 for Raycast
description: A keyboard-first Raycast extension for Dida365/TickTick built strictly on the public Open API.
---

# Design System: Dida 365 for Raycast

## Overview

**Creative North Star: "The Silent Operator"**

This extension renders entirely with Raycast's native components (List, Form, ActionPanel, MenuBarExtra). There are no custom colors, no custom typography, no shadows, no motion system — and that is the design. The interface borrows Raycast's own authority: monochrome iconography, system type, native chrome. Every token decision Raycast has already made is inherited, not re-stated.

Density is information-led: a task list shows title, project subtitle, priority flag, and relative due time — nothing else. Expression is spent on precise iconography and on Chinese-language nuance where the domain vocabulary demands it (recurrence presets, date phrases). The visual anti-reference is a web-app-in-a-launcher: if a screen would look at home in a browser, it has drifted.

**Key Characteristics:**

- 100% native Raycast components; zero custom-styled surfaces.
- Monochrome system icon set (Icon.* glyphs only); single PNG asset is the launcher icon.
- English framework copy with domain-specific Chinese phrases (每天 / 提前30分钟 / 明天).
- Keyboard-first: primary actions carry Raycast's standard shortcuts (⌘N new, ⌘R refresh).

## Colors

No custom palette. The system inherits Raycast's adaptive light/dark theme tokens wholesale; nothing in the source sets a color.

### Named Rules

**The Inherited Palette Rule.** Never set an explicit color. If a state cannot be expressed without one, use a native icon glyph or text label instead (e.g. priority is a Flag icon plus a text label, never a colored dot).

## Typography

System typography via Raycast's native List/Form text styles. No font is loaded and no size or weight is set in source.

### Hierarchy

- **List title**: task title — the only primary text; every row exists for it.
- **List subtitle**: project name, secondary weight — provides context, never competes.
- **Accessories**: relative due time (e.g. "明天", "3d") and priority label; right-aligned, terse.
- **Form labels**: short English nouns ("Title", "Due Date"); helper text goes in placeholders, not paragraphs.

### Named Rules

**The Terse Accessory Rule.** Accessory text is at most one or two words. If it needs a sentence, it belongs in the detail view.

## Layout

Layout is Raycast's single-column list and stacked form layout. The extension controls order and grouping, not geometry:

- Task list rows: title left, subtitle inline after title, accessories right.
- Dropdown filters group as Favorites → Views → Projects → Priority, in that order, with Inbox (when configured) first among Projects.
- Forms stack vertically with related fields adjacent (date + timezone; repeat + interval + custom RRULE).
- Menu bar renders a compact count string, no icon-heavy layouts.

## Elevation & Depth

None. Raycast's native chrome owns all depth. The source contains no shadows, borders, or overlays of its own.

## Shapes

No custom radius, border, or clipping. Native control shapes only.

## Components

All components are Raycast primitives used with default styling. Documented here is *how* they are composed, not how they look.

### List Rows (TaskListItem)

- **Title:** task title; **Subtitle:** project name (resolved from a projectId map, Inbox included when configured).
- **Accessories:** priority (Flag icon + label, only when priority > 0), relative due date, overdue marker (ExclamationMark icon), selection check.
- **State:** completed tasks stay out of the active views; the Completed view and the Uncomplete action are the way back.

### Action Panels (ActionPanel)

- Primary push action first: Quick Add (⌘N) when tasks exist; falls back to Create Task (full form, ⌘N) when the list is empty.
- Destructive actions (delete) confirm first and refresh data after success.
- Sort choices live in a submenu; settings and refresh are always present.

### Forms

- Native Form controls; dropdowns for enums (project, priority, reminder presets, recurrence).
- Progressive disclosure is derived from state, not a toggle: Interval appears only for 每 N 天, Custom RRULE only for 自定义 RRULE, and All day / Time Zone only once a due date is set. Fields are controlled so a re-render never drops typed text.
- One "Notes" field replaces Content + Description; the older description is merged on read and cleared on write so the text is never stored twice.

### Empty States

- Plain-text EmptyView with a short title ("No tasks") and one actionable hint ("⌘N to create task").
- Errors get their own EmptyView with the actionable message string; the list never shows both.

## Do's and Don'ts

### Do:

- **Do** use native Icon.* glyphs for every affordance; pick the closest semantic match (ArrowClockwise for refresh, Flag for priority).
- **Do** keep Chinese domain phrases (每天/每周/明天) where the user's vocabulary is Chinese, and English framework copy everywhere else. Keep one language per control: a Repeat picker, a Postpone menu, and a toast each read in a single language.
- **Do** express state with icons + text labels so no meaning rides on color alone.
- **Do** follow Raycast shortcut conventions (⌘N new, ⌘R refresh).

### Don't:

- **Don't** set custom colors, fonts, shadows, or border radii — Raycast's theme is the brand.
- **Don't** invent custom components that imitate web UI (cards, badges, buttons) inside List/Form.
- **Don't** add decorative motion or animation; transitions are Raycast's own.
- **Don't** exceed two-word accessory text on list rows.
