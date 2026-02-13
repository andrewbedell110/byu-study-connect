// ============================================
// SHARED UTILITIES — Herd
// ============================================

export const AVATAR_COLORS = [
  '#4A7C59', '#6B8F71', '#8FBC8F', '#2E7D32',
  '#558B2F', '#795548', '#A1887F', '#8D6E63',
  '#5D4037', '#3E2723', '#BF360C', '#E65100'
];

export function getAvatarColor(uid) {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// Bottom nav HTML generator for consistent nav across pages
export function getBottomNav(activePage) {
  const pages = [
    { id: 'pasture', href: 'pasture.html', icon: 'cottage', label: 'Pasture' },
    { id: 'roam', href: 'roam.html', icon: 'explore', label: 'Roam' },
    { id: 'create', href: 'create-herd.html', icon: 'add', label: '', isCenter: true },
    { id: 'friends', href: 'friends.html', icon: 'people', label: 'Friends' },
    { id: 'profile', href: 'profile.html', icon: 'person', label: 'Profile' },
  ];

  return `<nav class="bottom-nav">
    ${pages.map(p => {
      if (p.isCenter) {
        return `<a href="${p.href}" class="nav-item nav-center-btn">
          <span class="material-symbols-rounded">${p.icon}</span>
        </a>`;
      }
      return `<a href="${p.href}" class="nav-item ${activePage === p.id ? 'active' : ''}">
        <span class="material-symbols-rounded">${p.icon}</span>
        ${p.label}
      </a>`;
    }).join('')}
  </nav>`;
}
