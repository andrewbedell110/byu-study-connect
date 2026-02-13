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
let allHerds = [];
let currentFilter = 'all';
let selectedHerd = null;

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
// LOAD HERDS
// ============================================
async function loadHerds() {
  try {
    const herdsQuery = query(
      collection(db, 'herds'),
      where('active', '==', true)
    );

    const snapshot = await getDocs(herdsQuery);
    const rawHerds = [];
    snapshot.forEach(doc => {
      rawHerds.push({ id: doc.id, ...doc.data() });
    });

    // Filter out closed herds unless user is a member
    allHerds = rawHerds.filter(herd => {
      if (herd.visibility === 'closed' && !herd.members?.includes(currentUser.uid)) {
        return false;
      }
      return true;
    });

    renderMarkers(allHerds);
  } catch (error) {
    console.error('Error loading herds:', error);
  }
}

// ============================================
// RENDER MAP MARKERS
// ============================================
function renderMarkers(herds) {
  const container = document.getElementById('map-markers');

  // Distribute markers across the map
  const positions = [
    { top: '25%', left: '20%' },
    { top: '18%', left: '65%' },
    { top: '40%', left: '45%' },
    { top: '55%', left: '20%' },
    { top: '35%', left: '75%' },
    { top: '65%', left: '60%' },
    { top: '50%', left: '35%' },
    { top: '30%', left: '30%' },
  ];

  container.innerHTML = herds.map((herd, i) => {
    const pos = positions[i % positions.length];
    const style = herd.style || 'casual';

    return `
      <div class="map-marker" style="top: ${pos.top}; left: ${pos.left};" onclick="showDetail('${herd.id}')" data-style="${style}" data-id="${herd.id}">
        <div class="marker-pin ${style}"></div>
        <div class="marker-label">${escapeHtml(herd.name).substring(0, 15)}</div>
      </div>
    `;
  }).join('');
}

// ============================================
// FILTER
// ============================================
window.filterHerds = function(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');

  const filtered = filter === 'all'
    ? allHerds
    : allHerds.filter(h => h.style === filter);

  renderMarkers(filtered);
  closeDetail();
};

// Search
document.getElementById('roam-search').addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  let filtered = allHerds.filter(h =>
    h.name.toLowerCase().includes(term) ||
    (h.location || '').toLowerCase().includes(term)
  );

  if (currentFilter !== 'all') {
    filtered = filtered.filter(h => h.style === currentFilter);
  }

  renderMarkers(filtered);
});

// ============================================
// CLASS NAME HELPER
// ============================================
function getClassLabel(classId) {
  if (!classId) return '';
  const cls = BYU_CLASSES.find(c => c.id === classId);
  return cls ? cls.id.replace(/([A-Z]+)(\d+)/, '$1 $2') : classId;
}

// ============================================
// DETAIL CARD
// ============================================
window.showDetail = function(herdId) {
  selectedHerd = allHerds.find(h => h.id === herdId);
  if (!selectedHerd) return;

  // Highlight marker
  document.querySelectorAll('.map-marker').forEach(m => m.classList.remove('active'));
  const marker = document.querySelector(`.map-marker[data-id="${herdId}"]`);
  if (marker) marker.classList.add('active');

  document.getElementById('detail-title').textContent = selectedHerd.name;

  const meta = document.getElementById('detail-meta');
  const classLabel = getClassLabel(selectedHerd.classId);
  meta.innerHTML = `
    ${classLabel ? `<span><span class="material-symbols-rounded">school</span> ${escapeHtml(classLabel)}</span>` : ''}
    <span><span class="material-symbols-rounded">location_on</span> ${escapeHtml(selectedHerd.location || 'TBD')}</span>
    <span><span class="material-symbols-rounded">group</span> ${selectedHerd.memberCount || selectedHerd.members?.length || 0} members</span>
    <span><span class="material-symbols-rounded">schedule</span> ${selectedHerd.schedule?.startTime || ''}</span>
  `;

  const joinBtn = document.getElementById('detail-join-btn');
  const isMember = selectedHerd.members?.includes(currentUser.uid);
  joinBtn.className = isMember ? 'join-btn joined' : 'join-btn';
  joinBtn.innerHTML = isMember
    ? '<span class="material-symbols-rounded" style="font-size: 16px;">check</span> Joined'
    : '<span class="material-symbols-rounded" style="font-size: 16px;">group_add</span> Join Herd';
  joinBtn.onclick = () => joinHerdFromDetail(herdId, joinBtn);
  joinBtn.style.width = '100%';

  document.getElementById('roam-detail').classList.add('visible');
};

window.closeDetail = function() {
  document.getElementById('roam-detail').classList.remove('visible');
  document.querySelectorAll('.map-marker').forEach(m => m.classList.remove('active'));
  selectedHerd = null;
};

async function joinHerdFromDetail(herdId, btn) {
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
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
