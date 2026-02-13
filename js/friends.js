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
  where,
  updateDoc,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";
import { getAvatarColor, getInitials } from './shared.js';

let currentUser = null;
let userData = null;
let friendsList = [];       // Full friend user docs
let classmatesList = [];    // Users sharing classes (not friends)
let pendingRequests = [];   // Incoming requests
let sentRequests = [];      // Outgoing requests

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
  loadFriendsPage();
});

// ============================================
// TOGGLE SEARCH
// ============================================
window.toggleSearch = function() {
  const searchEl = document.getElementById('friends-search');
  searchEl.classList.toggle('hidden');
  if (!searchEl.classList.contains('hidden')) {
    document.getElementById('search-input').focus();
  }
};

// Search handler
document.getElementById('search-input').addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  renderFriends(friendsList.filter(f =>
    f.name.toLowerCase().includes(term)
  ));
  renderClassmates(classmatesList.filter(c =>
    c.name.toLowerCase().includes(term)
  ));
});

// ============================================
// LOAD FRIENDS PAGE
// ============================================
async function loadFriendsPage() {
  const loading = document.getElementById('friends-loading');
  const content = document.getElementById('friends-content');

  try {
    const userClasses = userData?.classes || [];
    const friendUids = userData?.friends || [];

    // 1. Query incoming pending friend requests
    const incomingQuery = query(
      collection(db, 'friendRequests'),
      where('to', '==', currentUser.uid),
      where('status', '==', 'pending')
    );
    const incomingSnapshot = await getDocs(incomingQuery);
    pendingRequests = [];
    incomingSnapshot.forEach(d => {
      pendingRequests.push({ id: d.id, ...d.data() });
    });

    // 2. Query outgoing pending friend requests (for button state)
    const outgoingQuery = query(
      collection(db, 'friendRequests'),
      where('from', '==', currentUser.uid),
      where('status', '==', 'pending')
    );
    const outgoingSnapshot = await getDocs(outgoingQuery);
    sentRequests = [];
    outgoingSnapshot.forEach(d => {
      sentRequests.push({ id: d.id, ...d.data() });
    });

    // 3. Fetch friend user docs (batched in groups of 10 for Firestore in-query limit)
    friendsList = [];
    if (friendUids.length > 0) {
      const batches = [];
      for (let i = 0; i < friendUids.length; i += 10) {
        batches.push(friendUids.slice(i, i + 10));
      }
      for (const batch of batches) {
        const friendQuery = query(
          collection(db, 'users'),
          where('__name__', 'in', batch)
        );
        const friendSnapshot = await getDocs(friendQuery);
        friendSnapshot.forEach(d => {
          friendsList.push({ uid: d.id, ...d.data() });
        });
      }
    }

    // 4. Query classmates (users sharing at least one class)
    classmatesList = [];
    if (userClasses.length > 0) {
      // Firestore array-contains-any supports up to 30 values
      const classChunks = [];
      for (let i = 0; i < userClasses.length; i += 30) {
        classChunks.push(userClasses.slice(i, i + 30));
      }
      const seenUids = new Set();
      for (const chunk of classChunks) {
        const classmateQuery = query(
          collection(db, 'users'),
          where('classes', 'array-contains-any', chunk),
          where('profileSetup', '==', true)
        );
        const classmateSnapshot = await getDocs(classmateQuery);
        classmateSnapshot.forEach(d => {
          // Exclude self, existing friends, and duplicates
          if (d.id !== currentUser.uid && !friendUids.includes(d.id) && !seenUids.has(d.id)) {
            seenUids.add(d.id);
            classmatesList.push({ uid: d.id, ...d.data() });
          }
        });
      }
    }

    renderPendingRequests(pendingRequests);
    renderFriends(friendsList);
    renderClassmates(classmatesList);

  } catch (error) {
    console.error('Error loading friends page:', error);
  } finally {
    loading.classList.add('hidden');
    content.classList.remove('hidden');
  }
}

