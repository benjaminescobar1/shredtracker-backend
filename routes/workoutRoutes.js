const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/requireAuth');

const {
  addWorkout,
  listWorkouts,
  viewWorkout,
  editWorkout,
  removeWorkout,
  getWorkoutVolume,
  getWorkoutComparison,
  listPersonalRecords,
  getWorkoutPRs
} = require('../controllers/workoutController');

// Require login for every workout endpoint
router.use(requireAuth);

// Workout CRUD endpoints 
// Create and list workouts
router.post('/', addWorkout);
router.get('/', listWorkouts);

// Specific routes first
router.get('/records', listPersonalRecords);
router.get('/:id/volume', getWorkoutVolume);
router.get('/:id/compare', getWorkoutComparison);
router.get('/:id/prs', getWorkoutPRs);

// General workout ID routes afterward
router.get('/:id', viewWorkout);
router.put('/:id', editWorkout);
router.delete('/:id', removeWorkout);

module.exports = router;