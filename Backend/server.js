const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// 1. Database Connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root", // <--- PUT YOUR PASSWORD HERE
  database: "parkease_db",
});

db.connect((err) => {
  if (err) {
    console.error("❌ Error connecting to ParkEase MySQL Database:", err.message);
    return;
  }
  console.log("✅ Connected to ParkEase MySQL Database!");
});

// API ENDPOINTS (The "Drive-Thru Windows")
// API 1: Get all live parking slots
app.get("/api/slots", (req, res) => {
  db.query("SELECT * FROM parking_slots", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// API 2: Book a specific slot
app.post("/api/book", (req, res) => {
  const { id, userName, userEmail, checkIn, checkOut } = req.body;
  const now = new Date();
  const bookingDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0];

  // 1. Update the slot status
  const updateSlotQuery = `
        UPDATE parking_slots 
        SET status = 'booked', userName = ?, userEmail = ?, checkIn = ?, checkOut = ?
        WHERE id = ?
    `;

  // 2. Insert into history table
  const insertHistoryQuery = `
        INSERT INTO booking_history (slot_id, user_email, booking_date, check_in, check_out, status)
        VALUES (?, ?, ?, ?, ?, 'Active')
    `;

  db.beginTransaction((err) => {
    if (err) return res.status(500).json({ error: err.message });

    db.query(
      updateSlotQuery,
      [userName, userEmail, checkIn, checkOut, id],
      (err) => {
        if (err)
          return db.rollback(() =>
            res.status(500).json({ error: err.message }),
          );

        db.query(
          insertHistoryQuery,
          [id, userEmail, bookingDate, checkIn, checkOut],
          (err) => {
            if (err)
              return db.rollback(() =>
                res.status(500).json({ error: err.message }),
              );

            db.commit((err) => {
              if (err)
                return db.rollback(() =>
                  res.status(500).json({ error: err.message }),
                );
              res.json({ message: "Booking and History saved!" });
            });
          },
        );
      },
    );
  });
});

// API 3: ONE-TIME SETUP - Generates the 70 empty slots in the database!
app.get("/api/setup-grid", (req, res) => {
  let values = [];

  // Generate Zone A (P) and Zone B (S)
  ["P", "S"].forEach((side) => {
    for (let r = 1; r <= 7; r++) {
      for (let c = 1; c <= 5; c++) {
        // Creates ID like "P1-R1C1"
        const id = `${side}1-R${r}C${c}`;
        values.push([id, side, r, c, "available"]);
      }
    }
  });

  // Insert them all at once (IGNORE prevents duplicates if you run it twice)
  const sql =
    "INSERT IGNORE INTO parking_slots (id, side, row_num, col_num, status) VALUES ?";

  db.query(sql, [values], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({
      message: `Grid initialized! Added ${result.affectedRows} slots to the database.`,
    });
  });
});

// API 4: Admin releases a slot
app.post("/api/release", (req, res) => {
  const { id } = req.body;

  // 1. Clear the slot
  const clearSlot = `UPDATE parking_slots SET status = 'available', userName = NULL, userEmail = NULL, checkIn = NULL, checkOut = NULL WHERE id = ?`;

  // 2. Mark the most recent active booking for this slot as 'Completed'
  const updateHistory = `UPDATE booking_history SET status = 'Completed' WHERE slot_id = ? AND status = 'Active' ORDER BY history_id DESC LIMIT 1`;

  db.query(clearSlot, [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });

    db.query(updateHistory, [id], (err) => {
      if (err) console.log("History update failed, but slot was cleared.");
      res.json({ message: "Slot released and history updated!" });
    });
  });
});

// API 5: Admin updates slot statuses (Maintenance, Accessible, etc.)
app.post("/api/update-slots", (req, res) => {
  const { ids, status } = req.body;
  if (!ids || ids.length === 0)
    return res.json({ message: "No slots selected" });

  const query = `UPDATE parking_slots SET status = ? WHERE id IN (?)`;
  db.query(query, [status, ids], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Slots updated successfully!" });
  });
});