// ============================================
// RENDER PENDING REQUESTS
// ============================================
function renderPendingRequests(requests) {
  const section = document.getElementById('pending-section');
  const container = document.getElementById('pending-requests');

  if (requests.length === 0) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  container.innerHTML = requests.map(req => {
    // Try to find this user in classmatesList for more info
    const fromUser = classmatesList.find(c => c.uid === req.from);
    const name = fromUser?.name || req.fromName || 'Unknown';
    const uid = req.from;
    const color = getAvatarColor(uid);
    const initials = getInitials(name);
    const sharedClasses = getSharedClasses(fromUser?.classes || []);

    return `
      <div class="friend-card animate-in" id="request-${req.id}">
        <div class="friend-avatar" style="background-color: ${color};">${initials}</div>
        <div class="friend-info">
          <div class="friend-name">${escapeHtml(name)}</div>
          <div class="friend-meta">
            ${sharedClasses.map(c => `<span class="friend-class-badge">${escapeHtml(c)}</span>`).join('')}
          </div>
        </div>
        <div class="request-actions">
          <button class="accept-btn" onclick="acceptRequest('${req.id}', '${uid}')">
            <span class="material-symbols-rounded">check</span>
            Accept
          </button>
          <button class="decline-btn" onclick="declineRequest('${req.id}')">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================
// RENDER FRIENDS
// ============================================
function renderFriends(friends) {
  const container = document.getElementById('my-friends');

  if (friends.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 32px 20px;">
        <span class="material-symbols-rounded">people</span>
        <h3>No friends yet</h3>
        <p>Connect with classmates below to start building your herd!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = friends.map(friend => {
    const color = getAvatarColor(friend.uid);
    const initials = getInitials(friend.name || '?');
    const sharedClasses = getSharedClasses(friend.classes || []);

    return `
      <div class="friend-card animate-in">
        <div class="friend-avatar" style="background-color: ${color};">${initials}</div>
        <div class="friend-info">
          <div class="friend-name">${escapeHtml(friend.name || '')}</div>
          <div class="friend-meta">
            ${sharedClasses.map(c => `<span class="friend-class-badge">${escapeHtml(c)}</span>`).join('')}
          </div>
          <div class="friend-contact">
            ${friend.email ? `<span class="material-symbols-rounded">email</span> <a href="mailto:${escapeHtml(friend.email)}">${escapeHtml(friend.email)}</a>` : ''}
            ${friend.email && friend.phone ? '<span style="margin: 0 4px;">|</span>' : ''}
            ${friend.phone ? `<span class="material-symbols-rounded">phone</span> <a href="tel:${escapeHtml(friend.phone)}">${escapeHtml(friend.phone)}</a>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================
// RENDER CLASSMATES
// ============================================
function renderClassmates(classmates) {
  const container = document.getElementById('classmates-list');

  if (classmates.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--gray-400); padding: 20px; font-size: 0.85rem;">No classmates found. Add classes in your profile!</p>';
    return;
  }

  container.innerHTML = classmates.map(mate => {
    const color = getAvatarColor(mate.uid);
    const initials = getInitials(mate.name || '?');
    const sharedClasses = getSharedClasses(mate.classes || []);

    // Check request state
    const hasSent = sentRequests.find(r => r.to === mate.uid);
    const hasIncoming = pendingRequests.find(r => r.from === mate.uid);

    let actionHtml;
    if (hasIncoming) {
      actionHtml = `
        <button class="connect-btn" onclick="acceptRequest('${hasIncoming.id}', '${mate.uid}')">
          <span class="material-symbols-rounded">check</span> Accept
        </button>
      `;
    } else if (hasSent) {
      actionHtml = `
        <button class="connect-btn sent" disabled>
          <span class="material-symbols-rounded">schedule</span> Sent
        </button>
      `;
    } else {
      actionHtml = `
        <button class="connect-btn" onclick="sendRequest('${mate.uid}', '${escapeHtml(mate.name || '')}', this)">
          <span class="material-symbols-rounded">person_add</span> Connect
        </button>
      `;
    }

    return `
      <div class="friend-card animate-in">
        <div class="friend-avatar" style="background-color: ${color};">${initials}</div>
        <div class="friend-info">
          <div class="friend-name">${escapeHtml(mate.name || '')}</div>
          <div class="friend-meta">
            ${sharedClasses.map(c => `<span class="friend-class-badge">${escapeHtml(c)}</span>`).join('')}
          </div>
        </div>
        <div class="friend-action">
          ${actionHtml}
        </div>
      </div>
    `;
  }).join('');
}

// ============================================
// SEND FRIEND REQUEST
// ============================================
window.sendRequest = async function(toUid, toName, btn) {
  if (!currentUser) return;
  btn.disabled = true;

  try {
    const requestId = `${currentUser.uid}_${toUid}`;
    await setDoc(doc(db, 'friendRequests', requestId), {
      from: currentUser.uid,
      to: toUid,
      fromName: userData?.name || currentUser.email,
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    // Update local state
    sentRequests.push({ id: requestId, from: currentUser.uid, to: toUid, status: 'pending' });

    btn.classList.add('sent');
    btn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 16px;">schedule</span> Sent';
  } catch (error) {
    console.error('Error sending friend request:', error);
    btn.disabled = false;
  }
};

// ============================================
// ACCEPT FRIEND REQUEST
// ============================================
window.acceptRequest = async function(requestId, fromUid) {
  try {
    // Update request status
    await updateDoc(doc(db, 'friendRequests', requestId), {
      status: 'accepted'
    });

    // Add to both users' friends arrays
    await updateDoc(doc(db, 'users', currentUser.uid), {
      friends: arrayUnion(fromUid)
    });
    await updateDoc(doc(db, 'users', fromUid), {
      friends: arrayUnion(currentUser.uid)
    });

    // Reload the page data
    userData.friends = [...(userData.friends || []), fromUid];
    await loadFriendsPage();

  } catch (error) {
    console.error('Error accepting friend request:', error);
  }
};

// ============================================
// DECLINE FRIEND REQUEST
// ============================================
window.declineRequest = async function(requestId) {
  try {
    await updateDoc(doc(db, 'friendRequests', requestId), {
      status: 'declined'
    });

    // Remove from local state and re-render
    pendingRequests = pendingRequests.filter(r => r.id !== requestId);
    renderPendingRequests(pendingRequests);

  } catch (error) {
    console.error('Error declining friend request:', error);
  }
};

// ============================================
// HELPERS
// ============================================
function getSharedClasses(theirClasses) {
  const myClasses = userData?.classes || [];
  return theirClasses
    .filter(c => myClasses.includes(c))
    .map(c => c.replace(/([A-Z]+)(\d+)/, '$1 $2'));
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
