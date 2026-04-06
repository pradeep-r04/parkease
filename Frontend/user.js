// --- GLOBAL VARIABLES ---
let liveSlots = []; // Holds the live MySQL data
let currentSelection = null; // Remembers which slot you clicked before confirming
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
// BACKEND API INTEGRATION
// ==========================================

async function render() {
  try {
    // 1. Fetch live data from MySQL!
    const response = await fetch("https://parkease-backend-m234.onrender.com/api/slots");
    const dbData = await response.json();

    // Map database columns to local layout logic
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

            // Check if this is the slot the user currently clicked on
            let displayStatus = slot.status;
            if (slot.id === currentSelection && slot.status === "available") {
              displayStatus = "selected";
            }

            cell.className = `slot ${displayStatus}`;

            // Render Icons based on status
            if (displayStatus === "booked") {
              cell.innerHTML = `<i class="fas fa-car car-icon"></i>`;
            } else if (displayStatus === "disabled-spot") {
              cell.innerHTML = `<i class="fas fa-wheelchair" style="font-size:18px; margin-bottom:4px;"></i><span style="font-size:9px;">${slot.id}</span>`;
            } else if (displayStatus === "not-available") {
              cell.innerHTML = `<i class="fas fa-ban" style="font-size:18px; margin-bottom:4px;"></i><span style="font-size:9px;">${slot.id}</span>`;
            } else {
              cell.innerHTML = `<span class="slot-empty-text">${slot.id}</span>`;
            }

            // Allow clicking only if available or already selected
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

    updateHistory(); // Make sure history checks against live data
  } catch (err) {
    console.error("Failed to load grid from MySQL:", err);
  }
}

function toggleSelect(id) {
  const slot = liveSlots.find((s) => s.id === id);
  if (!slot || slot.status !== "available") return;

  // Toggle the selection locally
  if (currentSelection === id) {
    currentSelection = null; // Deselect
  } else {
    currentSelection = id; // Select new
  }

  render(); // Redraw the grid to show the green selection
  updateTotal();
}

function updateTotal() {
  const selCount = currentSelection ? 1 : 0; // User can only select 1 at a time now
  const totalDisplay = document.getElementById("total");
  if (totalDisplay) {
    totalDisplay.innerText = `₹${selCount * 50 * selectedHours}`;
  }
}

// --- UPDATED CONFIRM LOGIC (Saves to MySQL) ---
async function confirmBooking() {
  const userEmail = localStorage.getItem("userEmail") || "guest@parkease.com";
  const driverNameInput = document.getElementById("driverName");

  let driverName = driverNameInput ? driverNameInput.value.trim() : "";
  if (typeof capitalizeName === "function")
    driverName = capitalizeName(driverName);

  if (!userEmail) return alert("Log in first!");
  if (!currentSelection) return alert("Select a spot first!");
  if (!driverName) return alert("Please enter Driver Name!");

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
    // Send Booking to MySQL!
    const response = await fetch("https://parkease-backend-m234.onrender.com/api/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bookingData),
    });

    if (response.ok) {
      // Update local history bank
      let history = JSON.parse(localStorage.getItem("bookingHistory")) || [];
      history.push({
        slotId: currentSelection,
        userEmail: userEmail,
        date: now.toLocaleDateString(),
        checkIn: checkInTime,
        checkOut: checkOutTime,
        status: "Active",
        timestamp: now.getTime(),
      });
      localStorage.setItem("bookingHistory", JSON.stringify(history));

      currentSelection = null; // Clear selection
      if (driverNameInput) driverNameInput.value = driverName;

      alert("Booking Confirmed & Saved to Cloud!");
      render();
      updateTotal();
    } else {
      alert("Failed to book spot. It may have just been taken!");
      render();
    }
  } catch (err) {
    console.error("Booking error:", err);
  }
}

