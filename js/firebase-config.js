
// ============================================
// FIREBASE CONFIGURATION
// Replace the values below with YOUR config
// from Firebase Console → Project Settings
// ============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-storage.js";

// 🔽 PASTE YOUR FIREBASE CONFIG HERE (replace the placeholder values) 🔽
const firebaseConfig = {
  apiKey: "AIzaSyBhh_qDrCBBnFF6yTRQ1I3xsSSJykJM1Mo",
  authDomain: "byu-study-connect.firebaseapp.com",
  projectId: "byu-study-connect",
  storageBucket: "byu-study-connect.firebasestorage.app",
  messagingSenderId: "824059788995",
  appId: "1:824059788995:web:c1971f1a31cc4f4b43ec76",
  measurementId: "G-KHYX1BHHMD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services and export them for use in other files
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
