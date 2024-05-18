// app.js
const express = require("express");
const db = require("./db");

const app = express();
app.use(express.json());

//user routes
app.post("/users", (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: "Username is required." });
  }

  db.run("INSERT INTO users (username) VALUES (?)", [username], function (err) {
    if (err) {
      console.error("Error inserting user:", err.message);
      return res.status(500).json({ error: "Failed to create user." });
    }
    const userId = this.lastID;
    console.log(`User ${username} created with ID ${userId}.`);
    res.status(201).json({ userId, message: "User created successfully." });
  });
});

// Endpoint to create a channel
app.post("/channels", (req, res) => {
  const { name, ownerId } = req.body;

  // Check if the owner (user) exists
  db.get("SELECT id FROM users WHERE id = ?", [ownerId], (err, user) => {
    if (err) {
      console.error("Error checking user:", err.message);
      return res.status(500).send("Error checking user existence.");
    }
    if (!user) {
      return res.status(404).send("User not found.");
    }

    // Insert the channel into the database
    db.run(
      `
            INSERT INTO channels (name, owner_id) VALUES (?, ?)
            `,
      [name, ownerId],
      function (err) {
        if (err) {
          console.error("Error inserting channel:", err.message);
          return res.status(500).send("Error creating channel.");
        }
        const channelId = this.lastID;
        console.log(`Channel ${name} created with ID ${channelId}.`);
        res
          .status(201)
          .json({ channelId, message: "Channel created successfully." });
      }
    );
  });
});

app.post("/message", (req, res) => {
  const { message, userId, channelId } = req.body;

  // Check if the user exists
  db.get("SELECT id FROM users WHERE id = ?", [userId], (err, user) => {
    if (err) {
      console.error("Error checking user:", err.message);
      return res.status(500).send("Error checking user existence.");
    }
    if (!user) {
      return res.status(404).send("User not found.");
    }

    // Check if the channel exists
    db.get(
      "SELECT id, owner_id FROM channels WHERE id = ?",
      [channelId],
      (err, channel) => {
        if (err) {
          console.error("Error checking channel:", err.message);
          return res.status(500).send("Error checking channel existence.");
        }
        if (!channel) {
          return res.status(404).send("Channel not found.");
        }

        // Check if the user is either the owner of the channel or subscribed to it
        db.get(
          `
          SELECT 1 FROM channels
          WHERE id = ? AND owner_id = ?
          UNION
          SELECT 1 FROM subscriptions
          WHERE channel_id = ? AND user_id = ?
        `,
          [channelId, userId, channelId, userId],
          (err, result) => {
            if (err) {
              console.error("Error checking permissions:", err.message);
              return res.status(500).send("Error checking user permissions.");
            }
            if (!result) {
              return res
                .status(403)
                .send("User is not authorized to post in this channel.");
            }

            // Insert the message into the database
            db.run(
              `
              INSERT INTO messages (message_text, user_id, channel_id) VALUES (?, ?, ?)
            `,
              [message, userId, channelId],
              (err) => {
                if (err) {
                  console.error("Error inserting message:", err.message);
                  return res
                    .status(500)
                    .send("Error inserting message into the database.");
                } else {
                  console.log("Message inserted successfully.");
                  res.status(201).send("Message inserted successfully.");
                }
              }
            );
          }
        );
      }
    );
  });
});

app.get("/channels", (req, res) => {
  // Retrieve all channels from the database
  db.all("SELECT * FROM channels", (err, channels) => {
    if (err) {
      console.error("Error retrieving channels:", err.message);
      return res
        .status(500)
        .send("Error retrieving channels from the database.");
    }
    res.json(channels);
  });
});

// Prenumerera på en kanal
app.post("/channels/:id/subscribe", (req, res) => {
  const { id } = req.params; // Kanalens ID
  const { userID } = req.body; // Användarens ID
  const query = "INSERT INTO Subscriptions (UserID, ChannelID) VALUES (?, ?)";
  db.run(query, [userID, id], function (err) {
    if (err) {
      return res.status(500).send(err.message);
    }
    res.status(201).send({ subscriptionID: this.lastID }); // Returnerar ID för den nya prenumerationen
  });
});

// Avsluta prenumeration på en kanal
app.post("/channels/:id/unsubscribe", (req, res) => {
  const { id } = req.params; // Kanalens ID
  const { userID } = req.body; // Användarens ID
  const query = "DELETE FROM Subscriptions WHERE UserID = ? AND ChannelID = ?";
  db.run(query, [userID, id], function (err) {
    if (err) {
      return res.status(500).send(err.message);
    }
    res.status(204).send(); // Returnerar 204 No Content för att indikera att borttagningen lyckades
  });
});

module.exports = app;
