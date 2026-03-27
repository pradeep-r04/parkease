// --- SECURITY & LOGOUT ---
if (localStorage.getItem("loggedInRole") !== "admin") {
  window.location.href = "index.html"; // Kick out non-admins
}

function adminLogout() {
  localStorage.removeItem("loggedInRole");
  window.location.href = "index.html";
}
// -------------------------

let slots = JSON.parse(localStorage.getItem("parkingData")) || [];

// This cleans up any leftover slots from when the grid was 7 columns wide.
const originalLength = slots.length;
slots = slots.filter((s) => s.c <= 5 && s.r <= 7);
if (slots.length !== originalLength) {
  localStorage.setItem("parkingData", JSON.stringify(slots));
}
// ------------------------

let selectedEmpty = [];
let selectedSlots = [];
let revenueChartInst = null;
let occupancyChartInst = null;

function switchView(viewName) {
  document
    .querySelectorAll(".nav-item")
    .forEach((el) => el.classList.remove("active"));
  document.getElementById("nav-" + viewName).classList.add("active");
  document.getElementById("pageTitle").innerText =
    viewName === "dashboard" ? "System Overview" : "Live Facility Control";
  document
    .getElementById("view-dashboard")
    .classList.toggle("hidden", viewName !== "dashboard");
  document
    .getElementById("view-control")
    .classList.toggle("hidden", viewName !== "control");
  if (viewName === "dashboard") updateDashboard();
}

