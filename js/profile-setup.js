import { auth, db, storage } from './firebase-config.js';
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-storage.js";
import BYU_CLASSES from './byu-classes.js';

// ============================================
// STATE
// ============================================
let currentUser = null;
let selectedClasses = [];
let availability = {};   // { "Mon-8AM": true, "Tue-10AM": true, ... }
let selectedPhotoFile = null;
let isDragging = false;   // For click-drag on availability grid

// ============================================
// AUTH CHECK
// ============================================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  currentUser = user;

  // Load existing profile data if any
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  if (userDoc.exists()) {
    const data = userDoc.data();
    document.getElementById('display-name').value = data.name || '';
    document.getElementById('contact-email').value = data.email || '';
    document.getElementById('contact-phone').value = data.phone || '';

    if (data.classes && data.classes.length > 0) {
      selectedClasses = [...data.classes];
    }
    if (data.availability) {
      availability = { ...data.availability };
    }
    if (data.photoURL) {
      const preview = document.getElementById('photo-preview');
      preview.innerHTML = '';
      preview.style.backgroundImage = `url(${data.photoURL})`;
    }
    if (data.profileSetup) {
      // Already set up — they can still edit
    }
  }

  buildClassList();
  buildAvailabilityGrid();
  renderSelectedClasses();
  restoreAvailability();
});

// ============================================
// STEP NAVIGATION
// ============================================
window.goToStep = function(step) {
  // Validate current step before advancing
  if (step === 2) {
    const name = document.getElementById('display-name').value.trim();
    const email = document.getElementById('contact-email').value.trim();
    if (!name || !email) {
      showMessage('Please fill in your name and email.', 'error');
      return;
    }
  }

  if (step === 3 && selectedClasses.length === 0) {
    showMessage('Please select at least one class.', 'error');
    return;
  }

  // Hide all steps
  document.querySelectorAll('.setup-step').forEach(s => s.classList.add('hidden'));

  // Show target step
  document.getElementById(`step-${step}`).classList.remove('hidden');

  // Update step indicators
  for (let i = 1; i <= 3; i++) {
    const dot = document.getElementById(`step-dot-${i}`);
    dot.classList.remove('active', 'completed');
    if (i < step) dot.classList.add('completed');
    if (i === step) dot.classList.add('active');
  }

  // Clear messages
  document.getElementById('setup-message').className = 'message';
  document.getElementById('setup-message').textContent = '';

  // Scroll to top
  window.scrollTo(0, 0);
};

// ============================================
// SHOW MESSAGE
// ============================================
function showMessage(text, type) {
  const msg = document.getElementById('setup-message');
  msg.textContent = text;
  msg.className = `message ${type}`;
}

// ============================================
// PHOTO UPLOAD
// ============================================
document.getElementById('photo-upload-area').addEventListener('click', () => {
  document.getElementById('photo-input').click();
});

document.getElementById('photo-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showMessage('Photo must be under 5MB.', 'error');
    return;
  }

  selectedPhotoFile = file;

  // Show preview
  const reader = new FileReader();
  reader.onload = (event) => {
    const preview = document.getElementById('photo-preview');
    preview.innerHTML = '';
    preview.style.backgroundImage = `url(${event.target.result})`;
  };
  reader.readAsDataURL(file);
});

// ============================================
// CLASS LIST — BUILD & SEARCH
// ============================================
function buildClassList(filter = '') {
  const listEl = document.getElementById('class-list');
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
    const isSelected = selectedClasses.includes(c.id);
    return `
      <div class="class-item ${isSelected ? 'selected' : ''}" data-id="${c.id}" onclick="toggleClass('${c.id}')">
        <div class="class-checkbox"></div>
        <span>${c.name}</span>
      </div>
    `;
  }).join('');
}

document.getElementById('class-search').addEventListener('input', (e) => {
  buildClassList(e.target.value);
});

// ============================================
// CLASS SELECTION — TOGGLE & RENDER
// ============================================
window.toggleClass = function(classId) {
  const index = selectedClasses.indexOf(classId);
  if (index > -1) {
    selectedClasses.splice(index, 1);
  } else {
    selectedClasses.push(classId);
  }
  buildClassList(document.getElementById('class-search').value);
  renderSelectedClasses();
};

window.removeClass = function(classId) {
  selectedClasses = selectedClasses.filter(id => id !== classId);
  buildClassList(document.getElementById('class-search').value);
  renderSelectedClasses();
};

