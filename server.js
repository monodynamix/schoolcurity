const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const db = new Database("schoolcurity.db");

app.use(express.json());
app.use(express.static("public"));

// Create visitor database
db.exec(`
    CREATE TABLE IF NOT EXISTS visitors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        time TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
`);

// Receive visitor records
app.post("/api/visitors", (req, res) => {
    const { id, name, status, time, created_at } = req.body;

    if (!id || !name || !["entering", "exiting"].includes(status) ||
        !time || !created_at) {
        return res.status(400).json({ error: "Invalid visitor record" });
    }

    try {
        db.prepare(`
            INSERT OR IGNORE INTO visitors
            (id, name, status, time, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(id, name, status, time, created_at);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Database error" });
    }
});


// Delete all visitor records from SQLite
app.delete("/api/visitors", (req, res) => {
    try {
        const result = db.prepare(
            "DELETE FROM visitors"
        ).run();

        res.json({
            success: true,
            deleted: result.changes
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Failed to delete visitor records"
        });
    }
});


// Retrieve visitor records
app.get("/api/visitors", (req, res) => {
    const visitors = db.prepare(
        "SELECT * FROM visitors ORDER BY created_at DESC"
    ).all();

    res.json(visitors);
});

app.delete("/api/visitors", (req, res) => {
    try {
        const result = db.prepare(
            "DELETE FROM visitors"
        ).run();

        console.log(`Deleted ${result.changes} visitor records.`);

        res.json({
            success: true,
            deleted: result.changes
        });

    } catch (error) {
        console.error("Deletion failed:", error);

        res.status(500).json({
            error: "Failed to delete visitor records."
        });
    }
});

app.listen(3000, () => {
    console.log("Schoolcurity running at http://localhost:3000");
});