import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Firebase web app configuration.
// Create your own project at https://console.firebase.google.com and paste its config here.
const firebaseConfig = {
    apiKey: 'YOUR_FIREBASE_API_KEY',
    authDomain: 'your-project.firebaseapp.com',
    projectId: 'your-project',
    storageBucket: 'your-project.firebasestorage.app',
    messagingSenderId: 'YOUR_SENDER_ID',
    appId: 'YOUR_FIREBASE_APP_ID',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