function renderSelectedClasses() {
  const container = document.getElementById('selected-classes');
  const list = document.getElementById('selected-classes-list');

  if (selectedClasses.length === 0) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');

  list.innerHTML = selectedClasses.map(id => {
    const cls = BYU_CLASSES.find(c => c.id === id);
    const label = cls ? cls.id.replace(/([A-Z]+)(\d+)/, '$1 $2') : id;
    return `
      <div class="chip">
        ${label}
        <button class="chip-remove" onclick="event.stopPropagation(); removeClass('${id}')">×</button>
      </div>
    `;
  }).join('');
}

// ============================================
// AVAILABILITY GRID — BUILD
// ============================================
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIMES = [
  '8 AM', '9 AM', '10 AM', '11 AM', '12 PM',
  '1 PM', '2 PM', '3 PM', '4 PM', '5 PM',
  '6 PM', '7 PM', '8 PM', '9 PM'
];

function buildAvailabilityGrid() {
  const grid = document.getElementById('availability-grid');

  // Header row: empty corner + day names
  let html = '<div class="grid-corner"></div>';
  DAYS.forEach(day => {
    html += `<div class="grid-header">${day}</div>`;
  });

  // Time rows
  TIMES.forEach((time, index) => {
    const rowClass = index % 2 === 0 ? '' : 'grid-row-even';
    html += `<div class="grid-time-label ${rowClass}">${time}</div>`;
    DAYS.forEach(day => {
      const key = `${day}-${time.replace(' ', '')}`;
      html += `<div class="grid-cell ${rowClass}" data-key="${key}"></div>`;
    });
  });

  grid.innerHTML = html;

  // Add click and drag listeners
  const cells = grid.querySelectorAll('.grid-cell');

  cells.forEach(cell => {
    cell.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDragging = true;
      toggleCell(cell);
    });

    cell.addEventListener('mouseenter', () => {
      if (isDragging) toggleCell(cell);
    });

    // Touch support for mobile
    cell.addEventListener('touchstart', (e) => {
      e.preventDefault();
      isDragging = true;
      toggleCell(cell);
    });

    cell.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      if (target && target.classList.contains('grid-cell') && isDragging) {
        toggleCell(target);
      }
    });
  });

  document.addEventListener('mouseup', () => { isDragging = false; });
  document.addEventListener('touchend', () => { isDragging = false; });
}

function toggleCell(cell) {
  const key = cell.dataset.key;
  if (cell.classList.contains('active')) {
    cell.classList.remove('active');
    delete availability[key];
  } else {
    cell.classList.add('active');
    availability[key] = true;
  }
}

function restoreAvailability() {
  Object.keys(availability).forEach(key => {
    const cell = document.querySelector(`.grid-cell[data-key="${key}"]`);
    if (cell) cell.classList.add('active');
  });
}

window.clearAvailability = function() {
  availability = {};
  document.querySelectorAll('.grid-cell.active').forEach(cell => {
    cell.classList.remove('active');
  });
};

// ============================================
// SAVE PROFILE — show confirmation first
// ============================================
window.saveProfile = function() {
  const name = document.getElementById('display-name').value.trim();
  const email = document.getElementById('contact-email').value.trim();

  if (selectedClasses.length === 0) {
    showMessage('Please select at least one class.', 'error');
    return;
  }

  // Show confirmation modal
  document.getElementById('confirm-modal').classList.remove('hidden');
};

window.closeConfirmModal = function() {
  document.getElementById('confirm-modal').classList.add('hidden');
};

window.confirmSaveProfile = async function() {
  document.getElementById('confirm-modal').classList.add('hidden');

  const name = document.getElementById('display-name').value.trim();
  const email = document.getElementById('contact-email').value.trim();
  const phone = document.getElementById('contact-phone').value.trim();

  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div>';

  try {
    let photoURL = '';

    // Upload photo if selected
    if (selectedPhotoFile) {
      const photoRef = ref(storage, `profile-photos/${currentUser.uid}`);
      await uploadBytes(photoRef, selectedPhotoFile);
      photoURL = await getDownloadURL(photoRef);
    }

    // Build update object
    const updateData = {
      name: name,
      email: email,
      phone: phone,
      classes: selectedClasses,
      availability: availability,
      profileSetup: true
    };

    if (photoURL) {
      updateData.photoURL = photoURL;
    }

    // Save to Firestore (merge: true creates doc if missing, updates if exists)
    await setDoc(doc(db, 'users', currentUser.uid), updateData, { merge: true });

    showMessage('Profile saved! Redirecting...', 'success');

    setTimeout(() => {
      window.location.href = 'discover.html';
    }, 1000);

  } catch (error) {
    console.error('Save error:', error);
    showMessage('Something went wrong. Please try again.', 'error');
    btn.disabled = false;
    btn.textContent = 'Save & Continue';
  }
};
