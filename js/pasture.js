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
import { getAvatarColor, getInitials } from './shared.js';
import BYU_CLASSES from './byu-classes.js';

let currentUser = null;
let userData = null;
let selectedDate = new Date();

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

  buildDaySelector();
  loadHerds();
});

// ============================================
// DAY SELECTOR
// ============================================
function buildDaySelector() {
  const container = document.getElementById('day-selector');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();

  let html = '';
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dayName = days[date.getDay()];
    const dayNum = date.getDate();
    const isActive = i === 0;
    const dateStr = date.toISOString().split('T')[0];

    html += `
      <div class="day-chip ${isActive ? 'active' : ''}" data-date="${dateStr}" onclick="selectDay(this, '${dateStr}')">
        <span class="day-name">${dayName}</span>
        <span class="day-num">${dayNum}</span>
      </div>
    `;
  }
  container.innerHTML = html;
}

window.selectDay = function(el, dateStr) {
  document.querySelectorAll('.day-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  selectedDate = new Date(dateStr + 'T00:00:00');
  loadHerds();
};

// ============================================
// LOAD HERDS
// ============================================
async function loadHerds() {
  const loading = document.getElementById('feed-loading');
  const content = document.getElementById('pasture-content');
  loading.classList.remove('hidden');
  content.classList.add('hidden');

  try {
    const dateStr = selectedDate.toISOString().split('T')[0];

    // Load herds for selected date
    const herdsQuery = query(
      collection(db, 'herds'),
      where('active', '==', true),
      where('schedule.date', '==', dateStr)
    );

    const snapshot = await getDocs(herdsQuery);
    const herds = [];
    snapshot.forEach(doc => {
      herds.push({ id: doc.id, ...doc.data() });
    });

    renderHerdFeed(herds);

    // Load all active herds for nearby
    const allQuery = query(
      collection(db, 'herds'),
      where('active', '==', true)
    );
    const allSnapshot = await getDocs(allQuery);
    const allHerds = [];
    allSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.schedule?.date !== dateStr) {
        allHerds.push({ id: doc.id, ...data });
      }
    });

    renderNearbyList(allHerds.slice(0, 5));

  } catch (error) {
    console.error('Error loading herds:', error);
  } finally {
    loading.classList.add('hidden');
    content.classList.remove('hidden');
  }
}

// ============================================
// CLASS BADGE HELPER
// ============================================
function getClassBadge(classId) {
  if (!classId) return '';
  const cls = BYU_CLASSES.find(c => c.id === classId);
  const label = cls ? cls.id.replace(/([A-Z]+)(\d+)/, '$1 $2') : classId;
  return `<span class="herd-class-badge"><span class="material-symbols-rounded" style="font-size: 12px;">school</span> ${escapeHtml(label)}</span>`;
}

// ============================================
// RENDER HERD FEED
// ============================================
function renderHerdFeed(herds) {
  const feed = document.getElementById('herd-feed');

  if (herds.length === 0) {
    feed.innerHTML = `
      <div class="empty-state">
        <span class="material-symbols-rounded">landscape</span>
        <h3>No herds grazing today</h3>
        <p>Be the first to start a study group! Tap the + button below.</p>
      </div>
    `;
    return;
  }

  feed.innerHTML = herds.map(herd => {
    const isCreator = herd.creator === currentUser.uid;
    const isMember = herd.members?.includes(currentUser.uid);
    const styleIcon = herd.style === 'quiet' ? 'volume_off' : herd.style === 'stampede' ? 'bolt' : 'chat_bubble';
    const styleBadge = herd.style === 'quiet' ? 'badge-sage' : herd.style === 'stampede' ? 'badge-amber' : 'badge-emerald';

    // Determine join button state
    let joinBtnIcon, joinBtnText, joinBtnClass;
    if (isCreator) {
      joinBtnIcon = 'star';
      joinBtnText = 'Created';
      joinBtnClass = 'joined';
    } else if (isMember) {
      joinBtnIcon = 'check';
      joinBtnText = 'Joined';
      joinBtnClass = 'joined';
    } else {
      joinBtnIcon = 'group_add';
      joinBtnText = 'Join Herd';
      joinBtnClass = '';
    }

    const memberAvatars = (herd.members || []).slice(0, 3).map((uid, i) => {
      const color = getAvatarColor(uid);
      return `<div class="avatar-sm" style="background-color: ${color};">?</div>`;
    }).join('');

    const extraCount = (herd.memberCount || herd.members?.length || 0) - 3;

    const editBtn = isCreator
      ? `<a href="create-herd.html?edit=${herd.id}" class="herd-edit-btn" title="Edit herd"><span class="material-symbols-rounded">edit</span></a>`
      : '';

    return `
      <div class="herd-card animate-in">
        <div class="herd-card-header">
          <div>
            <div class="herd-card-title">${escapeHtml(herd.name)}</div>
            ${getClassBadge(herd.classId)}
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${editBtn}
            <span class="badge ${styleBadge}">
              <span class="material-symbols-rounded" style="font-size: 14px;">${styleIcon}</span>
              ${herd.style || 'casual'}
            </span>
          </div>
        </div>
        <div class="herd-card-meta">
          <span><span class="material-symbols-rounded">schedule</span> ${herd.schedule?.startTime || ''} - ${herd.schedule?.endTime || ''}</span>
          <span><span class="material-symbols-rounded">location_on</span> ${escapeHtml(herd.location || '')}</span>
        </div>
        <div class="herd-card-footer">
          <div class="avatar-stack">
            ${memberAvatars}
            ${extraCount > 0 ? `<div class="avatar-sm avatar-more">+${extraCount}</div>` : ''}
          </div>
          <button class="join-btn ${joinBtnClass}" onclick="joinHerd('${herd.id}', this)">
            <span class="material-symbols-rounded">${joinBtnIcon}</span>
            ${joinBtnText}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================
// RENDER NEARBY LIST
// ============================================
function renderNearbyList(herds) {
  const list = document.getElementById('nearby-list');

  if (herds.length === 0) {
    list.innerHTML = '<p style="text-align: center; color: var(--gray-400); padding: 16px; font-size: 0.85rem;">No nearby herds found.</p>';
    return;
  }

  list.innerHTML = herds.map(herd => `
    <div class="nearby-item">
      <div class="nearby-icon">
        <span class="material-symbols-rounded">groups</span>
      </div>
      <div class="nearby-info">
        <div class="nearby-name">${escapeHtml(herd.name)}</div>
        <div class="nearby-detail">${escapeHtml(herd.location || '')} &middot; ${herd.memberCount || herd.members?.length || 0} members</div>
      </div>
      <button class="join-btn" onclick="joinHerd('${herd.id}', this)" style="padding: 6px 14px; font-size: 0.75rem;">
        <span class="material-symbols-rounded" style="font-size: 14px;">add</span>
        Join
      </button>
    </div>
  `).join('');
}

// ============================================
// JOIN HERD
// ============================================
window.joinHerd = async function(herdId, btn) {
  if (!currentUser) return;

  btn.disabled = true;
  try {
    await updateDoc(doc(db, 'herds', herdId), {
      members: arrayUnion(currentUser.uid),
      memberCount: (await getDoc(doc(db, 'herds', herdId))).data().members?.length + 1 || 1
    });

    btn.classList.add('joined');
    btn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 16px;">check</span> Joined';
  } catch (error) {
    console.error('Error joining herd:', error);
  } finally {
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
