// server.js or index.js
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bcrypt = require('bcrypt');
const Employee = require('./models/Employee');
const Attendance = require('./models/Attendance');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your-secret-key'; // In production, use environment variables

// ✅ CORS Configuration
const allowedOrigins = [
  'http://localhost:5173',
  'https://demo-checkin-frontend.vercel.app'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-employee-token'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());

// ✅ Handle preflight CORS requests
app.options('*', cors(corsOptions));

// ✅ Connect to MongoDB
mongoose.connect('mongodb+srv://elavarasanr2023it:alwlhTZlbiW6nXQT@cluster0.eqz5z.mongodb.net/Demo-Checkin', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// ✅ Auth middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers['x-employee-token'];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.employeeId = decoded.employeeId;
    next();
  });
};

// ✅ Register endpoint
app.post('/api/register', async (req, res) => {
  const { employeeId, name, email, password } = req.body;
  try {
    const existingEmployee = await Employee.findOne({ $or: [{ employeeId }, { email }] });
    if (existingEmployee) return res.status(400).json({ message: 'Employee ID or email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const employee = new Employee({ employeeId, name, email, password: hashedPassword });
    await employee.save();

    const token = jwt.sign({ employeeId }, JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ message: 'Registration successful', token });
  } catch (error) {
    res.status(500).json({ message: 'Error registering', error: error.message });
  }
});

// ✅ Login endpoint
app.post('/api/login', async (req, res) => {
  const { employeeId, password } = req.body;
  const employee = await Employee.findOne({ employeeId });
  if (!employee || !(await bcrypt.compare(password, employee.password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign({ employeeId }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token });
});

// ✅ Check-in endpoint
app.post('/api/checkin', authenticateToken, async (req, res) => {
  const { employeeId } = req;
  const today = new Date().toISOString().split('T')[0];
  const employee = await Employee.findOne({ employeeId });

  if (!employee) return res.status(404).json({ message: 'Employee not found' });

  let attendance = await Attendance.findOne({ employeeId, date: today });
  if (!attendance) {
    attendance = new Attendance({ employeeId, date: today, checkIn: new Date() });
    await attendance.save();
    return res.json({
      message: 'Checked in successfully',
      checkIn: attendance.checkIn,
      notification: {
        title: 'Check-In',
        body: `${employeeId} (${employee.name}) has checked in!`,
      }
    });
  } else if (!attendance.checkOut) {
    return res.json({ message: 'Already checked in', checkIn: attendance.checkIn });
  } else {
    return res.status(400).json({ message: 'Already checked out today' });
  }
});

// ✅ Check-out endpoint
app.post('/api/checkout', authenticateToken, async (req, res) => {
  const { employeeId } = req;
  const today = new Date().toISOString().split('T')[0];
  const attendance = await Attendance.findOne({ employeeId, date: today });

  if (attendance && !attendance.checkOut) {
    attendance.checkOut = new Date();
    await attendance.save();
    return res.json({ message: 'Checked out successfully', checkOut: attendance.checkOut });
  } else {
    return res.status(400).json({ message: 'Not checked in or already checked out' });
  }
});

// ✅ Get attendance logs
app.get('/api/attendance', authenticateToken, async (req, res) => {
  const { employeeId } = req;
  const logs = await Attendance.find({ employeeId }).sort({ date: -1 }).lean();
  res.json(logs || []);
});

// ✅ Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// ✅ Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
