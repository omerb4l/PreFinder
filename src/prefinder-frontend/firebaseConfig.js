import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBPU__ZoNbWs1AsNmk_zuCybxNNl6T4mXw",
  authDomain: "prefinder-f04c4.firebaseapp.com",
  projectId: "prefinder-f04c4",
  storageBucket: "prefinder-f04c4.firebasestorage.app",
  messagingSenderId: "1043098676018",
  appId: "1:1043098676018:web:d78467bd83a8b604fd052b"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
