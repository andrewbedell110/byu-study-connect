import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  updateDoc,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";
import BYU_CLASSES from './byu-classes.js';

let currentUser = null;
let userData = null;
let myHerds = [];
let otherHerds = [];

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

  loadHerds();
});

// ============================================
// TOGGLE SEARCH
// ============================================
window.toggleSearch = function() {
  const searchEl = document.getElementById('herds-search');
  searchEl.classList.toggle('hidden');
  if (!searchEl.classList.contains('hidden')) {
    document.getElementById('search-input').focus();
  }
};

// Search handler
document.getElementById('search-input').addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  renderMyHerds(myHerds.filter(h =>
    h.name.toLowerCase().includes(term) || (h.location || '').toLowerCase().includes(term)
  ));
  renderRecommended(otherHerds.filter(h =>
    h.name.toLowerCase().includes(term) || (h.location || '').toLowerCase().includes(term)
  ));
});

// ============================================
// LOAD HERDS
// ============================================
async function loadHerds() {
  const loading = document.getElementById('herds-loading');
  const content = document.getElementById('herds-content');

  try {
    // Load my herds (where I'm a member)
    const myQuery = query(
      collection(db, 'herds'),
      where('active', '==', true),
      where('members', 'array-contains', currentUser.uid)
    );
    const mySnapshot = await getDocs(myQuery);
    myHerds = [];
    mySnapshot.forEach(doc => {
      myHerds.push({ id: doc.id, ...doc.data() });
    });

    // Load all active herds for recommendations
    const allQuery = query(
      collection(db, 'herds'),
      where('active', '==', true)
    );
    const allSnapshot = await getDocs(allQuery);
    const allOtherHerds = [];
    allSnapshot.forEach(doc => {
      const data = doc.data();
      if (!data.members?.includes(currentUser.uid)) {
        allOtherHerds.push({ id: doc.id, ...data });
      }
    });

    // Smart filtering: only show herds for user's classes + open visibility
    const userClasses = userData?.classes || [];
    otherHerds = allOtherHerds.filter(herd => {
      // Exclude closed herds
      if (herd.visibility === 'closed') return false;
      // Include herds with no classId (backward compat) or matching user's classes
      if (!herd.classId) return true;
      return userClasses.includes(herd.classId);
    });

    // Sort by availability overlap
    otherHerds = sortByAvailabilityOverlap(otherHerds);

    renderMyHerds(myHerds);
    renderRecommended(otherHerds);

  } catch (error) {
    console.error('Error loading herds:', error);
  } finally {
    loading.classList.add('hidden');
    content.classList.remove('hidden');
  }
}

// ============================================
// AVAILABILITY OVERLAP SCORING
// ============================================
function sortByAvailabilityOverlap(herds) {
  const userAvail = userData?.availability || {};
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return herds.map(herd => {
    let score = 0;

    if (herd.schedule?.date && herd.schedule?.startTime && herd.schedule?.endTime) {
      // Get day of week from date
      const dateObj = new Date(herd.schedule.date + 'T00:00:00');
      const dayName = days[dateObj.getDay()];

      // Parse start/end hours from "2:00 PM" format
      const startHour = parseTimeToHour(herd.schedule.startTime);
      const endHour = parseTimeToHour(herd.schedule.endTime);

      // Check each hour in range against user availability
      for (let h = startHour; h < endHour; h++) {
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
        const key = `${dayName}-${displayHour}${ampm}`;
        if (userAvail[key]) score++;
      }
    }

    return { ...herd, _score: score };
  }).sort((a, b) => b._score - a._score);
}

function parseTimeToHour(timeStr) {
  // "2:00 PM" → 14
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 12;
  let hour = parseInt(match[1]);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return hour;
}

