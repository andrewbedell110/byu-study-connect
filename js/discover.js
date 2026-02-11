import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
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
let classmates = [];          // All discovered classmates
let activeFilter = 'all';     // Current class filter
let sentRequests = {};        // { recipientUid: true }
let receivedRequests = {};    // { senderUid: true }
let friends = {};             // { friendUid: true }

// ============================================
// AVATAR COLORS — consistent per user
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
// AUTH CHECK
// ============================================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  currentUser = user;

  // Load current user data
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

  // Load friend requests and friends
  await loadRelationships();

  // Build filter chips from user's classes
  buildFilterChips();

  // Find classmates
  await findClassmates();
});

// ============================================
// LOAD RELATIONSHIPS (friend requests & friends)
// ============================================
async function loadRelationships() {
  try {
    // Load sent requests
    const sentSnap = await getDocs(
      query(collection(db, 'friendRequests'),
        where('from', '==', currentUser.uid),
        where('status', '==', 'pending'))
    );
    sentSnap.forEach(doc => {
      sentRequests[doc.data().to] = true;
    });

    // Load received requests
    const receivedSnap = await getDocs(
      query(collection(db, 'friendRequests'),
        where('to', '==', currentUser.uid),
        where('status', '==', 'pending'))
    );
    receivedSnap.forEach(doc => {
      receivedRequests[doc.data().from] = true;
    });

    // Load accepted friendships (where current user sent)
    const acceptedSent = await getDocs(
      query(collection(db, 'friendRequests'),
        where('from', '==', currentUser.uid),
        where('status', '==', 'accepted'))
    );
    acceptedSent.forEach(doc => {
      friends[doc.data().to] = true;
    });

    // Load accepted friendships (where current user received)
    const acceptedReceived = await getDocs(
      query(collection(db, 'friendRequests'),
        where('to', '==', currentUser.uid),
        where('status', '==', 'accepted'))
    );
    acceptedReceived.forEach(doc => {
      friends[doc.data().from] = true;
    });

  } catch (error) {
    console.error('Error loading relationships:', error);
  }
}

// ============================================
// BUILD FILTER CHIPS
// ============================================
function buildFilterChips() {
  const scroll = document.querySelector('.filter-scroll');

  currentUserData.classes.forEach(classId => {
    const cls = BYU_CLASSES.find(c => c.id === classId);
    const label = cls ? cls.id.replace(/([A-Z]+)(\d+)/, '$1 $2') : classId;

    const chip = document.createElement('button');
    chip.className = 'filter-chip';
    chip.dataset.filter = classId;
    chip.textContent = label;
    chip.onclick = () => filterByClass(classId);

    scroll.appendChild(chip);
  });
}

// ============================================
// FILTER BY CLASS
// ============================================
window.filterByClass = function(classId) {
  activeFilter = classId;

  // Update active chip
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.filter === classId);
  });

  renderClassmates();
};

// ============================================
// FIND CLASSMATES
// ============================================
async function findClassmates() {
  try {
    const myClasses = currentUserData.classes;

    if (!myClasses || myClasses.length === 0) {
      showEmpty();
      return;
    }

    // Firestore 'array-contains-any' can check up to 30 values
    // Query for users who share at least one class
    const usersSnap = await getDocs(
      query(collection(db, 'users'),
        where('profileSetup', '==', true),
        where('classes', 'array-contains-any', myClasses.slice(0, 30)))
    );

    classmates = [];

    usersSnap.forEach(docSnap => {
      // Skip self
      if (docSnap.id === currentUser.uid) return;

      const data = docSnap.data();

      // Find shared classes
      const shared = data.classes.filter(c => myClasses.includes(c));

      classmates.push({
        uid: docSnap.id,
        name: data.name,
        email: data.email,
        photoURL: data.photoURL || '',
        classes: data.classes,
        sharedClasses: shared,
        availability: data.availability || {}
      });
    });

    // Sort by most shared classes first
    classmates.sort((a, b) => b.sharedClasses.length - a.sharedClasses.length);

    renderClassmates();

  } catch (error) {
    console.error('Error finding classmates:', error);
    document.getElementById('loading-state').innerHTML =
      '<p style="color: var(--danger);">Something went wrong loading classmates. Try refreshing.</p>';
  }
}

