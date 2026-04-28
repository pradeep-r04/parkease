// --- GLOBAL VARIABLES ---
let liveSlots = [];
let currentSelection = null;
let selectedHours = 1;

function setDuration(h) {
  selectedHours = h;
  document
    .querySelectorAll(".duration-btn")
    .forEach((b) => b.classList.remove("active"));
  document.getElementById("d" + h).classList.add("active");
  updateTotal();
}

// ==========================================
// BACKEND API INTEGRATION & GRID
// ==========================================
async function render() {
  try {
    const response = await fetch(
      "https://parkease-backend-m234.onrender.com/api/slots",
    );
    const dbData = await response.json();
    liveSlots = dbData.map((s) => ({ ...s, r: s.row_num, c: s.col_num }));

    ["P", "S"].forEach((side) => {
      const el = document.getElementById("u_grid" + side);
      if (!el) return;
      el.innerHTML = "";

      for (let r = 1; r <= 7; r++) {
        for (let c = 1; c <= 5; c++) {
          const slot = liveSlots.find(
            (s) => s.side === side && s.r == r && s.c == c,
          );

          if (slot) {
            const cell = document.createElement("div");
            cell.id = `slot-id-${slot.id}`;

            let displayStatus = slot.status;
            if (slot.id === currentSelection && slot.status === "available") {
              displayStatus = "selected";
            }

            cell.className = `slot ${displayStatus}`;

            if (displayStatus === "booked") {
              cell.innerHTML = `<i class="fas fa-car car-icon"></i>`;
            } else if (displayStatus === "disabled-spot") {
              cell.innerHTML = `<i class="fas fa-wheelchair" style="font-size:18px; margin-bottom:4px;"></i><span style="font-size:9px;">${slot.id}</span>`;
            } else if (displayStatus === "not-available") {
              cell.innerHTML = `<i class="fas fa-ban" style="font-size:18px; margin-bottom:4px;"></i><span style="font-size:9px;">${slot.id}</span>`;
            } else {
              cell.innerHTML = `<span class="slot-empty-text">${slot.id}</span>`;
            }

            if (slot.status === "available" || displayStatus === "selected") {
              cell.onclick = () => toggleSelect(slot.id);
              cell.style.cursor = "pointer";
            } else {
              cell.onclick = null;
              cell.style.cursor = "not-allowed";
            }

            el.appendChild(cell);
          } else {
            const placeholder = document.createElement("div");
            placeholder.style.visibility = "hidden";
            placeholder.style.width = "100%";
            placeholder.style.height = "100%";
            el.appendChild(placeholder);
          }
        }
      }
    });
  } catch (err) {
    console.error("Failed to load grid from MySQL:", err);
  }
}

function toggleSelect(id) {
  const slot = liveSlots.find((s) => s.id === id);
  if (!slot || slot.status !== "available") return;

  if (currentSelection === id) currentSelection = null;
  else currentSelection = id;

  render();
  updateTotal();
}

function updateTotal() {
  const selCount = currentSelection ? 1 : 0;
  const totalDisplay = document.getElementById("total");
  if (totalDisplay) {
    totalDisplay.innerText = `₹${selCount * 50 * selectedHours}`;
  }
}

