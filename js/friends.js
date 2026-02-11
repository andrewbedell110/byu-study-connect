import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  collection,
  query,
  where
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";
import BYU_CLASSES from './byu-classes.js';

// ============================================
// STATE
// ============================================
let currentUser = null;
let currentUserData = null;
let friendsList = [];       // Confirmed friends with full data
let requestsList = [];      // Incoming pending requests

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

  currentUserData = userDoc.data();

  // Set header avatar
  const avatar = document.getElementById('header-avatar');
  if (currentUserData.photoURL) {
    avatar.textContent = '';
    avatar.style.backgroundImage = `url(${currentUserData.photoURL})`;
    avatar.style.backgroundSize = 'cover';
    avatar.style.backgroundPosition = 'center';
  } else {
    avatar.textContent = getInitials(currentUserData.name);
    avatar.style.backgroundColor = getAvatarColor(user.uid);
  }

  await loadAll();
});

// ============================================
// LOAD EVERYTHING
// ============================================
async function loadAll() {
  try {
    await Promise.all([loadFriends(), loadRequests()]);

    // Update counts
    document.getElementById('friends-count').textContent = friendsList.length;
    document.getElementById('requests-count').textContent = requestsList.length;

    if (requestsList.length > 0) {
      document.getElementById('requests-count').classList.add('has-items');
    }

    // Hide loading, show content
    document.getElementById('loading-state').classList.add('hidden');

    // Show friends tab by default
    showFriendsTab();

  } catch (error) {
    console.error('Error loading data:', error);
    document.getElementById('loading-state').innerHTML =
      '<p style="color: var(--danger);">Something went wrong. Try refreshing.</p>';
  }
}

// ============================================
// LOAD FRIENDS
// ============================================
async function loadFriends() {
  friendsList = [];

  // Get accepted requests where I sent
  const sentSnap = await getDocs(
    query(collection(db, 'friendRequests'),
      where('from', '==', currentUser.uid),
      where('status', '==', 'accepted'))
  );

  // Get accepted requests where I received
  const receivedSnap = await getDocs(
    query(collection(db, 'friendRequests'),
      where('to', '==', currentUser.uid),
      where('status', '==', 'accepted'))
  );

  // Collect friend UIDs
  const friendUids = [];
  sentSnap.forEach(d => friendUids.push(d.data().to));
  receivedSnap.forEach(d => friendUids.push(d.data().from));

  // Load each friend's profile
  for (const uid of friendUids) {
    const friendDoc = await getDoc(doc(db, 'users', uid));
    if (friendDoc.exists()) {
      const data = friendDoc.data();
      const sharedClasses = (data.classes || []).filter(c =>
        (currentUserData.classes || []).includes(c)
      );

      friendsList.push({
        uid: uid,
        name: data.name,
        email: data.email,
        phone: data.phone || '',
        photoURL: data.photoURL || '',
        classes: data.classes || [],
        sharedClasses: sharedClasses,
        availability: data.availability || {}
      });
    }
  }
}

// ============================================
// LOAD REQUESTS
// ============================================
async function loadRequests() {
  requestsList = [];

  const snap = await getDocs(
    query(collection(db, 'friendRequests'),
      where('to', '==', currentUser.uid),
      where('status', '==', 'pending'))
  );

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const senderDoc = await getDoc(doc(db, 'users', data.from));

    if (senderDoc.exists()) {
      const senderData = senderDoc.data();
      const sharedClasses = (senderData.classes || []).filter(c =>
        (currentUserData.classes || []).includes(c)
      );

      requestsList.push({
        requestId: docSnap.id,
        uid: data.from,
        name: senderData.name,
        email: senderData.email,
        photoURL: senderData.photoURL || '',
        sharedClasses: sharedClasses
      });
    }
  }
}

// ============================================
// TAB SWITCHING
// ============================================
window.switchFriendsTab = function(tab) {
  document.getElementById('tab-friends').classList.toggle('active', tab === 'friends');
  document.getElementById('tab-requests').classList.toggle('active', tab === 'requests');

  if (tab === 'friends') {
    showFriendsTab();
  } else {
    showRequestsTab();
  }
};

function showFriendsTab() {
  document.getElementById('friends-section').classList.remove('hidden');
  document.getElementById('requests-section').classList.add('hidden');

  if (friendsList.length === 0) {
    document.getElementById('friends-empty').classList.remove('hidden');
    document.getElementById('friends-list').classList.add('hidden');
  } else {
    document.getElementById('friends-empty').classList.add('hidden');
    document.getElementById('friends-list').classList.remove('hidden');
    renderFriends();
  }
}

function showRequestsTab() {
  document.getElementById('friends-section').classList.add('hidden');
  document.getElementById('requests-section').classList.remove('hidden');

  if (requestsList.length === 0) {
    document.getElementById('requests-empty').classList.remove('hidden');
    document.getElementById('requests-list').classList.add('hidden');
  } else {
    document.getElementById('requests-empty').classList.add('hidden');
    document.getElementById('requests-list').classList.remove('hidden');
    renderRequests();
  }
}

