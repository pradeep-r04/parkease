require('dotenv').config();
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();

app.use(cors({
    origin: "*", 
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    ssl: {
        rejectUnauthorized: false
    }
});

db.connect((err) => {
  if (err) {
    console.error("❌ Error connecting to ParkEase MySQL Database:", err.message);
    return;
  }
  console.log("✅ Connected to ParkEase MySQL Database!");
});

app.get("/api/slots", (req, res) => {
  db.query("SELECT * FROM parking_slots", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post("/api/book", (req, res) => {
  const { id, userName, userEmail, checkIn, checkOut, payment_id, payment_status, amount } = req.body;
  const now = new Date();
  const bookingDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0];

  const updateSlotQuery = `
        UPDATE parking_slots 
        SET status = 'booked', userName = ?, userEmail = ?, checkIn = ?, checkOut = ?
        WHERE id = ?
    `;

  const insertHistoryQuery = `
        INSERT INTO booking_history (slot_id, user_email, booking_date, check_in, check_out, amount, payment_id, payment_status, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active')
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
          [id, userEmail, bookingDate, checkIn, checkOut, amount, payment_id, payment_status],
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

app.get("/api/setup-grid", (req, res) => {
  let values = [];

  ["P", "S"].forEach((side) => {
    for (let r = 1; r <= 7; r++) {
      for (let c = 1; c <= 5; c++) {
        const id = `${side}1-R${r}C${c}`;
        values.push([id, side, r, c, "available"]);
      }
    }
  });

  const sql =
    "INSERT IGNORE INTO parking_slots (id, side, row_num, col_num, status) VALUES ?";

  db.query(sql, [values], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({
      message: `Grid initialized! Added ${result.affectedRows} slots to the database.`,
    });
  });
});

app.post("/api/release", (req, res) => {
  const { id } = req.body;

  const clearSlot = `UPDATE parking_slots SET status = 'available', userName = NULL, userEmail = NULL, checkIn = NULL, checkOut = NULL WHERE id = ?`;

  const updateHistory = `UPDATE booking_history SET status = 'Completed' WHERE slot_id = ? AND status = 'Active' ORDER BY history_id DESC LIMIT 1`;

  db.query(clearSlot, [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });

    db.query(updateHistory, [id], (err) => {
      if (err) console.log("History update failed, but slot was cleared.");
      res.json({ message: "Slot released and history updated!" });
    });
  });
});

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

app.post("/api/add-slots", (req, res) => {
  const { newSlots } = req.body;
  if (!newSlots || newSlots.length === 0)
    return res.json({ message: "No slots to add" });

  const values = newSlots.map((s) => [s.id, s.side, s.r, s.c, s.status]);
  const query = `INSERT IGNORE INTO parking_slots (id, side, row_num, col_num, status) VALUES ?`;

  db.query(query, [values], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "New slots added!" });
  });
});

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

app.post("/api/user-cancel", (req, res) => {
  const { id } = req.body;
  const clearSlot = `UPDATE parking_slots SET status = 'available', userName = NULL, userEmail = NULL, checkIn = NULL, checkOut = NULL WHERE id = ?`;
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

app.get("/api/history/:email", (req, res) => {
  const email = req.params.email;
  const query = `SELECT * FROM booking_history WHERE user_email = ? ORDER BY history_id DESC`;

  db.query(query, [email], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post("/api/signup", (req, res) => {
  const { name, email, password, carModel, licensePlate } = req.body;

  const query = `INSERT INTO users (name, email, password, car_model, license_plate) VALUES (?, ?, ?, ?, ?)`;

  db.query(
    query,
    [name, email, password, carModel, licensePlate],
    (err, results) => {
      if (err) {
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

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  const query = `SELECT * FROM users WHERE email = ? AND password = ?`;

  db.query(query, [email, password], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

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
      res.status(401).json({ error: "Invalid email or password." });
    }
  });
});

app.get('/api/admin/all-history', (req, res) => {
    const query = `SELECT * FROM booking_history ORDER BY history_id DESC LIMIT 50`;
    
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/update-payment', (req, res) => {
  const { id, payment_id, penalty_amount, status } = req.body;
  
  const sql = `
    UPDATE booking_history 
    SET payment_status = ?, 
        payment_id = ?, 
        amount = amount + ? 
    WHERE slot_id = ? AND status = 'Active'
  `;
  
  db.query(sql, [status, payment_id, penalty_amount, id], (err, result) => {
    if (err) {
      console.error("Error updating payment:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.status(200).json({ message: "Payment status updated successfully" });
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server is live and listening on port ${PORT}`);
});