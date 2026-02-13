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
  arrayUnion,
  arrayRemove
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";
import { getAvatarColor, getInitials } from './shared.js';
import BYU_CLASSES from './byu-classes.js';

let currentUser = null;
let userData = null;
let selectedDate = new Date();
let allLoadedHerds = [];

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

    // Split all active herds into My Herds and Recommended
    const allActiveQuery = query(
      collection(db, 'herds'),
      where('active', '==', true)
    );
    const allActiveSnapshot = await getDocs(allActiveQuery);
    const myHerdsList = [];
    const recommendedList = [];
    const userClasses = userData?.classes || [];

    allActiveSnapshot.forEach(d => {
      const data = d.data();
      const herd = { id: d.id, ...data };
      if (data.members?.includes(currentUser.uid)) {
        myHerdsList.push(herd);
      } else {
        if (data.visibility !== 'closed') {
          if (!data.classId || userClasses.includes(data.classId)) {
            recommendedList.push(herd);
          }
        }
      }
    });

    // Store all herds for member lookup
    allLoadedHerds = [...herds, ...myHerdsList, ...recommendedList];
    // Deduplicate by id
    const seen = new Set();
    allLoadedHerds = allLoadedHerds.filter(h => {
      if (seen.has(h.id)) return false;
      seen.add(h.id);
      return true;
    });

    renderMyHerdsList(myHerdsList);
    renderRecommendedList(recommendedList);

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
          <div class="avatar-stack avatar-stack-clickable" onclick="event.stopPropagation(); showMembers('${herd.id}')" title="View members">
            ${memberAvatars}
            ${extraCount > 0 ? `<div class="avatar-sm avatar-more">+${extraCount}</div>` : ''}
          </div>
          <button class="join-btn ${joinBtnClass}" ${isCreator ? 'data-creator="true"' : ''} onclick="joinHerd('${herd.id}', this)">
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

  // If already joined, leave instead
  if (btn.classList.contains('joined') && !btn.dataset.creator) {
    return leaveHerd(herdId, btn);
  }

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

async function leaveHerd(herdId, btn) {
  btn.disabled = true;
  try {
    const herdDoc = await getDoc(doc(db, 'herds', herdId));
    const currentMembers = herdDoc.data().members || [];

    await updateDoc(doc(db, 'herds', herdId), {
      members: arrayRemove(currentUser.uid),
      memberCount: Math.max(0, currentMembers.length - 1)
    });

    btn.classList.remove('joined');
    btn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 16px;">group_add</span> Join Herd';
  } catch (error) {
    console.error('Error leaving herd:', error);
  } finally {
    btn.disabled = false;
  }
}

// ============================================
// RENDER MY HERDS LIST
// ============================================
function renderMyHerdsList(herds) {
  const container = document.getElementById('my-herds');
  if (!container) return;

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
    const styleEmoji = herd.style === 'quiet' ? '\u{1F92B}' : herd.style === 'stampede' ? '\u26A1' : '\u{1F4AC}';
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
// RENDER RECOMMENDED LIST
// ============================================
function renderRecommendedList(herds) {
  const container = document.getElementById('recommended-herds');
  if (!container) return;

  if (herds.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--gray-400); padding: 20px; font-size: 0.85rem;">No recommendations right now.</p>';
    return;
  }

  container.innerHTML = herds.map(herd => {
    const styleEmoji = herd.style === 'quiet' ? '\u{1F92B}' : herd.style === 'stampede' ? '\u26A1' : '\u{1F4AC}';
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
        <div>
          <button class="add-btn" onclick="joinHerd('${herd.id}', this)" title="Join herd">
            <span class="material-symbols-rounded">add</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================
// SHOW MEMBERS MODAL
// ============================================
window.showMembers = async function(herdId) {
  const modal = document.getElementById('members-modal');
  const list = document.getElementById('members-modal-list');
  const title = document.getElementById('members-modal-title');

  // Find herd
  const herd = allLoadedHerds.find(h => h.id === herdId);
  if (!herd || !herd.members || herd.members.length === 0) {
    list.innerHTML = '<div class="members-loading">No members yet.</div>';
    modal.classList.remove('hidden');
    return;
  }

  title.textContent = `Members (${herd.members.length})`;
  list.innerHTML = '<div class="members-loading">Loading members...</div>';
  modal.classList.remove('hidden');

  try {
    // Fetch member user docs (batched in groups of 10)
    const memberDocs = [];
    for (let i = 0; i < herd.members.length; i += 10) {
      const batch = herd.members.slice(i, i + 10);
      const memberQuery = query(
        collection(db, 'users'),
        where('__name__', 'in', batch)
      );
      const snapshot = await getDocs(memberQuery);
      snapshot.forEach(d => {
        memberDocs.push({ uid: d.id, ...d.data() });
      });
    }

    if (memberDocs.length === 0) {
      list.innerHTML = '<div class="members-loading">No member info available.</div>';
      return;
    }

    list.innerHTML = memberDocs.map(member => {
      const color = getAvatarColor(member.uid);
      const initials = getInitials(member.name || '?');
      const isCreator = member.uid === herd.creator;
      return `
        <div class="member-item">
          <div class="member-avatar" style="background-color: ${color};">${initials}</div>
          <div>
            <div class="member-name">${escapeHtml(member.name || 'Unknown')}</div>
            ${isCreator ? '<div class="member-badge">Creator</div>' : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error loading members:', error);
    list.innerHTML = '<div class="members-loading">Failed to load members.</div>';
  }
};

window.closeMembersModal = function() {
  document.getElementById('members-modal').classList.add('hidden');
};

// ============================================
// UTIL
// ============================================
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
