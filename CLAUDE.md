# BYU Synapse

## Overview
PWA that helps BYU students find study partners by matching on shared classes and availability. Built with vanilla JS + Firebase, deployed on Vercel.

## Tech Stack
- **Frontend**: Vanilla ES6 modules (`type="module"`), no build tools or bundler
- **Backend**: Firebase v11.3.0 (CDN) — Auth, Firestore, Cloud Storage
- **Fonts**: Bricolage Grotesque (display), Plus Jakarta Sans (body) via Google Fonts
- **Deploy**: Vercel static site — `vercel --prod` to deploy
- **PWA**: Service worker (`sw.js`) with network-first caching

## File Structure
```
├── index.html              # Auth (login/signup)
├── profile-setup.html      # Onboarding wizard (3 steps)
├── profile.html            # Profile view + inline editing
├── discover.html           # Find classmates
├── friends.html            # Friends list + requests
├── css/
│   ├── style.css           # Core design system + shared components
│   ├── profile-setup.css   # Setup wizard styles (also used by profile inline edit)
│   ├── profile.css         # Profile page styles
│   ├── discover.css        # Discover page styles
│   └── friends.css         # Friends page styles
├── js/
│   ├── firebase-config.js  # Firebase init — exports { auth, db, storage }
│   ├── auth.js             # Login/signup logic
│   ├── profile-setup.js    # 3-step onboarding (photo, classes, availability)
│   ├── profile.js          # Profile display + per-section inline editing
│   ├── discover.js         # Classmate discovery + friend requests
│   ├── friends.js          # Friends list, requests, expanded details
│   └── byu-classes.js      # BYU class catalog (~5,400 courses, default export)
├── images/                 # PWA icons (192, 512)
├── manifest.json           # PWA manifest
└── sw.js                   # Service worker (network-first)
```

## Key Patterns

### Auth Flow
1. `index.html` → login/signup
2. `onAuthStateChanged` guards every page — redirects to `index.html` if not logged in
3. If `profileSetup !== true` → redirect to `profile-setup.html`
4. Otherwise → page loads normally

### DOM Callbacks
All onclick handlers use `window.*` functions (required for ES modules):
```js
window.handleLogin = async function() { ... }
```

### Firestore
- **Users** collection: `{ name, email, phone, photoURL, classes[], availability{}, friends[], profileSetup, createdAt }`
- **Friend Requests** collection: doc ID = `{fromUid}_{toUid}`, fields: `{ from, fromName, to, status, createdAt, acceptedAt }`
- Always use `setDoc(docRef, data, { merge: true })` for updates
- `array-contains-any` for finding classmates (max 30 items per Firestore limit)

### Availability Grid
- Days: Mon–Sun, Times: 8AM–9PM (14 slots)
- Storage keys: `"Mon-8AM"`, `"Tue-3PM"`, etc.
- Interactive grid uses mousedown+mouseenter drag + touch support

### Avatar System
Deterministic color from UID hash, initials from name. 12-color palette.

### Inline Profile Editing
Each section (contact, classes, availability) has `*-view` and `*-edit` divs toggled by `enterEditMode(section)` / `cancelEdit(section)`. Saves independently with `merge: true`.

## CSS Design System
- Variables defined in `:root` in `style.css`
- Colors: `--blue-50` to `--blue-700`, `--gray-50` to `--gray-900`, `--emerald-*`, `--rose-*`, `--amber-*`
- Dark theme: `--midnight`, `--deep`, `--navy`, `--navy-light`, `--slate`
- Glass effects: `--glass-bg`, `--glass-border`, `--glass-bg-light`, `--glass-border-light`
- Radius: `--radius-xs` (6px) to `--radius-full` (9999px)
- Shadows: `--shadow-xs` to `--shadow-xl`, `--shadow-glow-blue`, `--shadow-glow-amber`
- Easing: `--ease-out-expo`, `--ease-spring`
- `.hidden { display: none !important; }` for visibility toggling
- `.message.error` / `.message.success` for feedback

## Commands
- **Local dev**: `python3 -m http.server 8000` (or any static server)
- **Deploy**: `vercel --prod`
- **Git**: Push to `origin/main`