// ============================================
// RENDER FRIENDS
// ============================================
function renderFriends() {
  const list = document.getElementById('friends-list');

  list.innerHTML = friendsList.map((friend, index) => {
    const initials = getInitials(friend.name);
    const color = getAvatarColor(friend.uid);
    const avatarStyle = friend.photoURL
      ? `background-image: url(${friend.photoURL})`
      : `background-color: ${color}`;
    const avatarContent = friend.photoURL ? '' : initials;

    // Shared class tags
    const classTags = friend.sharedClasses.map(classId => {
      const cls = BYU_CLASSES.find(c => c.id === classId);
      const label = cls ? cls.id.replace(/([A-Z]+)(\d+)/, '$1 $2') : classId;
      return `<span class="friend-class-tag">${label}</span>`;
    }).join('');

    // Availability comparison grid
    const compareGrid = buildCompareGrid(friend);

    return `
      <div class="friend-card" id="friend-card-${index}">
        <div class="friend-card-header" onclick="toggleFriendCard(${index})">
          <div class="friend-avatar" style="${avatarStyle}">${avatarContent}</div>
          <div class="friend-info">
            <div class="friend-name">${friend.name}</div>
            <div class="friend-shared">${friend.sharedClasses.length} shared class${friend.sharedClasses.length > 1 ? 'es' : ''}</div>
          </div>
          <svg class="friend-expand-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="friend-details">
          <!-- Contact Info -->
          <div class="friend-contact">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            <div class="friend-contact-info">
              <div class="friend-contact-label">Email</div>
              <div class="friend-contact-value"><a href="mailto:${friend.email}">${friend.email}</a></div>
            </div>
          </div>
          ${friend.phone ? `
          <div class="friend-contact">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            <div class="friend-contact-info">
              <div class="friend-contact-label">Phone</div>
              <div class="friend-contact-value"><a href="tel:${friend.phone}">${friend.phone}</a></div>
            </div>
          </div>
          ` : ''}

          <!-- Shared Classes -->
          <div class="friend-section-label">Shared Classes</div>
          <div class="friend-classes">${classTags}</div>

          <!-- Availability Comparison -->
          <div class="friend-section-label">Availability Overlap</div>
          ${compareGrid}
        </div>
      </div>
    `;
  }).join('');
}

// ============================================
// BUILD AVAILABILITY COMPARISON GRID
// ============================================
function buildCompareGrid(friend) {
  const myAvail = currentUserData.availability || {};
  const theirAvail = friend.availability || {};

  let html = '<div class="availability-compare"><div class="compare-grid">';

  // Header
  html += '<div class="compare-corner"></div>';
  DAYS.forEach(day => {
    html += `<div class="compare-header">${day}</div>`;
  });

  // Rows
  TIMES.forEach((time, i) => {
    html += `<div class="compare-time">${TIME_LABELS[i]}</div>`;
    DAYS.forEach(day => {
      const key = `${day}-${time}`;
      const iHave = myAvail[key];
      const theyHave = theirAvail[key];

      let cellClass = '';
      if (iHave && theyHave) cellClass = 'both';
      else if (iHave) cellClass = 'you-only';
      else if (theyHave) cellClass = 'them-only';

      html += `<div class="compare-cell ${cellClass}"></div>`;
    });
  });

  html += '</div>';

  // Legend
  html += `
    <div class="compare-legend">
      <div class="compare-legend-item">
        <div class="compare-legend-box both"></div>
        Both free
      </div>
      <div class="compare-legend-item">
        <div class="compare-legend-box you-only"></div>
        You only
      </div>
      <div class="compare-legend-item">
        <div class="compare-legend-box them-only"></div>
        ${friend.name.split(' ')[0]} only
      </div>
    </div>
  `;

  html += '</div>';
  return html;
}

// ============================================
// TOGGLE FRIEND CARD EXPANSION
// ============================================
window.toggleFriendCard = function(index) {
  const card = document.getElementById(`friend-card-${index}`);
  card.classList.toggle('expanded');
};

// ============================================
// RENDER REQUESTS
// ============================================
function renderRequests() {
  const list = document.getElementById('requests-list');

  list.innerHTML = requestsList.map(req => {
    const initials = getInitials(req.name);
    const color = getAvatarColor(req.uid);

    const classTags = req.sharedClasses.map(classId => {
      const cls = BYU_CLASSES.find(c => c.id === classId);
      const label = cls ? cls.id.replace(/([A-Z]+)(\d+)/, '$1 $2') : classId;
      return `<span class="friend-class-tag">${label}</span>`;
    }).join('');

    return `
      <div class="request-card">
        <div class="request-top">
          <div class="request-avatar" style="background-color: ${color}">${initials}</div>
          <div class="request-info">
            <div class="request-name">${req.name}</div>
            <div class="request-shared">${req.sharedClasses.length} shared class${req.sharedClasses.length > 1 ? 'es' : ''}</div>
          </div>
        </div>
        ${classTags ? `<div class="request-classes">${classTags}</div>` : ''}
        <div class="request-actions">
          <button class="btn btn-small btn-decline" onclick="declineRequest('${req.requestId}', '${req.uid}')">Decline</button>
          <button class="btn btn-small btn-accept" onclick="acceptRequest('${req.requestId}', '${req.uid}')">Accept</button>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================
// ACCEPT REQUEST
// ============================================
window.acceptRequest = async function(requestId, senderUid) {
  try {
    await setDoc(doc(db, 'friendRequests', requestId), {
      status: 'accepted',
      acceptedAt: new Date().toISOString()
    }, { merge: true });

    // Reload everything
    await loadAll();

  } catch (error) {
    console.error('Error accepting request:', error);
    alert('Something went wrong. Please try again.');
  }
};

// ============================================
// DECLINE REQUEST
// ============================================
window.declineRequest = async function(requestId, senderUid) {
  try {
    await deleteDoc(doc(db, 'friendRequests', requestId));

    // Remove from local list
    requestsList = requestsList.filter(r => r.requestId !== requestId);

    // Update count and re-render
    document.getElementById('requests-count').textContent = requestsList.length;
    if (requestsList.length === 0) {
      document.getElementById('requests-count').classList.remove('has-items');
    }

    showRequestsTab();

  } catch (error) {
    console.error('Error declining request:', error);
    alert('Something went wrong. Please try again.');
  }
};
