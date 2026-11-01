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

    // 1. Check if the user is verified for accessible parking
    const needsAccessible = localStorage.getItem("needsAccessible") === "true";

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
            
            // 2. Define if this specific spot can be booked by this user
            const canBook = slot.status === "available" || (slot.status === "disabled-spot" && needsAccessible);

            // 3. Allow it to highlight green ("selected") if it is a valid choice
            if (slot.id === currentSelection && canBook) {
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

            // 4. Apply the click lock based on the new logic
            if (canBook || displayStatus === "selected") {
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
// BOOKING & HISTORY LOGIC (Updated with Razorpay)
// ==========================================
async function confirmBooking() {
  const isLoggedIn = localStorage.getItem("loggedInRole") === "user";
  if (!currentSelection) return alert("Select a spot first!");

  if (!isLoggedIn) {
    sessionStorage.setItem("pendingSlot", currentSelection);
    window.location.href = "login.html";
    return;
  }

  const userEmail = localStorage.getItem("userEmail");
  let driverName = localStorage.getItem("userName");
  
  if (!driverName) {
      driverName = userEmail ? userEmail.split('@')[0] : "User";
  }

  const now = new Date();
  const checkout = new Date(now.getTime() + selectedHours * 60 * 60 * 1000);
  const checkInTime = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const checkOutTime = checkout.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  
  const calculatedPrice = selectedHours * 50;

  const bookingData = {
    id: currentSelection,
    userName: driverName,
    userEmail: userEmail,
    checkIn: checkInTime,
    checkOut: checkOutTime,
    amount: calculatedPrice
  };

  var options = {
    key: "rzp_test_Ttlf1WLNbYHACW", 
    amount: calculatedPrice * 100, 
    currency: "INR",
    name: "ParkEase",
    description: `Booking for ${currentSelection}`,
    handler: async function (response) {
      bookingData.payment_id = response.razorpay_payment_id;
      bookingData.payment_status = "PAID";

      try {
        const res = await fetch("https://parkease-backend-m234.onrender.com/api/book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bookingData),
        });

        if (res.ok) {
          currentSelection = null;
          alert("Payment Successful & Booking Confirmed!");
          render();
          updateTotal();
          switchUserView("history");
        } else {
          alert("Database save failed, please contact support.");
        }
      } catch (err) {
        console.error("Booking error:", err);
      }
    },
    prefill: {
      name: driverName,
      email: userEmail
    },
    theme: {
      color: "#4f46e5"
    }
  };
  
  var rzp1 = new Razorpay(options);
  rzp1.open();
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
  if (!isLoggedIn) return; 

  const userEmail = localStorage.getItem("userEmail");

  try {
    const response = await fetch(`https://parkease-backend-m234.onrender.com/api/history/${userEmail}`);
    const dbHistory = await response.json();

    const activeTable = document.getElementById("historyTable");
    const pastTable = document.getElementById("pastHistoryTable");

    if (!activeTable || !pastTable) return;

    activeTable.innerHTML = "";
    pastTable.innerHTML = "";

    if (dbHistory.length === 0) {
      activeTable.innerHTML = '<tr><td colspan="6" class="table-empty">No bookings found</td></tr>';
      return;
    }

    dbHistory.forEach((h) => {
      let payColor = h.payment_status === 'PAID' ? '#10b981' : '#f59e0b';
      
      if (h.status === "Active") {
        const now = new Date();
        const [inHour, inMin] = h.check_in.split(':').map(Number);
        const [outHour, outMin] = h.check_out.split(':').map(Number);
        
        const expectedOut = new Date();
        expectedOut.setHours(outHour, outMin, 0, 0);

        if (outHour < inHour) {
          expectedOut.setDate(expectedOut.getDate() + 1);
        }

        let penaltyWarning = "";
        if (now > expectedOut) {
          const diffMins = Math.floor((now - expectedOut) / 60000);
          // NEW FLAT-RATE HOURLY LOGIC
          const penaltyHours = Math.ceil(diffMins / 60); 
          const penaltyAmount = penaltyHours * 50;
          
          if (penaltyAmount > 0) {
            penaltyWarning = `
              <div style="color: #ef4444; font-size: 11px; margin-top: 5px; font-weight: bold; display: flex; align-items: center; justify-content: flex-start; gap: 8px;">
                <span><i class="fas fa-exclamation-triangle"></i> Late Penalty: ₹${penaltyAmount}</span>
                <button onclick="payPenalty('${h.slot_id}', ${penaltyAmount})" style="background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 9px; font-weight: bold;">Pay Online</button>
              </div>`;
          }
        }

        activeTable.innerHTML += `
          <tr>
            <td>
              <strong>${h.slot_id}</strong>
              ${penaltyWarning}
            </td>
            <td><span class="td-time-in">${h.check_in}</span></td>
            <td><span class="td-time-out">${h.check_out}</span></td>
            <td style="font-weight: bold;">₹${h.amount || '0'}</td>
            <td style="color: ${payColor}; font-weight: bold; font-size: 11px;">${h.payment_status || 'PENDING'}</td>
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
            <td style="font-weight: bold;">₹${h.amount || '0'}</td>
            <td style="color: ${payColor}; font-weight: bold; font-size: 11px;">${h.payment_status || 'PENDING'}</td>
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

function payPenalty(slotId, amount) {
  const userEmail = localStorage.getItem("userEmail");
  const driverName = localStorage.getItem("userName") || "User";

  var options = {
    key: "rzp_test_Ttlf1WLNbYHACW",
    amount: amount * 100, 
    currency: "INR",
    name: "ParkEase Penalty",
    description: `Overtime Penalty for ${slotId}`,
    handler: async function (response) {
      try {
        const res = await fetch("https://parkease-backend-m234.onrender.com/api/update-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            id: slotId, 
            payment_id: response.razorpay_payment_id,
            penalty_amount: amount,
            status: "PENALTY PAID"
          }),
        });

        if (res.ok) {
          alert(`Penalty of ₹${amount} Paid Successfully!`);
          updateHistory(); 
        } else {
          alert("Payment succeeded, but database update failed.");
        }
      } catch (err) {
        console.error("Backend error:", err);
      }
    },
    prefill: { name: driverName, email: userEmail },
    theme: { color: "#ef4444" }
  };
  
  var rzp1 = new Razorpay(options);
  rzp1.open();
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
    document.getElementById("profHandicap").checked = 
      localStorage.getItem("needsAccessible") === "true";
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
  localStorage.setItem("needsAccessible", document.getElementById("profHandicap").checked);
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