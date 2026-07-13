import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Firebase web app configuration (client-side keys — public by design).
const firebaseConfig = {
    apiKey: 'AIzaSyDzGEWPcCnVqUCypIi2nykz-6bRV6FHhdc',
    authDomain: 'log3900-equipe-206.firebaseapp.com',
    projectId: 'log3900-equipe-206',
    storageBucket: 'log3900-equipe-206.firebasestorage.app',
    messagingSenderId: '286450791118',
    appId: '1:286450791118:web:c45af032f8b70e78d9169f',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
