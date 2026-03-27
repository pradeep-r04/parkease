let selectedHours = 1;
const get = () => JSON.parse(localStorage.getItem("parkingData")) || [];

function setDuration(h) {
  selectedHours = h;
  document
    .querySelectorAll(".duration-btn")
    .forEach((b) => b.classList.remove("active"));
  document.getElementById("d" + h).classList.add("active");
  updateTotal();
}

function render() {
  const data = get();
  ["P", "S"].forEach((side) => {
    const el = document.getElementById("u_grid" + side);
    if (!el) return;
    el.innerHTML = "";

    for (let r = 1; r <= 7; r++) {
      for (let c = 1; c <= 5; c++) {
        const slot = data.find((s) => s.side === side && s.r == r && s.c == c);

        if (slot) {
          const cell = document.createElement("div");
          cell.id = `slot-id-${slot.id}`;
          cell.className = `slot ${slot.status}`;

          if (slot.status === "booked") {
            cell.innerHTML = `<i class="fas fa-car car-icon"></i>`;
          } else if (slot.status === "disabled-spot") {
            cell.innerHTML = `<i class="fas fa-wheelchair" style="font-size:18px; margin-bottom:4px;"></i><span style="font-size:9px;">${slot.id}</span>`;
          } else if (slot.status === "not-available") {
            cell.innerHTML = `<i class="fas fa-ban" style="font-size:18px; margin-bottom:4px;"></i><span style="font-size:9px;">${slot.id}</span>`;
          } else {
            cell.innerHTML = `<span class="slot-empty-text">${slot.id}</span>`;
          }

          if (slot.status === "available" || slot.status === "selected") {
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
}

function toggleSelect(id) {
  let data = get();
  const slot = data.find((s) => s.id === id);
  if (!slot) return;

  if (slot.status !== "available" && slot.status !== "selected") return;

  const newStatus = slot.status === "selected" ? "available" : "selected";
  slot.status = newStatus;
  localStorage.setItem("parkingData", JSON.stringify(data));

  const cell = document.getElementById(`slot-id-${id}`);
  if (cell) {
    cell.className = `slot ${newStatus}`;
    cell.innerHTML = `<span class="slot-empty-text">${id}</span>`;
  }

  updateTotal();
}

function updateTotal() {
  const data = get();
  const selCount = data.filter((s) => s.status === "selected").length;
  const totalDisplay = document.getElementById("total");
  if (totalDisplay) {
    totalDisplay.innerText = `₹${selCount * 50 * selectedHours}`;
  }
}

// --- UPDATED CONFIRM LOGIC (Saves to History Memory) ---
function confirmBooking() {
    const userEmail = localStorage.getItem('userEmail');
    const driverNameInput = document.getElementById('driverName');
    
    let driverName = driverNameInput ? driverNameInput.value.trim() : "";
    if(typeof capitalizeName === "function") driverName = capitalizeName(driverName); 
    
    let data = get();
    const selected = data.filter(s => s.status === 'selected');

    if (!userEmail) return alert("Log in first!");
    if (!selected.length) return alert("Select a spot first!");
    if (!driverName) return alert("Please enter Driver Name!");

    const now = new Date();
    const checkout = new Date(now.getTime() + selectedHours * 60 * 60 * 1000);
    
    // Grab the history memory bank
    let history = JSON.parse(localStorage.getItem('bookingHistory')) || [];

    data.forEach(s => {
        if (s.status === 'selected') {
            s.status = 'booked';
            s.userName = driverName;
            s.userEmail = userEmail;
            s.checkIn = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            s.checkOut = checkout.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            
            // NEW: Push to history bank
            history.push({
                slotId: s.id,
                userEmail: userEmail,
                date: now.toLocaleDateString(),
                checkIn: s.checkIn,
                checkOut: s.checkOut,
                status: 'Active',
                timestamp: now.getTime()
            });
        }
    });

    localStorage.setItem('parkingData', JSON.stringify(data));
    localStorage.setItem('bookingHistory', JSON.stringify(history)); // Save memory
    
    if(driverNameInput) driverNameInput.value = driverName;
    
    render(); 
    updateHistory(); 
    updateTotal();
    alert("Booking Confirmed!");
}

// --- UPDATED HISTORY LOGIC (Separates Active and Past) ---
function updateHistory() {
    const userEmail = localStorage.getItem('userEmail');
    const data = get(); 
    let history = JSON.parse(localStorage.getItem('bookingHistory')) || [];
    let historyChanged = false;

    // 1. Check if Admin released a spot manually
    history.forEach(h => {
        if (h.userEmail === userEmail && h.status === 'Active') {
            const stillActive = data.find(s => s.id === h.slotId && s.status === 'booked' && s.userEmail === userEmail);
            if (!stillActive) {
                h.status = 'Completed'; 
                historyChanged = true;
            }
        }
    });

    if (historyChanged) {
        localStorage.setItem('bookingHistory', JSON.stringify(history));
    }

    // 2. CLEAR AND REBUILD ACTIVE TABLE
    const activeTable = document.getElementById('historyTable');
    if (activeTable) {
        activeTable.innerHTML = ""; // This clears the "stuck" rows
        const myActive = history.filter(h => h.userEmail === userEmail && h.status === 'Active');
        
        if (myActive.length === 0) {
            activeTable.innerHTML = '<tr><td colspan="4" class="table-empty">No active bookings</td></tr>';
        } else {
            myActive.sort((a,b) => b.timestamp - a.timestamp).forEach(h => {
                activeTable.innerHTML += `
                    <tr>
                        <td><strong>${h.slotId}</strong></td>
                        <td><span class="td-time-in">${h.checkIn}</span></td>
                        <td><span class="td-time-out">${h.checkOut}</span></td>
                        <td style="text-align: right;">
                            <button onclick="cancelBooking('${h.slotId}')" class="btn-trash">Cancel</button>
                        </td>
                    </tr>`;
            });
        }
    }

    // 3. CLEAR AND REBUILD PAST TABLE
    const pastTable = document.getElementById('pastHistoryTable');
    if (pastTable) {
        pastTable.innerHTML = ""; // This clears the "stuck" rows
        const myPast = history.filter(h => h.userEmail === userEmail && h.status !== 'Active');
        
        if (myPast.length === 0) {
            pastTable.innerHTML = '<tr><td colspan="5" class="table-empty">No past records</td></tr>';
        } else {
            myPast.sort((a,b) => b.timestamp - a.timestamp).forEach(h => {
                let statusColor = h.status === 'Completed' ? '#34d399' : '#f87171';
                pastTable.innerHTML += `
                    <tr>
                        <td><strong>${h.slotId}</strong></td>
                        <td style="color: #94a3b8; font-size: 11px;">${h.date}</td>
                        <td><span class="td-time-in">${h.checkIn}</span></td>
                        <td><span class="td-time-out">${h.checkOut}</span></td>
                        <td style="text-align: right; color: ${statusColor}; font-weight: 700; font-size: 11px;">
                            ${h.status}
                        </td>
                    </tr>`;
            });
        }
    }
}

// --- UPDATED CANCEL LOGIC (Marks as Cancelled in Memory) ---
function cancelBooking(id) {
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;
    
    const userEmail = localStorage.getItem('userEmail');
    let data = get(); // Get live parking data
    let history = JSON.parse(localStorage.getItem('bookingHistory')) || [];

    // 1. CLEAR FROM LIVE GRID (The visual slots)
    // We look for the slot by ID, but also by parsing the ID if needed
    let slot = data.find(s => s.id === id);
    
    // If not found by ID, try a manual deep search (Safety Net)
    if (!slot && id.includes('-')) {
        const parts = id.split('-'); // e.g., "P1-R2C3"
        const side = parts[0].charAt(0); // "P"
        const coords = parts[1].match(/\d+/g); // [2, 3]
        if (coords) {
            slot = data.find(s => s.side === side && s.r == coords[0] && s.c == coords[1]);
        }
    }

    if (slot) {
        slot.status = 'available';
        slot.userEmail = null;
        slot.userName = null;
        slot.checkIn = null;
        slot.checkOut = null;
        console.log("Slot " + id + " has been cleared from grid.");
    } else {
        console.error("Could not find slot in data: " + id);
    }

    // 2. UPDATE THE HISTORY BANK
    let foundInHistory = false;
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].slotId === id && history[i].userEmail === userEmail && history[i].status === 'Active') {
            history[i].status = 'Cancelled';
            foundInHistory = true;
            break;
        }
    }

    // If it wasn't in history (old data), add a new cancelled entry
    if (!foundInHistory) {
        history.push({
            slotId: id,
            userEmail: userEmail,
            date: new Date().toLocaleDateString(),
            status: 'Cancelled',
            timestamp: new Date().getTime()
        });
    }

    // 3. SAVE EVERYTHING
    localStorage.setItem('parkingData', JSON.stringify(data));
    localStorage.setItem('bookingHistory', JSON.stringify(history));

    // 4. REFRESH THE UI
    render();        // This clears the car from the grid
    updateHistory(); // This updates the tables
}

// --- UPDATED TAB SWITCHER ---
function switchUserView(viewName) {
  // 1. Remove active class from all nav items
  document
    .querySelectorAll(".nav-item")
    .forEach((el) => el.classList.remove("active"));

  // 2. Add active class to clicked nav item
  const activeNav = document.getElementById("nav-" + viewName);
  if (activeNav) activeNav.classList.add("active");

  // 3. Hide all view panels
  document
    .querySelectorAll(".view-panel")
    .forEach((panel) => panel.classList.add("hidden"));

  // 4. Show the selected view panel
  const activeView = document.getElementById("view-" + viewName);
  if (activeView) activeView.classList.remove("hidden");

  // --- NEW: DYNAMIC HEADER TEXT ---
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
  // --------------------------------

  // 5. Run specific tab logic
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

// --- UPDATED SAVE PROFILE ---
function saveProfile() {
  const name = document.getElementById("profName").value.trim();
  if (!name) return alert("Please enter your name!");

  localStorage.setItem("userName", name);
  localStorage.setItem("userCar", document.getElementById("profCar").value);
  localStorage.setItem("userPlate", document.getElementById("profPlate").value);

  // Update sidebar immediately
  const profileDisplay = document.getElementById("userProfileEmail");
  if (profileDisplay) profileDisplay.innerText = name;

  // Auto-fill the driver name input
  const driverInput = document.getElementById("driverName");
  if (driverInput) driverInput.value = name;

  alert("Profile saved successfully!");

  // Switch to the Reserve tab automatically after saving
  switchUserView("reserve");
}

// --- UPDATED ON-LOAD (First Preference Logic) ---
window.onload = () => {
  render();
  updateHistory();
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

  // "FIRST PREFERENCE" LOGIC:
  // If they haven't saved a name yet, force them to the Profile Tab first.
  // If they have, take them to the Reserve Tab.
  if (!savedName) {
    switchUserView("profile");
  } else {
    switchUserView("reserve");
  }
};

// --- REAL-TIME SYNC MAGIC ---
window.addEventListener("storage", (e) => {
  if (e.key === "parkingData") {
    render();
    updateHistory();
    updateTotal();
  }
});
