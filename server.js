const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');
const path = require('path');
const fs = require('fs');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
// Add connection string to env variable
const { MONGODB_URI, CONFIG_FILE_CONTENTS } = process.env;

// Create a temporary file path
const tempFilePath = path.join(__dirname, 'temp_config_file.pem');

// Write the contents to the temporary file
fs.writeFileSync(tempFilePath, CONFIG_FILE_CONTENTS);

// Connect to MongoDB using the temporary file path
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  tlsCertificateKeyFile: tempFilePath,
  useUnifiedTopology: true,
});

// Import Mongoose models
const User = require('./db_modules/userModule.js');
const Connection = require('./db_modules/connectionModule.js');
const Chat = require('./db_modules/chatModule.js');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

io.on('connection', (socket) => {
  console.log('User connected');

  socket.on('newMessage', async (data) => {
    const { sender, receiver, message } = data;
    const chat = new Chat({ sender, receiver, message });

    try {
      await chat.save();
      io.emit('newMessage', { sender, receiver, message });
    } catch (error) {
      console.error('Error saving chat message:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

async function startServer() {
  try {
    console.log('Connected to MongoDB Atlas');

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Error connecting to MongoDB Atlas:', error);
  }
}

startServer();

app.post("/saveUser", async (req, res) => {
  const userObject = req.body;

  try {
    const user = new User({
      ...userObject,
      userType: userObject.userType || 'user',
    });

    await user.save();

    console.log('User saved to MongoDB with ID:', user._id);
    res.status(200).json({ message: 'User saved successfully' });
  } catch (error) {
    console.error('Error saving user to MongoDB:', error);
    res.status(500).json({ error: 'Error saving user to MongoDB' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.encodedPassword === btoa(password)) {
      const userIdString = user._id instanceof ObjectId ? user._id.toHexString() : user._id;

      const connection = await Connection.findOne({ user_id: userIdString });

      if (connection) {
        const connections = connection.connections || [];
        res.status(200).json({
          message: 'Login successful',
          user_id: user._id,
          connections,
          user_name: user.name,
          user_type: user.userType,
        });
      } else {
        res.status(200).json({
          message: 'Login successful',
          user_id: user._id,
          connections: [],
          user_name: user.name,
          user_type: user.userType,
        });
      }
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('Error querying MongoDB:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.post('/fetchChatHistory', async (req, res) => {
  const { senderId, receiverId } = req.body;

  try {
    const chatHistory = await Chat.find({
      $or: [
        { sender: senderId, receiver: receiverId },
        { sender: receiverId, receiver: senderId },
      ],
    });

    const query = {
      $or: [
        { sender: senderId, receiver: receiverId },
        { sender: receiverId, receiver: senderId },
      ],
    };

    res.status(200).json(chatHistory);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.post('/addConnection', async (req, res) => {
    const { userId, userName, targetUsername } = req.body;
  
    try {
      const targetUser = await User.findOne({ name: targetUsername });
  
      if (!targetUser) {
        return res.status(404).json({ message: 'No such user found' });
      }
  
      const userIdString = userId.toString();
      const targetUserIdString = targetUser._id.toString();
  
      const existingEntry = await Connection.findOne({ user_id: userIdString });
  
      if (existingEntry) {
        const isUserAlreadyAdded = existingEntry.connections.some(
          (conn) => conn.id === targetUserIdString
        );
  
        if (isUserAlreadyAdded) {
          return res.status(400).json({ message: 'User already added' });
        }
  
        await Connection.updateOne(
          { user_id: userIdString },
          {
            $push: { connections: { id: targetUserIdString, name: targetUser.name } },
          }
        );
      } else {
        const newConnection = new Connection({
          user_id: userIdString,
          connections: [{ id: targetUserIdString, name: targetUser.name }],
        });
        await newConnection.save();
      }
  
      const targetUserExistingEntry = await Connection.findOne({
        user_id: targetUserIdString,
      });
  
      if (targetUserExistingEntry) {
        const isUserAlreadyAdded = targetUserExistingEntry.connections.some(
          (conn) => conn.id === userIdString
        );
  
        if (!isUserAlreadyAdded) {
          await Connection.updateOne(
            { user_id: targetUserIdString },
            {
              $push: { connections: { id: userIdString, name: userName } },
            }
          );
        }
      } else {
        const newTargetConnection = new Connection({
          user_id: targetUserIdString,
          connections: [{ id: userIdString, name: userName }],
        });
        await newTargetConnection.save();
      }
  
      res.status(200).json({
        message: 'Connection added successfully',
        targetUserIdString: targetUserIdString,
      });
    } catch (error) {
      console.error('Error adding connection:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });