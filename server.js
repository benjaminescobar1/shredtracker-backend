const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Import exercise routes
const exerciseRoutes = require('./routes/exerciseRoutes');

// Allow the server to receive JSON data
app.use(express.json());

// Register exercise routes
app.use('/api/exercises', exerciseRoutes);

// Test route
app.get('/', (req, res) => {
    res.send('ShredTracker API is running!');
});

// Start the server
app.listen(PORT, () => {
    console.log(`ShredTracker server running on port ${PORT}`);
});