// ============================================
// CLASS BADGE HELPER
// ============================================
function getClassBadge(classId) {
  if (!classId) return '';
  const cls = BYU_CLASSES.find(c => c.id === classId);
  const label = cls ? cls.id.replace(/([A-Z]+)(\d+)/, '$1 $2') : classId;
  return `<span class="herd-class-badge"><span class="material-symbols-rounded" style="font-size: 11px;">school</span> ${escapeHtml(label)}</span>`;
}

// ============================================
// RENDER MY HERDS
// ============================================
function renderMyHerds(herds) {
  const container = document.getElementById('my-herds');

  if (herds.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 32px 20px;">
        <span class="material-symbols-rounded">groups</span>
        <h3>No herds yet</h3>
        <p>Join a herd or create your own to get started!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = herds.map(herd => {
    const styleEmoji = herd.style === 'quiet' ? '🤫' : herd.style === 'stampede' ? '⚡' : '💬';
    const styleClass = herd.style || 'casual';
    const isCreator = herd.creator === currentUser.uid;

    const editBtn = isCreator
      ? `<a href="create-herd.html?edit=${herd.id}" class="herd-edit-btn" title="Edit herd"><span class="material-symbols-rounded">edit</span></a>`
      : '';

    return `
      <div class="herd-list-card animate-in">
        <div class="herd-list-icon ${styleClass}">${styleEmoji}</div>
        <div class="herd-list-info">
          <div class="herd-list-name">${escapeHtml(herd.name)}</div>
          <div class="herd-list-meta">
            ${getClassBadge(herd.classId)}
            <span><span class="material-symbols-rounded">location_on</span> ${escapeHtml(herd.location || '')}</span>
            <span><span class="material-symbols-rounded">group</span> ${herd.memberCount || herd.members?.length || 0}</span>
          </div>
        </div>
        ${editBtn}
      </div>
    `;
  }).join('');
}

// ============================================
// RENDER RECOMMENDED
// ============================================
function renderRecommended(herds) {
  const container = document.getElementById('recommended-herds');

  if (herds.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--gray-400); padding: 20px; font-size: 0.85rem;">No recommendations right now.</p>';
    return;
  }

  container.innerHTML = herds.map(herd => {
    const styleEmoji = herd.style === 'quiet' ? '🤫' : herd.style === 'stampede' ? '⚡' : '💬';
    const styleClass = herd.style || 'casual';

    return `
      <div class="herd-list-card animate-in">
        <div class="herd-list-icon ${styleClass}">${styleEmoji}</div>
        <div class="herd-list-info">
          <div class="herd-list-name">${escapeHtml(herd.name)}</div>
          <div class="herd-list-meta">
            ${getClassBadge(herd.classId)}
            <span><span class="material-symbols-rounded">location_on</span> ${escapeHtml(herd.location || '')}</span>
            <span><span class="material-symbols-rounded">group</span> ${herd.memberCount || herd.members?.length || 0}</span>
          </div>
        </div>
        <div class="herd-list-action">
          <button class="add-btn" onclick="joinHerd('${herd.id}', this)" title="Join herd">
            <span class="material-symbols-rounded">add</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================
// JOIN HERD
// ============================================
window.joinHerd = async function(herdId, btn) {
  if (!currentUser) return;
  btn.disabled = true;

  try {
    const herdDoc = await getDoc(doc(db, 'herds', herdId));
    const currentMembers = herdDoc.data().members || [];

    await updateDoc(doc(db, 'herds', herdId), {
      members: arrayUnion(currentUser.uid),
      memberCount: currentMembers.length + 1
    });

    // Move from recommended to my herds
    const herd = otherHerds.find(h => h.id === herdId);
    if (herd) {
      herd.members = [...(herd.members || []), currentUser.uid];
      herd.memberCount = (herd.memberCount || 0) + 1;
      otherHerds = otherHerds.filter(h => h.id !== herdId);
      myHerds.push(herd);
      renderMyHerds(myHerds);
      renderRecommended(otherHerds);
    }
  } catch (error) {
    console.error('Error joining herd:', error);
    btn.disabled = false;
  }
};

// ============================================
// UTIL
// ============================================
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
