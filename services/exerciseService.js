const db = require('../db');

const getAllExercises = async () => {
    const [rows] = await db.query(
        'SELECT * FROM Exercise ORDER BY name ASC'
    );

    return rows;
};

module.exports = { getAllExercises };