// API 6: Admin adds new slots to the grid
app.post("/api/add-slots", (req, res) => {
  const { newSlots } = req.body;
  if (!newSlots || newSlots.length === 0)
    return res.json({ message: "No slots to add" });

  // Format data for MySQL: [ [id, side, r, c, status], [id, side, r, c, status] ]
  const values = newSlots.map((s) => [s.id, s.side, s.r, s.c, s.status]);
  const query = `INSERT IGNORE INTO parking_slots (id, side, row_num, col_num, status) VALUES ?`;

  db.query(query, [values], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "New slots added!" });
  });
});

// API 7: Admin deletes slots from the grid
app.post("/api/delete-slots", (req, res) => {
  const { ids } = req.body;
  if (!ids || ids.length === 0)
    return res.json({ message: "No slots selected" });

  const query = `DELETE FROM parking_slots WHERE id IN (?)`;
  db.query(query, [ids], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Slots deleted!" });
  });
});

// API 8: User cancels their own booking in the Database
app.post("/api/user-cancel", (req, res) => {
  const { id } = req.body;
  // 1. Make the slot available again in the grid
  const clearSlot = `UPDATE parking_slots SET status = 'available', userName = NULL, userEmail = NULL, checkIn = NULL, checkOut = NULL WHERE id = ?`;
  // 2. Mark the history record as 'Cancelled' instead of 'Active'
  const updateHistory = `UPDATE booking_history SET status = 'Cancelled' WHERE slot_id = ? AND status = 'Active' ORDER BY history_id DESC LIMIT 1`;
  db.beginTransaction((err) => {
    if (err) return res.status(500).json({ error: err.message });
    db.query(clearSlot, [id], (err) => {
      if (err)
        return db.rollback(() => res.status(500).json({ error: err.message }));
      db.query(updateHistory, [id], (err) => {
        if (err)
          return db.rollback(() =>
            res.status(500).json({ error: err.message }),
          );
        db.commit((err) => {
          if (err)
            return db.rollback(() =>
              res.status(500).json({ error: err.message }),
            );
          res.json({
            message: "Database: Slot cleared and History marked as Cancelled!",
          });
        });
      });
    });
  });
});

// API 9: Fetch a specific user's history
app.get("/api/history/:email", (req, res) => {
  const email = req.params.email;
  const query = `SELECT * FROM booking_history WHERE user_email = ? ORDER BY history_id DESC`;

  db.query(query, [email], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// ==========================================
// USER AUTHENTICATION APIs
// ==========================================

// API 10: User Signup
app.post("/api/signup", (req, res) => {
  const { name, email, password, carModel, licensePlate } = req.body;

  const query = `INSERT INTO users (name, email, password, car_model, license_plate) VALUES (?, ?, ?, ?, ?)`;

  db.query(
    query,
    [name, email, password, carModel, licensePlate],
    (err, results) => {
      if (err) {
        // MySQL will throw this specific error if the email already exists!
        if (err.code === "ER_DUP_ENTRY") {
          return res
            .status(400)
            .json({ error: "This email is already registered." });
        }
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: "Signup successful!", userId: results.insertId });
    },
  );
});

// API 11: User Login
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  const query = `SELECT * FROM users WHERE email = ? AND password = ?`;

  db.query(query, [email, password], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    // If results.length is greater than 0, it means a matching user was found!
    if (results.length > 0) {
      const user = results[0];
      res.json({
        message: "Login successful!",
        user: {
          name: user.name,
          email: user.email,
          carCar: user.car_model,
          plate: user.license_plate,
        },
      });
    } else {
      // 401 is the official internet code for "Unauthorized"
      res.status(401).json({ error: "Invalid email or password." });
    }
  });
});

// API 12: Admin Audit Log (Fetches ALL history)
app.get('/api/admin/all-history', (req, res) => {
    // Fetch the 50 most recent actions so the admin can see cancellations
    const query = `SELECT * FROM booking_history ORDER BY history_id DESC LIMIT 50`;
    
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Start the Server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
