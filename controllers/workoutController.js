const {
  createWorkout,
  getWorkoutsByUser,
  getWorkoutById,
  deleteWorkout,
  updateWorkout,
  calculateWorkoutVolume,
  compareWorkoutVolume,
  getPersonalRecords,
  detectWorkoutPRs
} = require('../services/workoutService');

// Validate workout information before saving
const validateWorkout = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Invalid workout data';
  }

  const { workout_date, notes, sets } = body;

  // Require a real calendar date in YYYY-MM-DD format
  if (typeof workout_date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(workout_date)) {
    return 'Workout date must use YYYY-MM-DD';
  }

  const date = new Date(`${workout_date}T00:00:00Z`);

  if (Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== workout_date) {
    return 'Invalid workout date';
  }

  if (notes !== undefined && notes !== null &&
      (typeof notes !== 'string' || notes.length > 500)) {
    return 'Notes must be 500 characters or fewer';
  }

  if (!Array.isArray(sets) || sets.length === 0) {
    return 'At least one exercise set is required';
  }

  for (const set of sets) {
    if (!set || typeof set !== 'object' || Array.isArray(set)) {
      return 'Invalid exercise set';
    }

    if (!Number.isSafeInteger(set.exercise_id) ||
        set.exercise_id <= 0) {
      return 'Exercise ID must be a positive integer';
    }

    if (!Number.isSafeInteger(set.set_number) ||
        set.set_number <= 0) {
      return 'Set number must be a positive integer';
    }

    if (!Number.isSafeInteger(set.repetitions) ||
        set.repetitions <= 0) {
      return 'Repetitions must be a positive integer';
    }

    if (typeof set.weight_lb !== 'number' ||
        !Number.isFinite(set.weight_lb) ||
        set.weight_lb < 0 ||
        set.weight_lb > 9999.99 ||
        Math.round(set.weight_lb * 100) !== set.weight_lb * 100) {
      return 'Weight must be between 0 and 9999.99 with at most two decimal places';
    }
  }

  return null;
};

// Create a new workout
const addWorkout = async (req, res) => {
  try {
    // Validate the submitted workout
    const validationError = validateWorkout(req.body);

    if (validationError) {
      return res.status(400).json({
        error: validationError
      });
    }

    const { workout_date, notes, sets } = req.body;

    // Get the logged-in user's ID from the session
    const userId = req.session.userId;

    // Save the workout and its sets
    const workout = await createWorkout(
      userId,
      workout_date,
      notes ?? null,
      sets
    );

    return res.status(201).json({
      message: 'Workout created successfully',
      workout
    });

  } catch (error) {
    // Reject exercise IDs that don't exist in MySQL
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({
        error: 'Invalid exercise ID'
      });
    }

    console.error('Create workout error:', error);

    return res.status(500).json({
      error: 'Failed to create workout'
    });
  }
};

// Get all workouts for the logged-in user
const listWorkouts = async (req, res) => {
  try {
    const workouts = await getWorkoutsByUser(req.session.userId);

    return res.status(200).json({ workouts });
  } catch (error) {
    console.error('List workouts error:', error);

    return res.status(500).json({
      error: 'Failed to retrieve workouts'
    });
  }
};

// Get one workout and its exercise sets
const viewWorkout = async (req, res) => {
  try {
    const workoutId = Number(req.params.id);

    if (!Number.isSafeInteger(workoutId) || workoutId <= 0) {
      return res.status(400).json({
        error: 'Invalid workout ID'
      });
    }

    const workout = await getWorkoutById(
      workoutId,
      req.session.userId
    );

    if (!workout) {
      return res.status(404).json({
        error: 'Workout not found'
      });
    }

    return res.status(200).json({ workout });
  } catch (error) {
    console.error('View workout error:', error);

    return res.status(500).json({
      error: 'Failed to retrieve workout'
    });
  }
};