// ==========================================
// BOOKING & HISTORY LOGIC
// ==========================================
async function confirmBooking() {
  const isLoggedIn = localStorage.getItem("loggedInRole") === "user";
  if (!currentSelection) return alert("Select a spot first!");

  // THE SMART HANDOFF
  if (!isLoggedIn) {
    sessionStorage.setItem("pendingSlot", currentSelection);
    window.location.href = "login.html";
    return;
  }

  const userEmail = localStorage.getItem("userEmail");
  
  // 🌟 NEW LOGIC: Grab the name directly from memory!
  let driverName = localStorage.getItem("userName");
  
  // Fallback: If no name is saved, use their email prefix (e.g., "pratik" from "pratik@email.com")
  if (!driverName) {
      driverName = userEmail ? userEmail.split('@')[0] : "User";
  }

  const now = new Date();
  const checkout = new Date(now.getTime() + selectedHours * 60 * 60 * 1000);
  const checkInTime = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const checkOutTime = checkout.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const bookingData = {
    id: currentSelection,
    userName: driverName,
    userEmail: userEmail,
    checkIn: checkInTime,
    checkOut: checkOutTime,
  };

  try {
    const response = await fetch(
      "https://parkease-backend-m234.onrender.com/api/book",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingData),
      },
    );

    if (response.ok) {
      currentSelection = null;
      alert("Booking Confirmed & Saved to Cloud!");
      render();
      updateTotal();
      switchUserView("history"); // Take them directly to their bookings!
    } else {
      alert("Failed to book spot. It may have just been taken!");
      render();
    }
  } catch (err) {
    console.error("Booking error:", err);
  }
}

async function cancelBooking(id) {
  if (!window.confirm("Are you sure you want to cancel this booking?")) return;
  const userEmail = localStorage.getItem("userEmail");

  try {
    await fetch("https://parkease-backend-m234.onrender.com/api/user-cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: id }),
    });
    updateHistory();
    render();
  } catch (err) {
    console.error("Cancel error:", err);
  }
}

async function updateHistory() {
  const isLoggedIn = localStorage.getItem("loggedInRole") === "user";
  if (!isLoggedIn) return; // Guests don't have history

  const userEmail = localStorage.getItem("userEmail");

  try {
    const response = await fetch(
      `https://parkease-backend-m234.onrender.com/api/history/${userEmail}`,
    );
    const dbHistory = await response.json();

    const activeTable = document.getElementById("historyTable");
    const pastTable = document.getElementById("pastHistoryTable");

    if (!activeTable || !pastTable) return;

    activeTable.innerHTML = "";
    pastTable.innerHTML = "";

    if (dbHistory.length === 0) {
      activeTable.innerHTML =
        '<tr><td colspan="4" class="table-empty">No bookings found</td></tr>';
      return;
    }

    dbHistory.forEach((h) => {
      if (h.status === "Active") {
        activeTable.innerHTML += `
          <tr>
            <td><strong>${h.slot_id}</strong></td>
            <td><span class="td-time-in">${h.check_in}</span></td>
            <td><span class="td-time-out">${h.check_out}</span></td>
            <td style="text-align: right;">
              <button onclick="cancelBooking('${h.slot_id}')" class="btn-trash">Cancel</button>
            </td>
          </tr>`;
      } else {
        let d = new Date(h.booking_date);
        let formattedDate = d.toLocaleDateString();
        let statusColor = h.status === "Completed" ? "#34d399" : "#f87171";

        pastTable.innerHTML += `
          <tr>
            <td><strong>${h.slot_id}</strong></td>
            <td style="color: #94a3b8; font-size: 11px;">${formattedDate}</td>
            <td><span class="td-time-in">${h.check_in}</span></td>
            <td><span class="td-time-out">${h.check_out}</span></td>
            <td style="text-align: right; color: ${statusColor}; font-weight: 700; font-size: 11px;">
              ${h.status}
            </td>
          </tr>`;
      }
    });
  } catch (err) {
    console.error("Database History Sync Failed:", err);
  }
}

