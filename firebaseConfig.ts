// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBN1bUvNXYmCbQy1LfQ72pWOz6q5jfBYZY",
  authDomain: "single-session-login-app.firebaseapp.com",
  projectId: "single-session-login-app",
  storageBucket: "single-session-login-app.firebasestorage.app",
  messagingSenderId: "174110640461",
  appId: "1:174110640461:web:74e37b371930cf6d0e0f04",
  measurementId: "G-CY8GWM9YZN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
