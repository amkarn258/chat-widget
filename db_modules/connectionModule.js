const mongoose = require('mongoose');

const connectionSchema = new mongoose.Schema({
  user_id: { type: String, required: true, unique: true },
  connections: [
    {
      id: { type: String, required: true },
      name: { type: String, required: true },
    },
  ],
});

const Connection = mongoose.model('Connection', connectionSchema);

module.exports = Connection;