function initCharts() {
  Chart.defaults.color = "#94a3b8";
  Chart.defaults.font.family = "'Inter', sans-serif";
  const ctxRev = document.getElementById("revenueChart").getContext("2d");
  revenueChartInst = new Chart(ctxRev, {
    type: "bar",
    data: {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"],
      datasets: [
        {
          label: "Revenue ($)",
          data: [450, 600, 550, 800, 750, 900, 0],
          backgroundColor: "#4f46e5",
          borderRadius: 6,
          barThickness: 30,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { grid: { color: "rgba(255,255,255,0.05)" }, beginAtZero: true },
        x: { grid: { display: false } },
      },
    },
  });

  const ctxOcc = document.getElementById("occupancyChart").getContext("2d");
  occupancyChartInst = new Chart(ctxOcc, {
    type: "doughnut",
    data: {
      // ADDED 4TH LABEL
      labels: ["Booked", "Available", "Maintenance", "Accessible"],
      datasets: [
        {
          data: [0, 0, 0, 0], // 4 data points
          // RED, GREEN, GRAY, BLUE
          backgroundColor: ["#ef4444", "#10b981", "#475569", "#3b82f6"],
          borderWidth: 0,
          cutout: "75%",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { padding: 20, usePointStyle: true, boxWidth: 8 },
        },
      },
    },
  });
}

function updateDashboard() {
  const booked = slots.filter((s) => s.status === "booked");
  const available = slots.filter((s) => s.status === "available");

  // SPLIT THEM INTO TWO SEPARATE VARIABLES
  const maintenance = slots.filter((s) => s.status === "not-available");
  const accessible = slots.filter((s) => s.status === "disabled-spot");

  const currentRevenue = booked.length * 50;

  // UPDATE ALL 6 KPI CARDS
  document.getElementById("kpi-total").innerText = slots.length;
  document.getElementById("kpi-active").innerText = booked.length;
  document.getElementById("kpi-available").innerText = available.length;
  document.getElementById("kpi-maintenance").innerText = maintenance.length;
  document.getElementById("kpi-accessible").innerText = accessible.length;
  document.getElementById("kpi-revenue").innerText = `₹${currentRevenue}`;

  // UPDATE CHART WITH ALL 4 CATEGORIES
  if (occupancyChartInst) {
    occupancyChartInst.data.datasets[0].data = [
      booked.length,
      available.length,
      maintenance.length,
      accessible.length,
    ];
    occupancyChartInst.update();
  }
  if (revenueChartInst) {
    revenueChartInst.data.datasets[0].data[6] = currentRevenue;
    revenueChartInst.update();
  }
}
function render() {
  ["P", "S"].forEach((side) => {
    const container = document.getElementById("grid" + side);
    if (!container) return;
    container.innerHTML = "";
    for (let r = 1; r <= 7; r++) {
      for (let c = 1; c <= 5; c++) {
        const cell = document.createElement("div");
        const s = slots.find((x) => x.side === side && x.r == r && x.c == c);
        if (s) {
          const isSelected = selectedSlots.includes(s.id);

          // Determine Status Class
          let statusClass = "";
          if (s.status === "available") statusClass = "admin-bg-available";
          else if (s.status === "booked") statusClass = "admin-bg-booked";
          else if (s.status === "disabled-spot")
            statusClass = "disabled-spot"; // NEW
          else if (s.status === "not-available") statusClass = "not-available";

          cell.className = `slot ${statusClass} ${isSelected ? "active-box" : ""}`;

          // Determine Icon
          if (s.status === "booked") {
            cell.innerHTML = `<i class="fas fa-car admin-car-icon"></i><span class="admin-slot-text">${s.id}</span>`;
          } else if (s.status === "disabled-spot") {
            cell.innerHTML = `<i class="fas fa-wheelchair admin-car-icon" style="font-size: 14px; margin-bottom: 4px;"></i><span class="admin-slot-text">${s.id}</span>`;
          } else {
            cell.innerHTML = `<span class="admin-slot-text">${s.id}</span>`;
          }

          cell.onclick = (e) => toggleSlot(e, s.id);
        } else {
          const key = `${side}-${r}-${c}`;
          const isSelected = selectedEmpty.some((e) => e.key === key);
          cell.className = `admin-cell ${isSelected ? "active-box" : ""}`;
          cell.onclick = (e) => toggleEmpty(e, side, r, c, key);
        }
        container.appendChild(cell);
      }
    }
  });

  const booked = slots.filter((s) => s.status === "booked");
  const table = document.getElementById("logTable");
  const empty = document.getElementById("emptyMsg");
  if (!table) return;
  document.getElementById("activeCount").innerText = `${booked.length} ACTIVE`;
  table.innerHTML = "";
  if (booked.length === 0) empty.classList.remove("hidden");
  else {
    empty.classList.add("hidden");
    booked.forEach((s) => {
      const row = document.createElement("tr");
      row.innerHTML = `
                <td>
                    <p class="td-slot-id">${s.id}</p>
                    <p class="td-driver"><i class="fas fa-user"></i> ${s.userName || "Walk-in"}</p>
                </td>
                <td>
                    <span class="td-time-in">IN: ${s.checkIn || "--:--"}</span>
                    <span class="td-time-out">OUT: ${s.checkOut || "--:--"}</span>
                </td>
                <td style="text-align: right;">
                    <button onclick="release('${s.id}')" class="btn-release">Release</button>
                </td>
            `;
      table.appendChild(row);
    });
  }
  localStorage.setItem("parkingData", JSON.stringify(slots));
  updateDashboard();
}

function toggleSlot(e, id) {
  e.stopPropagation();
  selectedEmpty = [];
  if (selectedSlots.includes(id))
    selectedSlots = selectedSlots.filter((sId) => sId !== id);
  else selectedSlots.push(id);
  updatePanel();
  render();
}

function toggleEmpty(e, side, r, c, key) {
  e.stopPropagation();
  selectedSlots = [];
  const exists = selectedEmpty.find((el) => el.key === key);
  if (exists) selectedEmpty = selectedEmpty.filter((el) => el.key !== key);
  else selectedEmpty.push({ side, r, c, key });
  updatePanel();
  render();
}

function updatePanel() {
  if (selectedEmpty.length === 0 && selectedSlots.length === 0) show("noSel");
  else if (selectedEmpty.length > 0) {
    document.getElementById("addBadge").innerText =
      `${selectedEmpty.length} Selected`;
    if (selectedEmpty.length === 1) {
      const e = selectedEmpty[0];
      document.getElementById("slotId").value =
        `${e.side}${e.side === "P" ? "1" : "2"}-R${e.r}C${e.c}`;
      document.getElementById("slotIdContainer").style.display = "block";
      document.getElementById("addBtnText").innerText = "Place 1 Slot";
    } else {
      document.getElementById("slotIdContainer").style.display = "none";
      document.getElementById("addBtnText").innerText =
        `Auto-Place ${selectedEmpty.length} Slots`;
    }
    show("add");
  } else if (selectedSlots.length > 0) {
    document.getElementById("editBadge").innerText =
      `${selectedSlots.length} Selected`;
    if (selectedSlots.length === 1) {
      document.getElementById("editTitle").innerText = selectedSlots[0];
      const s = slots.find((x) => x.id === selectedSlots[0]);
      document.getElementById("statusSelect").value = s.status;
    } else {
      document.getElementById("editTitle").innerText =
        `${selectedSlots.length} Slots`;
      document.getElementById("statusSelect").value = "available";
    }
    show("edit");
  }
}

function show(mode) {
  document.getElementById("noSel").classList.add("hidden");
  document.getElementById("addForm").classList.toggle("hidden", mode !== "add");
  document
    .getElementById("editForm")
    .classList.toggle("hidden", mode !== "edit");
}

function saveNew() {
  if (selectedEmpty.length === 1) {
    const id = document.getElementById("slotId").value.trim().toUpperCase();
    if (!id || slots.some((s) => s.id === id)) return;
    slots.push({
      side: selectedEmpty[0].side,
      r: selectedEmpty[0].r,
      c: selectedEmpty[0].c,
      id,
      status: "available",
    });
  } else {
    selectedEmpty.forEach((e) => {
      const autoId = `${e.side}${e.side === "P" ? "1" : "2"}-R${e.r}C${e.c}`;
      if (!slots.some((s) => s.id === autoId))
        slots.push({
          side: e.side,
          r: e.r,
          c: e.c,
          id: autoId,
          status: "available",
        });
    });
  }
  selectedEmpty = [];
  updatePanel();
  render();
}

function update() {
  const newStatus = document.getElementById("statusSelect").value;
  slots = slots.map((s) =>
    selectedSlots.includes(s.id) ? { ...s, status: newStatus } : s,
  );
  selectedSlots = [];
  updatePanel();
  render();
}

function remove() {
  slots = slots.filter((s) => !selectedSlots.includes(s.id));
  selectedSlots = [];
  updatePanel();
  render();
}

function release(id) {
  slots = slots.map((s) =>
    s.id === id
      ? {
          ...s,
          status: "available",
          checkIn: null,
          checkOut: null,
          userName: null,
        }
      : s,
  );
  render();
}

setInterval(() => {
  const clock = document.getElementById("liveClock");
  if (clock) clock.innerText = new Date().toLocaleTimeString("en-GB");
}, 1000);

window.addEventListener("storage", () => {
  slots = JSON.parse(localStorage.getItem("parkingData")) || [];
  render();
});

initCharts();
render();

// --- PDF REPORT GENERATION ---
// --- PDF REPORT GENERATION ---
function generatePDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const now = new Date().toLocaleString();

  // 1. Calculate Live Stats (FIXED MATH: Now multiplying by 50)
  const booked = slots.filter((s) => s.status === "booked");
  const available = slots.filter((s) => s.status === "available");
  const disabled = slots.filter(
    (s) => s.status === "not-available" || s.status === "disabled-spot",
  );
  const revenue = booked.length * 50; 

  // 2. Title and Header
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42);
  doc.text("ParkEase Enterprise Report", 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated on: ${now}`, 14, 28);
  doc.text("Status: Confidential - System Administrator Access Only", 14, 33);

  // 3. EXECUTIVE SUMMARY SECTION
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.setFont(undefined, "bold");
  doc.text("Executive Summary", 14, 45);

  doc.setFontSize(11);
  doc.setFont(undefined, "normal");
  doc.text(`Total Capacity: ${slots.length}`, 14, 53);
  doc.text(`Active Bookings: ${booked.length}`, 14, 59);
  doc.text(`Available Spots: ${available.length}`, 80, 53);
  doc.text(`Disabled/Maintenance Spots: ${disabled.length}`, 80, 59);

  // Highlight Revenue (FIXED SYMBOL: Using Rs. so jsPDF can read it)
  doc.setFont(undefined, "bold");
  doc.setTextColor(16, 185, 129);
  doc.text(`Total Estimated Revenue: Rs. ${revenue}`, 14, 68);
  doc.setTextColor(0);

  // 4. Filter data for the table
  const reportData = slots
    .filter((s) => s.status !== "available")
    .map((s) => [
      s.id,
      s.userName || "N/A",
      s.status.toUpperCase(),
      s.checkIn || "-",
      s.checkOut || "-",
    ]);

  // 5. Generate Table
  doc.autoTable({
    startY: 75,
    head: [["Slot ID", "Driver Name", "Status", "Check-In", "Check-Out"]],
    body: reportData,
    theme: "grid",
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    styles: { fontSize: 9 },
  });

  // 6. Save File
  doc.save(`ParkEase_Enterprise_Report_${new Date().getTime()}.pdf`);
}