// Update an existing workout
const editWorkout = async (req, res) => {
  try {
    const workoutId = Number(req.params.id);

    if (!Number.isSafeInteger(workoutId) || workoutId <= 0) {
      return res.status(400).json({
        error: 'Invalid workout ID'
      });
    }

    const validationError = validateWorkout(req.body);

    if (validationError) {
      return res.status(400).json({
        error: validationError
      });
    }

    const { workout_date, notes, sets } = req.body;

    const workout = await updateWorkout(
      workoutId,
      req.session.userId,
      workout_date,
      notes ?? null,
      sets
    );

    if (!workout) {
      return res.status(404).json({
        error: 'Workout not found'
      });
    }

    return res.status(200).json({
      message: 'Workout updated successfully',
      workout
    });

  } catch (error) {
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({
        error: 'Invalid exercise ID'
      });
    }

    console.error('Update workout error:', error);

    return res.status(500).json({
      error: 'Failed to update workout'
    });
  }
};

// Delete an existing workout
const removeWorkout = async (req, res) => {
  try {
    const workoutId = Number(req.params.id);

    if (!Number.isSafeInteger(workoutId) || workoutId <= 0) {
      return res.status(400).json({
        error: 'Invalid workout ID'
      });
    }

    const deleted = await deleteWorkout(
      workoutId,
      req.session.userId
    );

    if (!deleted) {
      return res.status(404).json({
        error: 'Workout not found'
      });
    }

    return res.status(200).json({
      message: 'Workout deleted successfully'
    });

  } catch (error) {
    console.error('Delete workout error:', error);

    return res.status(500).json({
      error: 'Failed to delete workout'
    });
  }
};

// Get total workout volume and volume per exercise
const getWorkoutVolume = async (req, res) => {
  try {
    const workoutId = Number(req.params.id);

    if (!Number.isSafeInteger(workoutId) || workoutId <= 0) {
      return res.status(400).json({
        error: 'Invalid workout ID'
      });
    }

    const workout = await getWorkoutById(
      workoutId,
      req.session.userId
    );

    if (!workout) {
      return res.status(404).json({
        error: 'Workout not found'
      });
    }

    const volumeData = await calculateWorkoutVolume(
      workoutId,
      req.session.userId
    );

    return res.status(200).json({
      workout_id: workoutId,
      total_volume_lb: volumeData.total_volume_lb,
      exercises: volumeData.exercises
    });

  } catch (error) {
    console.error('Workout volume error:', error);

    return res.status(500).json({
      error: 'Failed to calculate workout volume'
    });
  }
};

// Compare workout volume with a previous session
const getWorkoutComparison = async (req, res) => {
  try {
    const workoutId = Number(req.params.id);

    if (!Number.isSafeInteger(workoutId) || workoutId <= 0) {
      return res.status(400).json({
        error: 'Invalid workout ID'
      });
    }

    const comparison = await compareWorkoutVolume(
      workoutId,
      req.session.userId
    );

    if (!comparison) {
      return res.status(404).json({
        error: 'Workout not found'
      });
    }

    return res.status(200).json({ comparison });

  } catch (error) {
    console.error('Workout comparison error:', error);

    return res.status(500).json({
      error: 'Failed to compare workout volume'
    });
  }
};

// Get personal records for the logged-in user
const listPersonalRecords = async (req, res) => {
  try {
    const records = await getPersonalRecords(
      req.session.userId
    );

    return res.status(200).json({ records });

  } catch (error) {
    console.error('Personal records error:', error);

    return res.status(500).json({
      error: 'Failed to retrieve personal records'
    });
  }
};


// Check whether a workout achieved new personal records
const getWorkoutPRs = async (req, res) => {
  try {
    const workoutId = Number(req.params.id);
    const userId = req.session.userId;

    const result = await detectWorkoutPRs(workoutId, userId);

    if (!result) {
      return res.status(404).json({
        error: 'Workout not found'
      });
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error('Workout PR detection error:', error);

    return res.status(500).json({
      error: 'Failed to detect workout personal records'
    });
  }
};

module.exports = {
  addWorkout,
  listWorkouts,
  viewWorkout,
  editWorkout,
  removeWorkout,
  getWorkoutVolume,
  getWorkoutComparison,
  listPersonalRecords,
  getWorkoutPRs
};