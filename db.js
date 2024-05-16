// db.js
const sqlite3 = require("sqlite3").verbose();

// Connect to the SQLite database
const db = new sqlite3.Database("mydatabase.db", (err) => {
  if (err) {
    console.error("Error connecting to database:", err.message);
  } else {
    console.log("Connected to the SQLite database.");
  }
});

// Create users table
db.run(
  `
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT
    )
`,
  (err) => {
    if (err) {
      console.error("Error creating users table:", err.message);
    } else {
      console.log("Users table created successfully.");
    }
  }
);

// Create channels table
db.run(
  `
    CREATE TABLE IF NOT EXISTS channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        owner_id INTEGER
    )
`,

  (err) => {
    if (err) {
      console.error("Error creating channels table:", err.message);
    } else {
      console.log("Channels table created successfully.");
    }
  }
);

// Create messages table
db.run(
  `
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_text TEXT,
        user_id INTEGER,
        channel_id INTEGER
    )
`,
  (err) => {
    if (err) {
      console.error("Error creating messages table:", err.message);
    } else {
      console.log("Messages table created successfully.");
    }
  }
);

// Create subscriptions table
db.run(
  `
    CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        channel_id INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (channel_id) REFERENCES channels(id)
    )
`,
  (err) => {
    if (err) {
      console.error("Error creating subscriptions table:", err.message);
    } else {
      console.log("Subscriptions table created successfully.");
    }
  }
);

module.exports = db;
