// 1. REAL FIREBASE LOGIN FUNCTION
function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (email === "" || password === "") {
    alert("Please fill all fields");
    return;
  }

  // Check for Hardcoded Admin first (Optional - you can also store admin in Firebase)
  if (email === "admin@parkease.com" && password === "admin123") {
    localStorage.setItem('loggedInRole', 'admin');
    window.location.href = "admin.html"; // Redirects to our new Enterprise Admin Panel
    return;
  }

  // --- 2. NEW USER PROFILE CHECK (user1@gmail.com) ---
  if (email === "user1@gmail.com" && password === "user1") {
    localStorage.setItem('loggedInRole', 'user');
    localStorage.setItem('userEmail', 'user1@gmail.com');
    window.location.href = "booking-grid.html"; 
    return;
  }

  // Firebase Auth for regular users
  firebase.auth().signInWithEmailAndPassword(email, password)
    .then((userCredential) => {
      const user = userCredential.user;

      // Check if user has verified their email
      if (user.emailVerified) {
        localStorage.setItem('loggedInRole', 'user');
        localStorage.setItem('userEmail', user.email);
        
        // Redirect to your new interactive booking grid
        window.location.href = "booking-grid.html"; 
      } else {
        alert("Please verify your email before logging in. Check your inbox!");
        firebase.auth().signOut();
      }
    })
    .catch((error) => {
      alert("Login Failed: " + error.message);
    });
}

// 2. UPDATED LOGOUT FUNCTION
function logout() {
  firebase.auth().signOut().then(() => {
    localStorage.removeItem('loggedInRole');
    localStorage.removeItem('userEmail');
    window.location.href = "index.html"; // Back to login page
  }).catch((error) => {
    console.error("Logout Error:", error);
  });
}


function register() {
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const vehicle = document.getElementById("vehicle").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  // Empty field check
  if (!name || !email || !phone || !vehicle || !password || !confirmPassword) {
    alert("Please fill all fields");
    return;
  }

  // Phone number validation
  if (!/^[6-9]\d{9}$/.test(phone)) {
    alert("Enter a valid 10-digit phone number");
    return;
  }

  // Vehicle number basic validation
  if (vehicle.length < 6) {
    alert("Enter a valid vehicle number");
    return;
  }

  // Password match
  if (password !== confirmPassword) {
    alert("Passwords do not match");
    return;
  }

  // Password strength
  if (password.length < 6) {
    alert("Password must be at least 6 characters");
    return;
  }

  // Firebase registration call
  registerUser(email, password, name, phone, vehicle);
}

// Register + Verify 

function registerUser(email, password, name, phone, vehicle) {
  firebase.auth().createUserWithEmailAndPassword(email, password)
    .then((userCredential) => {
      const user = userCredential.user;

      // Send verification email
      user.sendEmailVerification();

      // Save user data
      firebase.database().ref("users/" + user.uid).set({
        name,
        email,
        phone,
        vehicle,
        role: "user",   // default role
        verified: false
      });

      alert("Verification email sent. Please verify before login.");
      window.location.href = "login.html";
    })
    .catch((error) => {
      alert(error.message);
    });
}

// forgot password
function forgotPassword() {
  const email = document.getElementById("email").value;

  if (!email) {
    alert("Please enter your email first");
    return;
  }

  firebase.auth().sendPasswordResetEmail(email)
    .then(() => {
      alert("Password reset email sent!");
    })
    .catch((error) => {
      alert(error.message);
    });
}

// firebase auth
const firebaseConfig = {
  apiKey: "AIzaSyCnd_ejXbEXmRyPNo6mkiNejTt1bRUwy20",
  authDomain: "parkease-c37d5.firebaseapp.com",
  projectId: "parkease-c37d5",
  storageBucket: "parkease-c37d5.firebasestorage.app",
  messagingSenderId: "408681985860",
  appId: "1:408681985860:web:7f022ae6d12cce816e8911",
  measurementId: "G-DGYY8PP4Z9"
};

// CRITICAL FIX: Use the correct V8 initialization syntax
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// password strength
function checkStrength() {
  const password = document.getElementById("password").value;
  const bar = document.getElementById("strength-bar");
  const text = document.getElementById("strength-text");

  let strength = 0;

  if (password.length >= 6) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;

  if (strength === 0) {
    bar.style.width = "0%";
    text.innerText = "";
  } else if (strength === 1) {
    bar.style.width = "25%";
    bar.style.background = "red";
    text.innerText = "Weak password";
  } else if (strength === 2) {
    bar.style.width = "50%";
    bar.style.background = "orange";
    text.innerText = "Moderate password";
  } else if (strength === 3) {
    bar.style.width = "75%";
    bar.style.background = "#f1c40f";
    text.innerText = "Strong password";
  } else {
    bar.style.width = "100%";
    bar.style.background = "green";
    text.innerText = "Very strong password 💪";
  }
}

function toggleDarkMode() {
  document.body.classList.toggle("dark");
}

// bookings
let currentSlot = null;

function selectSlot(slot) {
  if (slot.classList.contains("occupied")) return;

  document.querySelectorAll(".slot").forEach(s => {
    s.classList.remove("selected");
  });

  slot.classList.add("selected");
  currentSlot = slot.innerText;

  document.getElementById("selectedSlot").innerText = currentSlot;

  const btn = document.getElementById("bookBtn");
  btn.classList.remove("disabled");
}

function confirmBooking() {
  if (!currentSlot) return;

  alert(`Slot ${currentSlot} booked successfully! 🚗`);

  // 🔥 REAL-TIME READY (Firebase idea)
  // firebase.database().ref("slots/" + currentSlot).set({
  //   status: "occupied",
  //   bookedAt: Date.now()
  // });

  currentSlot = null;
}

function downloadPDF() {
  window.print();
}

