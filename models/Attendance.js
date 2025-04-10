const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employeeId: { type: String, required: true },
  date: { type: String, required: true },
  checkIn: { type: Date },
  checkOut: { type: Date },
});

module.exports = mongoose.model('Attendance', attendanceSchema);