// --- UPDATED CANCEL LOGIC (Cancels in MySQL) ---
async function cancelBooking(id) {
  if (!window.confirm("Are you sure you want to cancel this booking?")) return;

  // FIX: Added the guest fallback here!
  const userEmail = localStorage.getItem("userEmail") || "guest@parkease.com";

  try {
    // 1. Release the spot in MySQL
    await fetch("https://parkease-backend-m234.onrender.com/api/user-cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: id }),
    });

    // 2. Update the Local History Bank
    let history = JSON.parse(localStorage.getItem("bookingHistory")) || [];
    for (let i = history.length - 1; i >= 0; i--) {
      if (
        history[i].slotId === id &&
        history[i].userEmail === userEmail &&
        history[i].status === "Active"
      ) {
        history[i].status = "Cancelled";
        break;
      }
    }
    localStorage.setItem("bookingHistory", JSON.stringify(history));

    render(); // Refresh the grid and tables
  } catch (err) {
    console.error("Cancel error:", err);
  }
}

// --- HISTORY LOGIC (Checks against Live DB Data) ---
async function updateHistory() {
  const userEmail = localStorage.getItem("userEmail") || "guest@parkease.com";

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
        // 1. Let your browser automatically format it to your local time!
        let d = new Date(h.booking_date);
        let formattedDate = d.toLocaleDateString(); 

        // 2. Set the color
        let statusColor = h.status === "Completed" ? "#34d399" : "#f87171";

        // 3. Draw the row
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

// --- TAB SWITCHER ---
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
  } else if (viewName === "reserve") {
    if (title) title.innerText = "Booking Portal";
    if (subtitle) subtitle.innerText = "Select your space and duration below.";
  } else if (viewName === "history") {
    if (title) title.innerText = "My Bookings";
    if (subtitle)
      subtitle.innerText = "View and manage your active reservations.";
  }

  if (viewName === "history") updateHistory();
  if (viewName === "profile") {
    document.getElementById("profName").value =
      localStorage.getItem("userName") || "";
    document.getElementById("profCar").value =
      localStorage.getItem("userCar") || "";
    document.getElementById("profPlate").value =
      localStorage.getItem("userPlate") || "";
  }
}

// --- CLOCK FUNCTION ---
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

// --- SAVE PROFILE ---
function saveProfile() {
  const name = document.getElementById("profName").value.trim();
  if (!name) return alert("Please enter your name!");

  localStorage.setItem("userName", name);
  localStorage.setItem("userCar", document.getElementById("profCar").value);
  localStorage.setItem("userPlate", document.getElementById("profPlate").value);

  const profileDisplay = document.getElementById("userProfileEmail");
  if (profileDisplay) profileDisplay.innerText = name;
  const driverInput = document.getElementById("driverName");
  if (driverInput) driverInput.value = name;

  alert("Profile saved successfully!");
  switchUserView("reserve");
}

// --- ON-LOAD LOGIC ---
window.onload = () => {
  render();
  startLiveClock();

  const savedName = localStorage.getItem("userName");
  const email = localStorage.getItem("userEmail");
  const emailDisplay = document.getElementById("userProfileEmail");

  if (savedName && emailDisplay) {
    emailDisplay.innerText = savedName;
  } else if (email && emailDisplay) {
    emailDisplay.innerText = email;
  }

  const driverInput = document.getElementById("driverName");
  if (driverInput && savedName) {
    driverInput.value = savedName;
  }

  if (!savedName) {
    switchUserView("profile");
  } else {
    switchUserView("reserve");
  }
};

// --- REAL-TIME SYNC MAGIC (Replaces localstorage event listener) ---
// Silently fetches the live database every 3 seconds!
// Silently fetches the live grid every 3 seconds!
setInterval(() => {
  render();

  // Only refresh history if the history panel is currently visible
  const historyView = document.getElementById("view-history");
  if (historyView && !historyView.classList.contains("hidden")) {
    updateHistory();
  }
}, 3000);
