
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyCYHGFLPFO09SHIdxgpvD62Oh9z_ZYlEZI",
  authDomain: "evolve-cc3e1.firebaseapp.com",
  projectId: "evolve-cc3e1",
  storageBucket: "evolve-cc3e1.firebasestorage.app",
  messagingSenderId: "781948363967",
  appId: "1:781948363967:web:5ade32f60edc970b1ed20a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Authentication
export const auth = getAuth(app);

// Initialize Cloud Firestore
export const db = getFirestore(app);

// Export Firebase app
export default app;