// ============================================
// RENDER CLASSMATES
// ============================================
function renderClassmates() {
  const loadingEl = document.getElementById('loading-state');
  const emptyEl = document.getElementById('empty-state');
  const listEl = document.getElementById('student-list');

  loadingEl.classList.add('hidden');

  // Apply filter
  let filtered = classmates;
  if (activeFilter !== 'all') {
    filtered = classmates.filter(s => s.sharedClasses.includes(activeFilter));
  }

  if (filtered.length === 0) {
    emptyEl.classList.remove('hidden');
    listEl.classList.add('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  listEl.classList.remove('hidden');

  listEl.innerHTML = filtered.map(student => {
    const initials = getInitials(student.name);
    const color = getAvatarColor(student.uid);
    const isFriend = friends[student.uid];
    const isPending = sentRequests[student.uid];
    const hasReceivedRequest = receivedRequests[student.uid];

    // Avatar style
    const avatarStyle = student.photoURL
      ? `background-image: url(${student.photoURL})`
      : `background-color: ${color}`;

    const avatarContent = student.photoURL ? '' : initials;

    // Shared class tags
    const sharedTags = student.sharedClasses.map(classId => {
      const cls = BYU_CLASSES.find(c => c.id === classId);
      const label = cls ? cls.id.replace(/([A-Z]+)(\d+)/, '$1 $2') : classId;
      return `<span class="shared-tag">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        ${label}
      </span>`;
    }).join('');

    // Action button
    let actionBtn = '';
    if (isFriend) {
      actionBtn = `<button class="btn btn-small btn-already-friends">✓ Friends</button>`;
    } else if (isPending) {
      actionBtn = `<button class="btn btn-small btn-pending">Pending</button>`;
    } else if (hasReceivedRequest) {
      actionBtn = `<button class="btn btn-small btn-accept" onclick="acceptRequest('${student.uid}')">Accept Request</button>`;
    } else {
      actionBtn = `<button class="btn btn-small btn-friend" onclick="sendFriendRequest('${student.uid}')">+ Add Friend</button>`;
    }

    return `
      <div class="discover-card">
        <div class="discover-card-top">
          <div class="discover-avatar" style="${avatarStyle}">${avatarContent}</div>
          <div class="discover-info">
            <div class="discover-name">${student.name}</div>
            <div class="discover-email">${student.sharedClasses.length} shared class${student.sharedClasses.length > 1 ? 'es' : ''}</div>
          </div>
          ${actionBtn}
        </div>
        <div class="shared-classes">${sharedTags}</div>
      </div>
    `;
  }).join('');
}

function showEmpty() {
  document.getElementById('loading-state').classList.add('hidden');
  document.getElementById('empty-state').classList.remove('hidden');
  document.getElementById('student-list').classList.add('hidden');
}

// ============================================
// SEND FRIEND REQUEST
// ============================================
window.sendFriendRequest = async function(recipientUid) {
  try {
    // Create a unique ID for this request
    const requestId = `${currentUser.uid}_${recipientUid}`;

    await setDoc(doc(db, 'friendRequests', requestId), {
      from: currentUser.uid,
      fromName: currentUserData.name,
      to: recipientUid,
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    // Update local state
    sentRequests[recipientUid] = true;

    // Re-render
    renderClassmates();

  } catch (error) {
    console.error('Error sending friend request:', error);
    alert('Something went wrong. Please try again.');
  }
};

// ============================================
// ACCEPT FRIEND REQUEST
// ============================================
window.acceptRequest = async function(senderUid) {
  try {
    const requestId = `${senderUid}_${currentUser.uid}`;

    await setDoc(doc(db, 'friendRequests', requestId), {
      from: senderUid,
      to: currentUser.uid,
      status: 'accepted',
      acceptedAt: new Date().toISOString()
    }, { merge: true });

    // Update local state
    delete receivedRequests[senderUid];
    friends[senderUid] = true;

    // Re-render
    renderClassmates();

  } catch (error) {
    console.error('Error accepting request:', error);
    alert('Something went wrong. Please try again.');
  }
};
