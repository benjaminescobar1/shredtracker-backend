const db = require('./db');

async function testConnection() {
  try {
    const connection = await db.getConnection();

    console.log('Successfully connected to ShredTracker MySQL!');

    connection.release();
  } catch (error) {
    console.error('Database connection failed:', error.message);
  } finally {
    await db.end();
  }
}

testConnection();