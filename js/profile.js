import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";
import BYU_CLASSES from './byu-classes.js';

// ============================================
// AVATAR HELPERS
// ============================================
const AVATAR_COLORS = [
  '#002E5D', '#0062B8', '#1E88E5', '#00838F',
  '#2E7D32', '#558B2F', '#E65100', '#AD1457',
  '#6A1B9A', '#4527A0', '#283593', '#C62828'
];

function getAvatarColor(uid) {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ============================================
// AVAILABILITY CONSTANTS
// ============================================
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIMES = [
  '8AM', '9AM', '10AM', '11AM', '12PM',
  '1PM', '2PM', '3PM', '4PM', '5PM',
  '6PM', '7PM', '8PM', '9PM'
];
const TIME_LABELS = [
  '8 AM', '9 AM', '10 AM', '11 AM', '12 PM',
  '1 PM', '2 PM', '3 PM', '4 PM', '5 PM',
  '6 PM', '7 PM', '8 PM', '9 PM'
];

// ============================================
// AUTH CHECK & LOAD
// ============================================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  const userDoc = await getDoc(doc(db, 'users', user.uid));
  if (!userDoc.exists() || !userDoc.data().profileSetup) {
    window.location.href = 'profile-setup.html';
    return;
  }

  const data = userDoc.data();

  // Avatar
  const avatar = document.getElementById('profile-avatar');
  if (data.photoURL) {
    avatar.textContent = '';
    avatar.style.backgroundImage = `url(${data.photoURL})`;
  } else {
    avatar.textContent = getInitials(data.name);
    avatar.style.backgroundColor = getAvatarColor(user.uid);
  }

  // Name & email
  document.getElementById('profile-name').textContent = data.name;
  document.getElementById('profile-email').textContent = data.email;
  document.getElementById('profile-detail-email').textContent = data.email;

  // Phone
  const phoneRow = document.getElementById('phone-row');
  const phoneValue = document.getElementById('profile-detail-phone');
  if (data.phone) {
    phoneValue.textContent = data.phone;
  } else {
    phoneValue.textContent = 'Not added';
    phoneValue.style.color = 'var(--gray-300)';
  }

  // Classes
  const classesEl = document.getElementById('profile-classes');
  if (data.classes && data.classes.length > 0) {
    classesEl.innerHTML = data.classes.map(classId => {
      const cls = BYU_CLASSES.find(c => c.id === classId);
      const label = cls ? cls.name : classId;
      return `<span class="profile-class-tag">${label}</span>`;
    }).join('');
  } else {
    classesEl.innerHTML = '<p style="color: var(--gray-500); font-size: 0.85rem;">No classes added yet.</p>';
  }

  // Availability grid
  buildAvailabilityGrid(data.availability || {});

  // Show content
  document.getElementById('loading-state').classList.add('hidden');
  document.getElementById('profile-content').classList.remove('hidden');
});

// ============================================
// BUILD AVAILABILITY GRID (read-only)
// ============================================
function buildAvailabilityGrid(availability) {
  const container = document.getElementById('profile-availability');

  let html = '<div class="profile-avail-wrapper"><div class="profile-avail-grid">';

  // Header
  html += '<div class="pavail-corner"></div>';
  DAYS.forEach(day => {
    html += `<div class="pavail-header">${day}</div>`;
  });

  // Rows
  TIMES.forEach((time, i) => {
    html += `<div class="pavail-time">${TIME_LABELS[i]}</div>`;
    DAYS.forEach(day => {
      const key = `${day}-${time}`;
      const isActive = availability[key];
      html += `<div class="pavail-cell ${isActive ? 'active' : ''}"></div>`;
    });
  });

  html += '</div></div>';
  container.innerHTML = html;
}

// ============================================
// SIGN OUT
// ============================================
window.handleSignOut = async function() {
  try {
    await signOut(auth);
    window.location.href = 'index.html';
  } catch (error) {
    console.error('Sign out error:', error);
    alert('Something went wrong signing out. Please try again.');
  }
};
