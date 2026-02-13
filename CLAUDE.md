# Herd

## Overview
PWA that helps BYU students find study groups ("herds") by matching on shared classes and availability. Cow/pasture-themed UI with cream/sage/green palette. Built with vanilla JS + Firebase, deployed on Vercel.

## Tech Stack
- **Frontend**: Vanilla ES6 modules (`type="module"`), no build tools or bundler
- **Backend**: Firebase v11.3.0 (CDN) — Auth, Firestore, Cloud Storage
- **Fonts**: Quicksand (display), Nunito (body), Gaegu (handwritten) via Google Fonts
- **Icons**: Material Symbols Rounded (CDN)
- **Deploy**: Vercel static site — `vercel --prod` to deploy
- **PWA**: Service worker (`sw.js`) with network-first caching, cache name `herd-v2`

## File Structure
```
├── index.html              # Auth (login/signup) — cream bg, cow mascot
├── profile-setup.html      # Onboarding wizard (3 steps)
├── pasture.html            # Home page — herd feed by day + my herds + recommended
├── roam.html               # Map discovery — CSS-only stylized map
├── create-herd.html        # Create study group form
├── friends.html            # Friends — classmate discovery + friend requests
├── herds.html              # Redirect → friends.html (PWA cache compat)
├── profile.html            # Profile view + inline editing + stats
├── css/
│   ├── style.css           # Core design system (cream/sage/green palette)
│   ├── profile-setup.css   # Setup wizard styles (also used by profile inline edit)
│   └── profile.css         # Profile page styles + stats cards
├── js/
│   ├── firebase-config.js  # Firebase init — exports { auth, db, storage }
│   ├── auth.js             # Login/signup logic
│   ├── shared.js           # Avatar utilities (getAvatarColor, getInitials) + bottom nav
│   ├── profile-setup.js    # 3-step onboarding (photo, classes, availability)
│   ├── profile.js          # Profile display + inline editing + herd stats
│   ├── pasture.js          # Home page — herds by date, my herds, recommended
│   ├── roam.js             # Map discovery — markers, filters, detail card
│   ├── create-herd.js      # Create herd form + Firestore write
│   ├── friends.js          # Friends — classmate discovery, friend requests
│   ├── herds.js            # (legacy) Community herds logic
│   └── byu-classes.js      # BYU class catalog (~5,400 courses, default export)
├── images/                 # PWA icons (192, 512)
├── manifest.json           # PWA manifest (Herd branding)
└── sw.js                   # Service worker (network-first)
```

## Key Patterns

### Auth Flow
1. `index.html` → login/signup
2. `onAuthStateChanged` guards every page — redirects to `index.html` if not logged in
3. If `profileSetup !== true` → redirect to `profile-setup.html`
4. Otherwise → page loads normally
5. After login/signup → redirect to `pasture.html`

### DOM Callbacks
All onclick handlers use `window.*` functions (required for ES modules):
```js
window.handleLogin = async function() { ... }
```

### Firestore Collections
- **Users**: `{ name, email, phone, photoURL, classes[], availability{}, friends[], profileSetup, createdAt }`
  - `friends[]` stores accepted friend UIDs (updated via `arrayUnion` on both sides)
- **Herds**: `{ name, location, style, creator, creatorName, members[], memberCount, schedule: { date, startTime, endTime }, createdAt, active }`
- **friendRequests**: `{ from, to, fromName, status: "pending"|"accepted"|"declined", createdAt }`
  - Doc ID convention: `{fromUid}_{toUid}`
  - Composite indexes needed: `to`+`status`, `from`+`status`
- Always use `setDoc(docRef, data, { merge: true })` for user updates
- `array-contains` for querying herds by member
- `arrayUnion` for joining herds and adding friends

### Herd Styles
- `quiet` — Focus mode
- `casual` — Chat & study
- `stampede` — Cram session

### Availability Grid
- Days: Mon–Sun, Times: 8AM–9PM (14 slots)
- Storage keys: `"Mon-8AM"`, `"Tue-3PM"`, etc.
- Interactive grid uses mousedown+mouseenter drag + touch support

### Avatar System
Deterministic color from UID hash, initials from name. 12-color green/earth palette.
Shared utilities in `js/shared.js`: `getAvatarColor()`, `getInitials()`.

### Inline Profile Editing
Each section (contact, classes, availability) has `*-view` and `*-edit` divs toggled by `enterEditMode(section)` / `cancelEdit(section)`. Saves independently with `merge: true`.

### Bottom Navigation
5 tabs: Pasture, Roam, + (center elevated button), Friends, Profile.
Uses Material Symbols Rounded icons. Center button links to `create-herd.html`.

### Friends System
- **Privacy**: Non-friends see name + shared classes only. Friends see email + phone.
- **Flow**: Classmate discovery → Send request → Accept/Decline → Friends
- Classmates are users sharing at least one class (queried via `array-contains-any`)

## CSS Design System
- Variables defined in `:root` in `style.css`
- Palette: `--cream`, `--sage-50` to `--sage-600`, `--green-50` to `--green-800`, `--emerald-*`, `--amber-*`, `--rose-*`
- Typography: `--font-display` (Quicksand), `--font-body` (Nunito), `--font-handwritten` (Gaegu)
- Radius: `--radius-xs` (6px) to `--radius-full` (9999px)
- Shadows: `--shadow-xs` to `--shadow-xl`, `--shadow-glow-green`, `--shadow-glow-amber`
- Easing: `--ease-out-expo`, `--ease-spring`
- `.hidden { display: none !important; }` for visibility toggling
- `.message.error` / `.message.success` for feedback
- `.blob-card` — rounded white cards with sage borders
- `.font-handwritten` — Gaegu font utility class

## Commands
- **Local dev**: `python3 -m http.server 8000` (or any static server)
- **Deploy**: `vercel --prod`
- **Git**: Push to `origin/main`
