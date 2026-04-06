// ==========================================
// CUSTOM MYSQL AUTHENTICATION LOGIC
// ==========================================

async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (email === "" || password === "") {
    alert("Please fill all fields");
    return;
  }

  // 1. Keep your Admin bypass
  if (email === "admin@parkease.com" && password === "admin123") {
    localStorage.setItem("loggedInRole", "admin");
    window.location.href = "admin.html";
    return;
  }

  // 2. Fetch from your Node.js MySQL Server
  try {
    const response = await fetch("https://parkease-backend-m234.onrender.com/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();

    if (response.ok) {
      // Save data to memory
      localStorage.setItem("loggedInRole", "user");
      localStorage.setItem("userEmail", data.user.email);
      localStorage.setItem("userName", data.user.name);
      localStorage.setItem("userPlate", data.user.plate || "");

      // Redirect to the booking grid!
      window.location.href = "booking-grid.html";
    } else {
      alert("Login Failed: " + data.error);
    }
  } catch (err) {
    console.error("Login Error:", err);
    alert("Server error. Is your Node.js server running?");
  }
}

// UPDATED LOGOUT FUNCTION
function logout() {
  localStorage.clear(); // Clears all saved user data
  window.location.href = "index.html"; // Back to login page
}

// UPDATED SIGNUP FUNCTION
async function register() {
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const vehicle = document.getElementById("vehicle").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  // Existing validations...
  if (!name || !email || !phone || !vehicle || !password || !confirmPassword) {
    return alert("Please fill all fields");
  }
  if (!/^[6-9]\d{9}$/.test(phone))
    return alert("Enter a valid 10-digit phone number");
  if (vehicle.length < 6) return alert("Enter a valid vehicle number");
  if (password !== confirmPassword) return alert("Passwords do not match");
  if (password.length < 6)
    return alert("Password must be at least 6 characters");

  // Send to MySQL Node Server
  try {
    const response = await fetch("https://parkease-backend-m234.onrender.com/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name,
        email: email,
        password: password,
        carModel: "Not specified",
        licensePlate: vehicle,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      alert("Account created successfully! Please log in.");
      window.location.href = "index.html"; // Send to login page
    } else {
      alert("Error: " + data.error);
    }
  } catch (error) {
    console.error("Signup Error:", error);
    alert("Server error. Is your Node.js server running?");
  }
}

// Forgot Password (Stubbed out until you add an email server)
function forgotPassword() {
  alert("Password reset requires an email server. Coming soon!");
}

// ==========================================
// UI LOGIC (Password Strength & Dark Mode)
// ==========================================

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
