require('dotenv').config();
const session = require('express-session');

const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Import exercise routes
const exerciseRoutes = require('./routes/exerciseRoutes');
const userRoutes = require('./routes/userRoutes');
const sessionRoutes = require('./routes/sessionRoutes');

// Allow the server to receive JSON data
app.use(express.json());

app.use(session({
  name: 'shredtracker.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Register exercise routes
app.use('/api/exercises', exerciseRoutes);
app.use('/api/users', userRoutes);
app.use('/api/session', sessionRoutes);

// Test route
app.get('/', (req, res) => {
    res.send('ShredTracker API is running!');
});

// Start the server
app.listen(PORT, () => {
    console.log(`ShredTracker server running on port ${PORT}`);
});