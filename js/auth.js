import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";

// ============================================
// TAB SWITCHING
// ============================================
window.switchTab = function(tab) {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');
  const message = document.getElementById('auth-message');

  // Clear any messages
  message.className = 'message';
  message.textContent = '';

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
  } else {
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
    tabLogin.classList.remove('active');
    tabSignup.classList.add('active');
  }
};

// ============================================
// SHOW MESSAGE
// ============================================
function showMessage(text, type) {
  const message = document.getElementById('auth-message');
  message.textContent = text;
  message.className = `message ${type}`;
}

// ============================================
// SET BUTTON LOADING STATE
// ============================================
function setLoading(buttonId, loading) {
  const btn = document.getElementById(buttonId);
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.innerHTML = '<div class="spinner"></div>';
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.originalText;
  }
}

// ============================================
// HANDLE SIGNUP
// ============================================
window.handleSignup = async function() {
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirmPassword = document.getElementById('signup-password-confirm').value;

  // Validation
  if (!name || !email || !password || !confirmPassword) {
    showMessage('Please fill in all fields.', 'error');
    return;
  }

  if (password !== confirmPassword) {
    showMessage('Passwords do not match.', 'error');
    return;
  }

  if (password.length < 6) {
    showMessage('Password must be at least 6 characters.', 'error');
    return;
  }

  setLoading('signup-btn', true);

  try {
    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Create user document in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      name: name,
      email: email,
      profileSetup: false,  // They still need to pick classes & availability
      classes: [],
      availability: {},
      photoURL: '',
      friends: [],
      createdAt: new Date().toISOString()
    });

    showMessage('Account created! Redirecting...', 'success');

    // Redirect to profile setup
    setTimeout(() => {
      window.location.href = 'profile-setup.html';
    }, 1000);

  } catch (error) {
    console.error('Signup error:', error);

    // User-friendly error messages
    switch (error.code) {
      case 'auth/email-already-in-use':
        showMessage('An account with this email already exists.', 'error');
        break;
      case 'auth/invalid-email':
        showMessage('Please enter a valid email address.', 'error');
        break;
      case 'auth/weak-password':
        showMessage('Password must be at least 6 characters.', 'error');
        break;
      default:
        showMessage('Something went wrong. Please try again.', 'error');
    }

    setLoading('signup-btn', false);
  }
};

// ============================================
// HANDLE LOGIN
// ============================================
window.handleLogin = async function() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    showMessage('Please fill in all fields.', 'error');
    return;
  }

  setLoading('login-btn', true);

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Check if profile is set up
    const userDoc = await getDoc(doc(db, 'users', user.uid));

    if (userDoc.exists() && userDoc.data().profileSetup) {
      // Profile is complete — go to discover page
      window.location.href = 'pasture.html';
    } else {
      // Profile not complete — go to profile setup
      window.location.href = 'profile-setup.html';
    }

  } catch (error) {
    console.error('Login error:', error);

    switch (error.code) {
      case 'auth/user-not-found':
        showMessage('No account found with this email.', 'error');
        break;
      case 'auth/wrong-password':
        showMessage('Incorrect password.', 'error');
        break;
      case 'auth/invalid-email':
        showMessage('Please enter a valid email address.', 'error');
        break;
      case 'auth/invalid-credential':
        showMessage('Invalid email or password.', 'error');
        break;
      default:
        showMessage('Something went wrong. Please try again.', 'error');
    }

    setLoading('login-btn', false);
  }
};

// ============================================
// CHECK IF ALREADY LOGGED IN
// ============================================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // User is signed in — check if profile is set up
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists() && userDoc.data().profileSetup) {
      window.location.href = 'pasture.html';
    } else {
      window.location.href = 'profile-setup.html';
    }
  }
});

// ============================================
// ENTER KEY SUPPORT
// ============================================
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const loginForm = document.getElementById('login-form');
    if (!loginForm.classList.contains('hidden')) {
      handleLogin();
    } else {
      handleSignup();
    }
  }
});
