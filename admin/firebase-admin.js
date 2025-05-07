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
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();

// Initialize Firebase Auth
const auth = firebase.auth();

// Collection references
const registrationsCollection = db.collection('tryoutRegistrations');

// Fetch all registrations from Firestore
async function fetchRegistrations() {
  try {
    const snapshot = await registrationsCollection.orderBy('registrationDate', 'desc').get();
    
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
    await registrationsCollection.doc(id).delete();
    return true;
  } catch (error) {
    console.error('Error deleting registration:', error);
    return false;
  }
}

// Update a registration's status
async function updateRegistrationStatus(id, status) {
  try {
    await registrationsCollection.doc(id).update({
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
    const batch = db.batch();
    const snapshot = await registrationsCollection.get();
    
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    return true;
  } catch (error) {
    console.error('Error clearing registrations:', error);
    return false;
  }
}