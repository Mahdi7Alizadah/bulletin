const express = require("express");
const db = require("./db");

const app = express();
app.use(express.json());

// User routes
app.post("/users", (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: "Username is required." });
  }

  // Check if the username already exists
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
    if (err) {
      console.error("Error checking for existing user:", err.message);
      return res
        .status(500)
        .json({ error: "Failed to check for existing user." });
    }
    if (row) {
      // Username already exists
      return res.status(409).json({ error: "Username already exists." });
    }

    // Username does not exist, proceed to insert the new user
    db.run(
      "INSERT INTO users (username) VALUES (?)",
      [username],
      function (err) {
        if (err) {
          console.error("Error inserting user:", err.message);
          return res.status(500).json({ error: "Failed to create user." });
        }
        const userId = this.lastID;
        console.log(`User ${username} created with ID ${userId}.`);
        res.status(201).json({ userId, message: "User created successfully." });
      }
    );
  });
});

// Endpoint to create a channel
app.post("/channels", (req, res) => {
  const { name, ownerId } = req.body;

  if (!name || !ownerId) {
    return res.status(400).send("Channel name and owner ID are required.");
  }

  // Check if the owner (user) exists
  db.get("SELECT id FROM users WHERE id = ?", [ownerId], (err, user) => {
    if (err) {
      console.error("Error checking user:", err.message);
      return res.status(500).send("Error checking user existence.");
    }
    if (!user) {
      return res.status(404).send("User not found.");
    }

    // Check if a channel with the same name already exists
    db.get("SELECT id FROM channels WHERE name = ?", [name], (err, channel) => {
      if (err) {
        console.error("Error checking channel name:", err.message);
        return res.status(500).send("Error checking channel name.");
      }
      if (channel) {
        return res.status(409).send("Channel name already exists.");
      }

      // Insert the channel into the database
      db.run(
        "INSERT INTO channels (name, owner_id) VALUES (?, ?)",
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
});

// Post a message
app.post("/message", (req, res) => {
  const { message, userId, channelId } = req.body;
  const timestamp = new Date().toISOString(); // Add timestamp

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

            // Insert the message into the database with timestamp
            db.run(
              `
              INSERT INTO messages (message_text, user_id, channel_id, timestamp) VALUES (?, ?, ?, ?)
            `,
              [message, userId, channelId, timestamp],
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

// Subscribe to a channel
app.post("/channels/subscribe", (req, res) => {
  const { channelId, userId } = req.body; // Retrieve channelId and userId from the body

  if (!channelId || !userId) {
    return res.status(400).send("Channel ID and User ID are required.");
  }

  // Check if the user is already subscribed to the channel
  db.get(
    "SELECT * FROM subscriptions WHERE user_id = ? AND channel_id = ?",
    [userId, channelId],
    (err, row) => {
      if (err) {
        console.error("Error checking subscription:", err.message);
        return res.status(500).send("Error checking subscription.");
      }
      if (row) {
        // User is already subscribed to the channel
        return res
          .status(409)
          .send("User is already subscribed to this channel.");
      }

      // Insert the subscription into the database
      db.run(
        "INSERT INTO subscriptions (user_id, channel_id) VALUES (?, ?)",
        [userId, channelId],
        function (err) {
          if (err) {
            console.error("Error inserting subscription:", err.message);
            return res.status(500).send("Error creating subscription.");
          }
          res.status(201).send({ subscriptionID: this.lastID }); // Return the ID of the new subscription
        }
      );
    }
  );
});

// Unsubscribe from a channel
app.delete("/channels/unsubscribe", (req, res) => {
  const { channelId, userId } = req.body; // Retrieve channelId and userId from the body

  if (!channelId || !userId) {
    return res.status(400).send("Channel ID and User ID are required.");
  }

  db.run(
    "DELETE FROM subscriptions WHERE user_id = ? AND channel_id = ?",
    [userId, channelId],
    function (err) {
      if (err) {
        return res.status(500).send(err.message);
      }
      if (this.changes === 0) {
        // No subscription found to delete
        return res.status(404).send("Subscription does not exist.");
      }
      res.status(200).send({ message: "Unsubscribed successfully." }); // Return success message
    }
  );
});

// Endpoint to retrieve all messages in a specific channel
app.get("/channels/messages", (req, res) => {
  const { channelId } = req.body;

  if (!channelId) {
    return res.status(400).send("Channel ID is required.");
  }

  // Retrieve all messages for the specified channel
  db.all(
    "SELECT * FROM messages WHERE channel_id = ?",
    [channelId],
    (err, messages) => {
      if (err) {
        console.error("Error retrieving messages:", err.message);
        return res
          .status(500)
          .send("Error retrieving messages from the database.");
      }
      res.json(messages);
    }
  );
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

// Retrieve all users
app.get("/users", (req, res) => {
  const query = "SELECT * FROM users";
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Error retrieving users:", err.message);
      return res.status(500).send("Error retrieving users.");
    }
    res.status(200).json(rows); // Return the list of users
  });
});

module.exports = app;
