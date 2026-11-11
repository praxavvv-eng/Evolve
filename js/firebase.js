
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "evolve-cc3e1.firebaseapp.com",
  projectId: "evolve-cc3e1",
  storageBucket: "evolve-cc3e1.firebasestorage.app",
  messagingSenderId: "781948363967",
  appId: "1:781948363967:web:5ade32f60edc970b1ed20a"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
