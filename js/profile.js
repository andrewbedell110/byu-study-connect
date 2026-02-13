import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  query,
  where
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";
import BYU_CLASSES from './byu-classes.js';
import { getAvatarColor, getInitials } from './shared.js';

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
// EDIT MODE STATE
// ============================================
let currentUser = null;
let userData = null;
let editSelectedClasses = [];
let editAvailability = {};
let isDragging = false;

// ============================================
// AUTH CHECK & LOAD
// ============================================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  currentUser = user;

  const userDoc = await getDoc(doc(db, 'users', user.uid));
  if (!userDoc.exists() || !userDoc.data().profileSetup) {
    window.location.href = 'profile-setup.html';
    return;
  }

  userData = userDoc.data();
  renderProfile(userData, user);
  loadHerdStats();

  // Show content
  document.getElementById('loading-state').classList.add('hidden');
  document.getElementById('profile-content').classList.remove('hidden');
});

// ============================================
// RENDER PROFILE (reusable)
// ============================================
function renderProfile(data, user) {
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

  renderContactView(data);
  renderClassesView(data);
  buildAvailabilityGrid(data.availability || {});
}

function renderContactView(data) {
  document.getElementById('profile-detail-email').textContent = data.email;
  const phoneValue = document.getElementById('profile-detail-phone');
  if (data.phone) {
    phoneValue.textContent = data.phone;
    phoneValue.style.color = '';
  } else {
    phoneValue.textContent = 'Not added';
    phoneValue.style.color = 'var(--gray-300)';
  }
}

function renderClassesView(data) {
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
}

// ============================================
// LOAD HERD STATS
// ============================================
async function loadHerdStats() {
  try {
    const herdsQuery = query(
      collection(db, 'herds'),
      where('members', 'array-contains', currentUser.uid)
    );
    const snapshot = await getDocs(herdsQuery);
    const herdCount = snapshot.size;

    document.getElementById('stat-herds').textContent = herdCount;
    // Estimate grazing hours (2 hrs per herd as placeholder)
    document.getElementById('stat-hours').textContent = herdCount * 2;
  } catch (error) {
    console.error('Error loading herd stats:', error);
  }
}

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
// ENTER EDIT MODE
// ============================================
window.enterEditMode = function(section) {
  const sectionEl = document.getElementById(`section-${section}`);
  sectionEl.classList.add('editing');

  document.getElementById(`${section}-view`).classList.add('hidden');
  document.getElementById(`${section}-edit`).classList.remove('hidden');

  if (section === 'contact') {
    document.getElementById('edit-email').value = userData.email || '';
    document.getElementById('edit-phone').value = userData.phone || '';
  } else if (section === 'classes') {
    editSelectedClasses = [...(userData.classes || [])];
    buildInlineClassList();
    renderInlineSelectedClasses();

    document.getElementById('inline-class-search').addEventListener('input', (e) => {
      buildInlineClassList(e.target.value);
    });
  } else if (section === 'availability') {
    editAvailability = { ...(userData.availability || {}) };
    buildInlineAvailabilityGrid();
  }
};

// ============================================
// CANCEL EDIT
// ============================================
window.cancelEdit = function(section) {
  const sectionEl = document.getElementById(`section-${section}`);
  sectionEl.classList.remove('editing');

  document.getElementById(`${section}-edit`).classList.add('hidden');
  document.getElementById(`${section}-view`).classList.remove('hidden');

  if (section === 'classes') {
    document.getElementById('inline-class-search').value = '';
  }
};

// ============================================
// SAVE SECTION
// ============================================
window.saveSection = async function(section) {
  if (!currentUser) return;

  let updateData = {};

  if (section === 'contact') {
    const email = document.getElementById('edit-email').value.trim();
    const phone = document.getElementById('edit-phone').value.trim();
    if (!email) {
      showProfileMessage('Email is required.', 'error');
      return;
    }
    updateData = { email, phone };
  } else if (section === 'classes') {
    if (editSelectedClasses.length === 0) {
      showProfileMessage('Please select at least one class.', 'error');
      return;
    }
    updateData = { classes: editSelectedClasses };
  } else if (section === 'availability') {
    updateData = { availability: editAvailability };
  }

  // Disable save button while saving
  const saveBtn = document.querySelector(`#${section}-edit .btn-primary`);
  const originalText = saveBtn.textContent;
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    await setDoc(doc(db, 'users', currentUser.uid), updateData, { merge: true });

    // Update local cache
    Object.assign(userData, updateData);

    // Re-render the view for this section
    if (section === 'contact') {
      renderContactView(userData);
      document.getElementById('profile-email').textContent = userData.email;
    } else if (section === 'classes') {
      renderClassesView(userData);
    } else if (section === 'availability') {
      buildAvailabilityGrid(userData.availability || {});
    }

    // Exit edit mode
    cancelEdit(section);
    showProfileMessage('Saved!', 'success');
  } catch (error) {
    console.error('Save error:', error);
    showProfileMessage('Something went wrong. Please try again.', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = originalText;
  }
};

