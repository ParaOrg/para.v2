import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAjvMmI9t235aAjJ_rsbF-sQKWTxfwqYL8",
  authDomain: "para-471414.firebaseapp.com",
  projectId: "para-471414",
  storageBucket: "para-471414.firebasestorage.app",
  messagingSenderId: "119282140810",
  appId: "1:119282140810:web:19c92289a95f9c03c70f73",
  measurementId: "G-P3WC3L8MYZ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;
