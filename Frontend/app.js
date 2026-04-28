document.addEventListener("DOMContentLoaded", () => {
  const startDateInput = document.getElementById("startDate");
  const endDateInput = document.getElementById("endDate");

  // --- 1. GET EXACT LOCAL DATES ---
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const today = `${year}-${month}-${day}`;

  // Calculate tomorrow locally
  const tmrw = new Date();
  tmrw.setDate(tmrw.getDate() + 1);
  const tmrwYear = tmrw.getFullYear();
  const tmrwMonth = String(tmrw.getMonth() + 1).padStart(2, "0");
  const tmrwDay = String(tmrw.getDate()).padStart(2, "0");
  const tomorrowStr = `${tmrwYear}-${tmrwMonth}-${tmrwDay}`;

  // --- 2. APPLY DATES & LOCKOUTS ---
  startDateInput.value = today;
  endDateInput.value = tomorrowStr;
  startDateInput.min = today;
  endDateInput.min = today;

  // Make sure End Date can't be before Start Date
  startDateInput.addEventListener("change", function () {
    endDateInput.min = this.value;
    if (endDateInput.value < this.value) {
      endDateInput.value = this.value;
    }
  });

  // --- 3. HANDLE SEARCH SUBMISSION ---
  const searchForm = document.getElementById("searchForm");
  if (searchForm) {
    searchForm.addEventListener("submit", function (e) {
      e.preventDefault();

      const location = document.getElementById("locationInput").value;
      const startDate = document.getElementById("startDate").value;
      const endDate = document.getElementById("endDate").value;

      sessionStorage.setItem("searchLocation", location);
      sessionStorage.setItem("searchStart", startDate);
      sessionStorage.setItem("searchEnd", endDate);

      window.location.href = `booking-grid.html?loc=${encodeURIComponent(location)}`;
    });
  }
});

/* Function for the Popular Locations quick-click cards
function quickSearch(city) {
    sessionStorage.setItem('searchLocation', city);
    window.location.href = `select-spot.html?loc=${encodeURIComponent(city)}`;
}
*/