// ============================================
// INLINE CLASS LIST
// ============================================
function buildInlineClassList(filter = '') {
  const listEl = document.getElementById('inline-class-list');
  const searchTerm = filter.toLowerCase();

  const filtered = BYU_CLASSES.filter(c =>
    c.name.toLowerCase().includes(searchTerm) ||
    c.id.toLowerCase().includes(searchTerm)
  );

  if (filtered.length === 0) {
    listEl.innerHTML = '<div class="class-list-empty">No classes found. Try a different search.</div>';
    return;
  }

  listEl.innerHTML = filtered.map(c => {
    const isSelected = editSelectedClasses.includes(c.id);
    return `
      <div class="class-item ${isSelected ? 'selected' : ''}" data-id="${c.id}" onclick="inlineToggleClass('${c.id}')">
        <div class="class-checkbox"></div>
        <span>${c.name}</span>
      </div>
    `;
  }).join('');
}

window.inlineToggleClass = function(classId) {
  const index = editSelectedClasses.indexOf(classId);
  if (index > -1) {
    editSelectedClasses.splice(index, 1);
  } else {
    editSelectedClasses.push(classId);
  }
  buildInlineClassList(document.getElementById('inline-class-search').value);
  renderInlineSelectedClasses();
};

window.inlineRemoveClass = function(classId) {
  editSelectedClasses = editSelectedClasses.filter(id => id !== classId);
  buildInlineClassList(document.getElementById('inline-class-search').value);
  renderInlineSelectedClasses();
};

function renderInlineSelectedClasses() {
  const container = document.getElementById('inline-selected-classes');
  const list = document.getElementById('inline-selected-classes-list');

  if (editSelectedClasses.length === 0) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');

  list.innerHTML = editSelectedClasses.map(id => {
    const cls = BYU_CLASSES.find(c => c.id === id);
    const label = cls ? cls.id.replace(/([A-Z]+)(\d+)/, '$1 $2') : id;
    return `
      <div class="chip">
        ${label}
        <button class="chip-remove" onclick="event.stopPropagation(); inlineRemoveClass('${id}')">×</button>
      </div>
    `;
  }).join('');
}

// ============================================
// INLINE AVAILABILITY GRID (interactive)
// ============================================
function buildInlineAvailabilityGrid() {
  const grid = document.getElementById('inline-availability-grid');

  let html = '<div class="grid-corner"></div>';
  DAYS.forEach(day => {
    html += `<div class="grid-header">${day}</div>`;
  });

  TIMES.forEach((time, index) => {
    const rowClass = index % 2 === 0 ? '' : 'grid-row-even';
    html += `<div class="grid-time-label ${rowClass}">${TIME_LABELS[index]}</div>`;
    DAYS.forEach(day => {
      const key = `${day}-${time}`;
      const isActive = editAvailability[key] ? 'active' : '';
      html += `<div class="grid-cell ${rowClass} ${isActive}" data-key="${key}"></div>`;
    });
  });

  grid.innerHTML = html;

  // Add click and drag listeners
  const cells = grid.querySelectorAll('.grid-cell');

  cells.forEach(cell => {
    cell.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDragging = true;
      toggleInlineCell(cell);
    });

    cell.addEventListener('mouseenter', () => {
      if (isDragging) toggleInlineCell(cell);
    });

    cell.addEventListener('touchstart', (e) => {
      e.preventDefault();
      isDragging = true;
      toggleInlineCell(cell);
    });

    cell.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      if (target && target.classList.contains('grid-cell') && isDragging) {
        toggleInlineCell(target);
      }
    });
  });

  document.addEventListener('mouseup', () => { isDragging = false; });
  document.addEventListener('touchend', () => { isDragging = false; });
}

function toggleInlineCell(cell) {
  const key = cell.dataset.key;
  if (cell.classList.contains('active')) {
    cell.classList.remove('active');
    delete editAvailability[key];
  } else {
    cell.classList.add('active');
    editAvailability[key] = true;
  }
}

window.inlineClearAvailability = function() {
  editAvailability = {};
  document.querySelectorAll('#inline-availability-grid .grid-cell.active').forEach(cell => {
    cell.classList.remove('active');
  });
};

// ============================================
// SHOW PROFILE MESSAGE
// ============================================
function showProfileMessage(text, type) {
  const msg = document.getElementById('profile-message');
  msg.textContent = text;
  msg.className = `message ${type}`;

  if (type === 'success') {
    setTimeout(() => {
      msg.className = 'message';
      msg.textContent = '';
    }, 2500);
  }
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
