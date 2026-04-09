

# Implementation Plan

## Important Constraint
**Next.js migration is not possible.** Lovable projects are built on React + Vite. Next.js, Angular, Vue, etc. are not supported. The project will remain on React 18 + Vite + TypeScript. All other requests will be fulfilled within this stack.

**Hugeicons** — the `hugeicons-react` npm package exists and can be installed. However, it's a paid/premium icon library with limited free icons. I'll use `lucide-react` (already installed) which provides the same quality icons and is the standard for shadcn projects. If you specifically want Hugeicons, I can install it, but many icons require a pro license.

---

## What Will Be Built

### 1. Subtle Graphite Navbar Gradient
Replace the current gradient with a subtle graphite tone — approximately 8px worth of lightness difference from start to end. Both light and dark themes will use a near-black/graphite gradient (e.g., `hsl(220, 10%, 18%)` to `hsl(220, 10%, 15%)` in dark, `hsl(220, 10%, 22%)` to `hsl(220, 10%, 19%)` in light).

### 2. Vertical Sidebar Navigation (Firefox-style)
Replace the top navbar + bottom mobile nav with a persistent left sidebar:
- Narrow vertical strip on the left side (icon-based, ~60px wide)
- Contains: Feed, Explore, Notifications, Messages, Nemo (AI), Settings, Profile
- No border highlight on active — uses subtle background fill instead
- On mobile: collapses to bottom nav (icons only)
- Logo at top of sidebar

### 3. Rebrand AI to "Nemo"
- Rename all AI references to "Nemo"
- Redesign the chat page with the `AnimatedAIChat` component adapted for React/Vite:
  - Chat input starts centered on empty state with "How can I help today?" heading
  - Once messages exist, input moves to bottom
  - Install `framer-motion` for animations
  - Add `ShiningText` component for "Nemo is thinking..." loading state
  - Conversation sidebar with project folders and chat management
  - Rounded, polished UI throughout

### 4. Fish Button on Posts (Nemo Integration)
- Add a fish icon button (🐟 using lucide `Fish` icon) at the far right of the post reactions bar
- Clicking it navigates to `/ai` (Nemo) with the post content pre-filled as context
- No text label, just the icon
- This counts as an "upload" to Nemo

### 5. Settings Page in Sidebar
- Add Settings to the sidebar navigation
- Keep existing settings functionality (profile editing, dark mode, Pulse score, email confirmation, sign out)

### 6. Updated Post Card UI
- Refine the existing `SocialPostCard` with cleaner shadcn-style design
- Add the fish button to reactions

---

## Technical Details

### Dependencies to Install
- `framer-motion` (for animated AI chat and shining text)

### Files to Create
- `src/components/ui/animated-ai-chat.tsx` — adapted for React (no "use client")
- `src/components/ui/shining-text.tsx` — adapted for React
- `src/components/AppSidebar.tsx` — vertical sidebar navigation

### Files to Modify
- `src/index.css` — graphite gradient, lab-bg utility
- `src/App.tsx` — replace Navbar with sidebar layout
- `src/components/Navbar.tsx` — remove or repurpose for mobile
- `src/pages/AI.tsx` — full rebrand to Nemo with new chat UI
- `src/components/SocialPostCard.tsx` — add fish button
- `src/pages/Feed.tsx` — pass navigation handler for fish button
- `src/pages/Settings.tsx` — ensure it works standalone with sidebar

### Layout Change
```text
BEFORE:
┌──────────────────────────┐
│      Top Navbar          │
├──────────────────────────┤
│                          │
│      Page Content        │
│                          │
└──────────────────────────┘

AFTER:
┌────┬─────────────────────┐
│ ⚡ │                     │
│    │                     │
│ 🏠 │    Page Content     │
│ 🔍 │                     │
│ 🔔 │                     │
│ 💬 │                     │
│ 🐠 │                     │
│ ⚙️ │                     │
│    │                     │
│ 👤 │                     │
└────┴─────────────────────┘
```

