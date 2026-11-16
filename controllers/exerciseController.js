const { getAllExercises } = require('../services/exerciseService');

const getExercises = async (req, res) => {
    try {
        const exercises = await getAllExercises();

        res.json(exercises);
    } catch (error) {
        console.error('Error fetching exercises:', error);

        res.status(500).json({
            error: 'Failed to retrieve exercises'
        });
    }
};

module.exports = { getExercises };