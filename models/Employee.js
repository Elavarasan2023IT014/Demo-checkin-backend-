const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  fingerprintHash: { type: String, default: null },
  isRegistered: { type: Boolean, default: false },
  credentialId: { type: String },
  publicKey: { type: String },
  isActive: { type: Boolean, default: true },
});

module.exports = mongoose.model('Employee', employeeSchema);