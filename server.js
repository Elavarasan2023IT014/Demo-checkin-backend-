const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const Employee = require('./models/Employee');
const Attendance = require('./models/Attendance');
const sendMail = require('./utils/sendMail');
//const { verifyRegistrationResponse, generateRegistrationOptions } = require('@simplewebauthn/server');
const session = require('express-session'); // Add session middleware
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

app.use(express.json());

// Serve static files (e.g., register.html)
app.use(express.static(path.join(__dirname, 'public')));

// CORS configuration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-employee-token');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(cors());

// Session middleware
app.use(session({
  secret: 'your-session-secret', // Use env variable in production
  resave: false,
  saveUninitialized: false,
}));

// Connect to MongoDB
mongoose.connect('mongodb+srv://elavarasanr2023it:alwlhTZlbiW6nXQT@cluster0.eqz5z.mongodb.net/Demo-Checkin')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB error:', err));

// Middleware to verify token
const authenticateToken = (req, res, next) => {
  const token = req.headers['x-employee-token'];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.employeeId = decoded.employeeId;
    next();
  });
};

// Registration endpoint
app.post('/api/register', async (req, res) => {
  const { employeeId, name, email, password } = req.body;

  if (!employeeId || !name || !email || !password) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    const existingEmployee = await Employee.findOne({ $or: [{ employeeId }, { email: email.toLowerCase() }] });
    if (existingEmployee) return res.status(409).json({ message: 'Employee ID or email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newEmployee = new Employee({
      employeeId,
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      isRegistered: false,
    });

    await newEmployee.save();

    const link = `${BASE_URL}/register.html?email=${encodeURIComponent(email)}`;
    const html = `
      <h3>Hello ${name},</h3>
      <p>Please click the link below to register your fingerprint:</p>
      <a href="${link}">Register Fingerprint</a>
      <p>Regards,<br/>Attendance System</p>
    `;

    await sendMail(email, 'Register Your Fingerprint', html);
    const token = jwt.sign({ employeeId }, JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ message: 'Employee registered. Check email to register fingerprint.', token });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ message: 'Error registering employee.', error: error.message });
  }
});

app.post('/register-fingerprint', async (req, res) => {
  const { email, fingerprintHash } = req.body;
  if (!email || !fingerprintHash) {
    return res.status(400).json({ message: 'Email and fingerprintHash are required.' });
  }

  try {
    const employee = await Employee.findOne({ email: email.toLowerCase() });
    if (!employee) return res.status(404).json({ message: 'Employee not found.' });

    if (employee.isRegistered && employee.fingerprintHash) {
      return res.status(400).json({ message: 'Fingerprint already registered.' });
    }

    if (!fingerprintHash) {
      return res.status(400).json({ message: 'Fingerprint scanning is not supported on your device.' });
    }

    const hashedFingerprint = await bcrypt.hash(fingerprintHash, 10);
    employee.fingerprintHash = hashedFingerprint;
    employee.isRegistered = true;
    await employee.save();

    res.status(200).json({ message: 'Fingerprint registered successfully ✅' });
  } catch (err) {
    console.error('Fingerprint Registration Error:', err);
    res.status(500).json({ message: 'Error registering fingerprint.' });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { employeeId, password } = req.body;
  const employee = await Employee.findOne({ employeeId });
  if (!employee || !(await bcrypt.compare(password, employee.password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const token = jwt.sign({ employeeId }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ message: 'Login successful', token, employeeId: employee.employeeId });
});

// Auto check-in endpoint
app.post('/api/checkin', authenticateToken, async (req, res) => {
  const { employeeId } = req;
  const today = new Date().toISOString().split('T')[0];
  const employee = await Employee.findOne({ employeeId });

  if (!employee) return res.status(404).json({ message: 'Employee not found' });

  if (!employee.isRegistered) {
    return res.status(400).json({ message: 'Fingerprint not registered. Please register first.', needsFingerprint: true });
  }

  let attendance = await Attendance.findOne({ employeeId, date: today });
  if (!attendance) {
    attendance = new Attendance({ employeeId, date: today, checkIn: new Date() });
    await attendance.save();
    res.json({
      message: 'Checked in successfully',
      checkIn: attendance.checkIn,
      notification: {
        title: 'Check-In',
        body: `${employeeId} (${employee.name}) has checked in!`,
      },
    });
  } else if (!attendance.checkOut) {
    res.json({ message: 'Already checked in', checkIn: attendance.checkIn });
  } else {
    res.status(400).json({ message: 'Already checked out today' });
  }
});

// Auto check-out endpoint
app.post('/api/checkout', authenticateToken, async (req, res) => {
  const { employeeId } = req;
  const today = new Date().toISOString().split('T')[0];
  const attendance = await Attendance.findOne({ employeeId, date: today });

  if (attendance && !attendance.checkOut) {
    attendance.checkOut = new Date();
    await attendance.save();
    res.json({ message: 'Checked out successfully', checkOut: attendance.checkOut });
  } else {
    res.status(400).json({ message: 'Not checked in or already checked out' });
  }
});

// Get attendance log
app.get('/api/attendance', authenticateToken, async (req, res) => {
  try {
    const { employeeId } = req;
    const employee = await Employee.findOne({ employeeId });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const logs = await Attendance.find({ employeeId })
      .sort({ date: -1, checkIn: -1 })
      .lean();

    const logsWithDetails = logs.map(log => ({
      ...log,
      employeeId,
      employeeName: employee.name,
      formattedDate: new Date(log.date).toLocaleDateString(),
      formattedCheckIn: log.checkIn ? new Date(log.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : null,
      formattedCheckOut: log.checkOut ? new Date(log.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : null,
    }));

    res.json(logsWithDetails);
  } catch (error) {
    console.error('Error fetching attendance logs:', error);
    res.status(500).json({ message: 'Error fetching attendance logs', error: error.message });
  }
});

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));