import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  collection
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";
import BYU_CLASSES from './byu-classes.js';

let currentUser = null;
let userData = null;
let selectedStyle = 'quiet';
let selectedClassId = null;
let selectedVisibility = 'open';
let editHerdId = null;

// ============================================
// AUTH CHECK
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

  renderClassChips();

  // Set default date to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('herd-date').value = today;

  // Check for edit mode
  const editId = new URLSearchParams(window.location.search).get('edit');
  if (editId) {
    await loadEditMode(editId);
  }
});

// ============================================
// CLASS CHIP SELECTOR
// ============================================
function renderClassChips() {
  const container = document.getElementById('class-chips');
  const classes = userData?.classes || [];

  if (classes.length === 0) {
    container.innerHTML = '<p style="color: var(--gray-400); font-size: 0.85rem;">No classes added yet. Add classes in your profile.</p>';
    return;
  }

  container.innerHTML = classes.map(classId => {
    const cls = BYU_CLASSES.find(c => c.id === classId);
    const label = cls ? cls.id.replace(/([A-Z]+)(\d+)/, '$1 $2') : classId;
    return `<button class="quick-pick" onclick="pickClass('${classId}', this)">${label}</button>`;
  }).join('');
}

window.pickClass = function(classId, btn) {
  selectedClassId = classId;
  document.querySelectorAll('#class-chips .quick-pick').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
};

// ============================================
// VISIBILITY PICKER
// ============================================
window.pickVisibility = function(vis, card) {
  selectedVisibility = vis;
  const cards = card.parentElement.querySelectorAll('.style-card');
  cards.forEach(c => c.classList.remove('active'));
  card.classList.add('active');
};

// ============================================
// LOCATION QUICK-PICK
// ============================================
window.pickLocation = function(location, btn) {
  document.getElementById('herd-location').value = location;
  document.querySelectorAll('.quick-picks:not(#class-chips) .quick-pick').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
};

// ============================================
// STYLE PICKER
// ============================================
window.pickStyle = function(style, card) {
  selectedStyle = style;
  const cards = card.parentElement.querySelectorAll('.style-card');
  cards.forEach(c => c.classList.remove('active'));
  card.classList.add('active');
};

// ============================================
// EDIT MODE
// ============================================
async function loadEditMode(herdId) {
  try {
    const herdDoc = await getDoc(doc(db, 'herds', herdId));
    if (!herdDoc.exists()) {
      showMessage('Herd not found.', 'error');
      return;
    }

    const herd = herdDoc.data();
    if (herd.creator !== currentUser.uid) {
      showMessage('You can only edit herds you created.', 'error');
      return;
    }

    editHerdId = herdId;

    // Update page title and button
    document.getElementById('page-title').textContent = 'Edit Herd';
    document.title = 'Edit Herd — Herd';
    const btn = document.getElementById('create-btn');
    btn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 18px;">save</span> Save Changes';

    // Pre-fill name
    document.getElementById('herd-name').value = herd.name || '';

    // Pre-fill location
    document.getElementById('herd-location').value = herd.location || '';
    // Highlight matching quick-pick if any
    document.querySelectorAll('.quick-picks:not(#class-chips) .quick-pick').forEach(btn => {
      if (btn.textContent === 'Library' && herd.location === 'Harold B. Lee Library') btn.classList.add('active');
      else if (btn.textContent === 'Talmage' && herd.location === 'Talmage Building') btn.classList.add('active');
      else if (btn.textContent === 'Engineering' && herd.location === 'Engineering Commons') btn.classList.add('active');
      else if (btn.textContent === 'Wilk' && herd.location === 'Wilkinson Center') btn.classList.add('active');
      else if (btn.textContent === 'Testing Ctr' && herd.location === 'Testing Center') btn.classList.add('active');
    });

    // Pre-fill style (scope to the grazing style section which has radio inputs)
    if (herd.style) {
      selectedStyle = herd.style;
      const styleCards = document.querySelectorAll('.style-card input[type="radio"]');
      styleCards.forEach(radio => {
        const card = radio.closest('.style-card');
        if (radio.value === herd.style) {
          card.parentElement.querySelectorAll('.style-card').forEach(c => c.classList.remove('active'));
          card.classList.add('active');
          radio.checked = true;
        }
      });
    }

    // Pre-fill class
    if (herd.classId) {
      selectedClassId = herd.classId;
      document.querySelectorAll('#class-chips .quick-pick').forEach(btn => {
        const cls = BYU_CLASSES.find(c => c.id === herd.classId);
        const label = cls ? cls.id.replace(/([A-Z]+)(\d+)/, '$1 $2') : herd.classId;
        if (btn.textContent === label) {
          btn.classList.add('active');
        }
      });
    }

    // Pre-fill visibility
    if (herd.visibility) {
      selectedVisibility = herd.visibility;
      const visCards = document.querySelectorAll('.style-options[style*="repeat(2"] .style-card');
      visCards.forEach(card => {
        card.classList.remove('active');
        const name = card.querySelector('.style-name');
        if (name && name.textContent.toLowerCase() === herd.visibility) {
          card.classList.add('active');
        }
      });
    }

    // Pre-fill date
    if (herd.schedule?.date) {
      document.getElementById('herd-date').value = herd.schedule.date;
    }

    // Pre-fill times (convert "2:00 PM" → "14:00" for input[type="time"])
    if (herd.schedule?.startTime) {
      document.getElementById('herd-start').value = parseTimeTo24h(herd.schedule.startTime);
    }
    if (herd.schedule?.endTime) {
      document.getElementById('herd-end').value = parseTimeTo24h(herd.schedule.endTime);
    }

  } catch (error) {
    console.error('Error loading herd for edit:', error);
    showMessage('Could not load herd data.', 'error');
  }
}