// ==========================================
// UI, NAVIGATION, & STARTUP
// ==========================================
function switchUserView(viewName) {
  document
    .querySelectorAll(".nav-item")
    .forEach((el) => el.classList.remove("active"));
  const activeNav = document.getElementById("nav-" + viewName);
  if (activeNav) activeNav.classList.add("active");

  document
    .querySelectorAll(".view-panel")
    .forEach((panel) => panel.classList.add("hidden"));
  const activeView = document.getElementById("view-" + viewName);
  if (activeView) activeView.classList.remove("hidden");

  const title = document.getElementById("portalTitle");
  const subtitle = document.getElementById("portalSubtitle");

  if (viewName === "profile") {
    if (title) title.innerText = "User Profile";
    if (subtitle)
      subtitle.innerText = "Manage your personal and vehicle details.";
    document.getElementById("profName").value =
      localStorage.getItem("userName") || "";
    document.getElementById("profCar").value =
      localStorage.getItem("userCar") || "";
    document.getElementById("profPlate").value =
      localStorage.getItem("userPlate") || "";
  } else if (viewName === "reserve") {
    if (title) title.innerText = "Booking Portal";
    if (subtitle) subtitle.innerText = "Select your space and duration below.";
  } else if (viewName === "history") {
    if (title) title.innerText = "My Bookings";
    if (subtitle)
      subtitle.innerText = "View and manage your active reservations.";
    updateHistory();
  }
}

function saveProfile() {
  const name = document.getElementById("profName").value.trim();
  if (!name) return alert("Please enter your name!");

  localStorage.setItem("userName", name);
  localStorage.setItem("userCar", document.getElementById("profCar").value);
  localStorage.setItem("userPlate", document.getElementById("profPlate").value);

  const profileDisplay = document.getElementById("userProfileEmail");
  if (profileDisplay) profileDisplay.innerText = name;

  alert("Profile saved successfully!");
  switchUserView("reserve");
}

function startLiveClock() {
  const clockElement = document.getElementById("liveClock");
  if (!clockElement) return;
  setInterval(() => {
    const now = new Date();
    clockElement.innerText = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }, 1000);
}

function logout() {
  localStorage.removeItem("loggedInRole");
  localStorage.removeItem("userEmail");
  localStorage.removeItem("userName");
  window.location.href = "index.html";
}

window.onload = () => {
  render();
  startLiveClock();

  const isLoggedIn = localStorage.getItem("loggedInRole") === "user";
  const savedName = localStorage.getItem("userName");
  const email = localStorage.getItem("userEmail");
  const emailDisplay = document.getElementById("userProfileEmail");

  // 1. GUEST vs USER UI
  if (!isLoggedIn) {
    if (emailDisplay) emailDisplay.innerText = "Guest User";

    const navProfile = document.getElementById("nav-profile");
    const navHistory = document.getElementById("nav-history");
    if (navProfile) navProfile.style.display = "none";
    if (navHistory) navHistory.style.display = "none";

    const logoutBtn = document.querySelector(".logout-item");
    if (logoutBtn) {
      logoutBtn.innerHTML = `<i class="fas fa-sign-in-alt nav-icon"></i> Login / Sign Up`;
      logoutBtn.onclick = () => (window.location.href = "login.html");
      logoutBtn.style.color = "#10b981";
      logoutBtn.style.borderColor = "#10b981";
    }
  } else {
    if (savedName && emailDisplay) emailDisplay.innerText = savedName;
    else if (email && emailDisplay) emailDisplay.innerText = email;
  }

  // 2. SHOW LOCATION & SMART HANDOFF
  const urlParams = new URLSearchParams(window.location.search);
  const loc = urlParams.get("loc");
  if (loc) {
    const subtitle = document.getElementById("portalSubtitle");
    if (subtitle)
      subtitle.innerHTML = `<i class="fas fa-map-marker-alt"></i> Parking at: <strong>${loc}</strong>`;
  }

  const waitingSlot = sessionStorage.getItem("pendingSlot");
  if (waitingSlot && isLoggedIn) {
    currentSelection = waitingSlot;
    sessionStorage.removeItem("pendingSlot");
    updateTotal();
  }

  // 3. ROUTE TO TAB
  if (!isLoggedIn) switchUserView("reserve");
  else if (!savedName) switchUserView("profile");
  else switchUserView("reserve");
};

setInterval(() => {
  render();
  const historyView = document.getElementById("view-history");
  if (historyView && !historyView.classList.contains("hidden")) {
    updateHistory();
  }
}, 3000);
