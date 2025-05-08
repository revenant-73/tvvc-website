// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  deleteDoc, 
  doc,
  updateDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { 
  getAuth, 
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDmsZlmti2s_-tnmfzu2dl3JXHc-O_MFIo",
  authDomain: "tvvc-website.firebaseapp.com",
  projectId: "tvvc-website",
  storageBucket: "tvvc-website.firebasestorage.app",
  messagingSenderId: "235626883938",
  appId: "1:235626883938:web:109885d0682b9080bd1a3b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Collection references
const registrationsCollectionRef = collection(db, 'tryoutRegistrations');

// Fetch all registrations from Firestore
async function fetchRegistrations() {
  try {
    const q = query(registrationsCollectionRef, orderBy('registrationDate', 'desc'));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('No registrations found');
      return [];
    }
    
    // Process the data
    const registrations = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      registrations.push({
        id: doc.id,
        timestamp: data.registrationDate ? data.registrationDate.toDate() : new Date(),
        playerName: `${data.playerInfo?.firstName || ''} ${data.playerInfo?.lastName || ''}`.trim(),
        birthDate: data.playerInfo?.birthDate || '',
        ageGroup: data.playerInfo?.ageGroup || '',
        position: data.volleyballExperience?.primaryPosition || '',
        secondaryPosition: data.volleyballExperience?.secondaryPosition || '',
        experienceLevel: data.volleyballExperience?.experienceLevel || '',
        previousClub: data.volleyballExperience?.previousClub || '',
        grade: data.playerInfo?.grade || '',
        school: data.playerInfo?.school || '',
        parentName: data.guardianInfo?.name || '',
        parentEmail: data.guardianInfo?.email || '',
        parentPhone: data.guardianInfo?.phone || '',
        parentAddress: `${data.guardianInfo?.address || ''}, ${data.guardianInfo?.city || ''}, ${data.guardianInfo?.zip || ''}`.trim(),
        tryoutSession: data.tryoutSession || '',
        status: data.status || 'pending',
        rawData: data // Store the raw data for reference
      });
    });
    
    return registrations;
  } catch (error) {
    console.error('Error fetching registrations:', error);
    return [];
  }
}

// Delete a registration by ID
async function deleteRegistration(id) {
  try {
    const docRef = doc(db, 'tryoutRegistrations', id);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error('Error deleting registration:', error);
    return false;
  }
}

// Update a registration's status
async function updateRegistrationStatus(id, status) {
  try {
    const docRef = doc(db, 'tryoutRegistrations', id);
    await updateDoc(docRef, {
      status: status
    });
    return true;
  } catch (error) {
    console.error('Error updating registration status:', error);
    return false;
  }
}

// Clear all registrations (admin only)
async function clearAllRegistrations() {
  try {
    const q = query(registrationsCollectionRef);
    const snapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    snapshot.forEach(document => {
      batch.delete(doc(db, 'tryoutRegistrations', document.id));
    });
    
    await batch.commit();
    return true;
  } catch (error) {
    console.error('Error clearing registrations:', error);
    return false;
  }
}

// Authentication functions
// Check if user is authenticated
function isUserAuthenticated() {
  return auth.currentUser !== null;
}

// Sign in with email and password
async function signInWithEmail(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error('Error signing in:', error);
    throw error;
  }
}

// Sign out
async function signOutUser() {
  try {
    await signOut(auth);
    return true;
  } catch (error) {
    console.error('Error signing out:', error);
    return false;
  }
}

// Reset password
async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return true;
  } catch (error) {
    console.error('Error resetting password:', error);
    throw error;
  }
}

// Export functions and objects
export {
  app,
  db,
  auth,
  fetchRegistrations,
  deleteRegistration,
  updateRegistrationStatus,
  clearAllRegistrations,
  isUserAuthenticated,
  signInWithEmail,
  signOutUser,
  resetPassword
};