function parseTimeTo24h(timeStr) {
  // "2:00 PM" → "14:00", "12:30 AM" → "00:30"
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return '12:00';
  let hour = parseInt(match[1]);
  const min = match[2];
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${min}`;
}

// ============================================
// CREATE / SAVE HERD
// ============================================
window.createHerd = async function() {
  const name = document.getElementById('herd-name').value.trim();
  const location = document.getElementById('herd-location').value.trim();
  const date = document.getElementById('herd-date').value;
  const startTime = document.getElementById('herd-start').value;
  const endTime = document.getElementById('herd-end').value;

  // Validation
  if (!selectedClassId) {
    showMessage('Pick a class for your herd!', 'error');
    return;
  }
  if (!name) {
    showMessage('Give your herd a name!', 'error');
    return;
  }
  if (!location) {
    showMessage('Where will you meet?', 'error');
    return;
  }
  if (!date) {
    showMessage('Pick a date!', 'error');
    return;
  }

  const btn = document.getElementById('create-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div>';

  try {
    // Format times for display
    const formatTime = (t) => {
      const [h, m] = t.split(':');
      const hour = parseInt(h);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      return `${displayHour}:${m} ${ampm}`;
    };

    if (editHerdId) {
      // Edit mode: update existing herd
      await setDoc(doc(db, 'herds', editHerdId), {
        name: name,
        location: location,
        style: selectedStyle,
        classId: selectedClassId,
        visibility: selectedVisibility,
        schedule: {
          date: date,
          startTime: formatTime(startTime),
          endTime: formatTime(endTime)
        }
      }, { merge: true });

      showMessage('Herd updated! Redirecting...', 'success');
    } else {
      // Create mode: new herd
      const herdRef = doc(collection(db, 'herds'));

      await setDoc(herdRef, {
        name: name,
        location: location,
        style: selectedStyle,
        classId: selectedClassId,
        visibility: selectedVisibility,
        creator: currentUser.uid,
        creatorName: userData?.name || 'Anonymous',
        members: [currentUser.uid],
        memberCount: 1,
        schedule: {
          date: date,
          startTime: formatTime(startTime),
          endTime: formatTime(endTime)
        },
        createdAt: new Date().toISOString(),
        active: true
      });

      showMessage('Herd created! Redirecting...', 'success');
    }

    setTimeout(() => {
      window.location.href = 'pasture.html';
    }, 1000);

  } catch (error) {
    console.error('Error saving herd:', error);
    showMessage('Something went wrong. Please try again.', 'error');
    btn.disabled = false;
    btn.innerHTML = editHerdId
      ? '<span class="material-symbols-rounded" style="font-size: 18px;">save</span> Save Changes'
      : '<span class="material-symbols-rounded" style="font-size: 18px;">groups</span> Create Herd';
  }
};

// ============================================
// SHOW MESSAGE
// ============================================
function showMessage(text, type) {
  const msg = document.getElementById('create-message');
  msg.textContent = text;
  msg.className = `message ${type}`;
}
