const db = require('../db');

// Create a workout and all its sets
const createWorkout = async (userId, workoutDate, notes, sets) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Save the workout
    const [result] = await connection.query(
      `INSERT INTO Workout (user_id, workout_date, notes)
       VALUES (?, ?, ?)`,
      [userId, workoutDate, notes]
    );

    const workoutId = result.insertId;

    // Save each exercise set
    for (const set of sets) {
      await connection.query(
        `INSERT INTO WorkoutSet
         (workout_id, exercise_id, set_number, weight_lb, repetitions)
         VALUES (?, ?, ?, ?, ?)`,
        [
          workoutId,
          set.exercise_id,
          set.set_number,
          set.weight_lb,
          set.repetitions
        ]
      );
    }

    // Save everything together
    await connection.commit();

    return {
      workout_id: workoutId,
      user_id: userId,
      workout_date: workoutDate,
      notes,
      sets
    };

  } catch (error) {
    // Undo all changes if anything fails
    await connection.rollback();
    throw error;

  } finally {
    // Return the connection to the MySQL pool
    connection.release();
  }
};

// Get all workouts belonging to the logged-in user
const getWorkoutsByUser = async (userId) => {
  const [rows] = await db.query(
    `SELECT workout_id, user_id, workout_date, notes
     FROM Workout
     WHERE user_id = ?
     ORDER BY workout_date DESC, workout_id DESC`,
    [userId]
  );

  return rows;
};

// Get one workout and its exercise sets
const getWorkoutById = async (workoutId, userId) => {
  const [workouts] = await db.query(
    `SELECT workout_id, user_id, workout_date, notes
     FROM Workout
     WHERE workout_id = ? AND user_id = ?`,
    [workoutId, userId]
  );

  // Workout does not exist or belongs to another user
  if (workouts.length === 0) {
    return null;
  }

  const [sets] = await db.query(
    `SELECT
       ws.set_id,
       ws.exercise_id,
       e.name AS exercise_name,
       ws.set_number,
       ws.weight_lb,
       ws.repetitions
     FROM WorkoutSet ws
     JOIN Exercise e ON ws.exercise_id = e.exercise_id
     WHERE ws.workout_id = ?
     ORDER BY ws.exercise_id, ws.set_number, ws.set_id`,
    [workoutId]
  );

  return {
    ...workouts[0],
    sets
  };
};

// Delete a workout and all its sets
const deleteWorkout = async (workoutId, userId) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Verify that the workout belongs to this user
    const [workouts] = await connection.query(
      `SELECT workout_id
       FROM Workout
       WHERE workout_id = ? AND user_id = ?
       FOR UPDATE`,
      [workoutId, userId]
    );

    if (workouts.length === 0) {
      await connection.rollback();
      return false;
    }

    // Delete the workout's exercise sets first
    await connection.query(
      'DELETE FROM WorkoutSet WHERE workout_id = ?',
      [workoutId]
    );

    // Delete the workout itself
    await connection.query(
      'DELETE FROM Workout WHERE workout_id = ? AND user_id = ?',
      [workoutId, userId]
    );

    await connection.commit();
    return true;

  } catch (error) {
    await connection.rollback();
    throw error;

  } finally {
    connection.release();
  }
};

// Update a workout and replace its exercise sets
const updateWorkout = async (workoutId, userId, workoutDate, notes, sets) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Verify ownership and lock the workout during editing
    const [workouts] = await connection.query(
      `SELECT workout_id
       FROM Workout
       WHERE workout_id = ? AND user_id = ?
       FOR UPDATE`,
      [workoutId, userId]
    );

    if (workouts.length === 0) {
      await connection.rollback();
      return null;
    }

    // Update workout information
    await connection.query(
      `UPDATE Workout
       SET workout_date = ?, notes = ?
       WHERE workout_id = ? AND user_id = ?`,
      [workoutDate, notes, workoutId, userId]
    );

    // Remove previous sets
    await connection.query(
      'DELETE FROM WorkoutSet WHERE workout_id = ?',
      [workoutId]
    );

    // Save updated sets
    for (const set of sets) {
      await connection.query(
        `INSERT INTO WorkoutSet
         (workout_id, exercise_id, set_number, weight_lb, repetitions)
         VALUES (?, ?, ?, ?, ?)`,
        [
          workoutId,
          set.exercise_id,
          set.set_number,
          set.weight_lb,
          set.repetitions
        ]
      );
    }

    await connection.commit();

    return {
      workout_id: Number(workoutId),
      user_id: userId,
      workout_date: workoutDate,
      notes,
      sets
    };

  } catch (error) {
    await connection.rollback();
    throw error;

  } finally {
    connection.release();
  }
};

// Calculate total workout volume and volume per exercise
const calculateWorkoutVolume = async (workoutId, userId) => {
  const [rows] = await db.query(
    `SELECT
       e.exercise_id,
       e.name AS exercise_name,
       COALESCE(SUM(ws.weight_lb * ws.repetitions), 0) AS volume_lb
     FROM Workout w
     JOIN WorkoutSet ws ON w.workout_id = ws.workout_id
     JOIN Exercise e ON ws.exercise_id = e.exercise_id
     WHERE w.workout_id = ? AND w.user_id = ?
     GROUP BY e.exercise_id, e.name
     ORDER BY e.name ASC`,
    [workoutId, userId]
  );

  const exercises = rows.map((row) => ({
    exercise_id: row.exercise_id,
    exercise_name: row.exercise_name,
    volume_lb: Number(row.volume_lb)
  }));

  const totalVolume = exercises.reduce(
    (total, exercise) => total + exercise.volume_lb,
    0
  );

  return {
    total_volume_lb: totalVolume,
    exercises: exercises
  };
};


// Compare workout volume with the previous session
const compareWorkoutVolume = async (workoutId, userId) => {
  const currentWorkout = await getWorkoutById(workoutId, userId);

  if (!currentWorkout) {
    return null;
  }

  // Find the previous workout containing a matching exercise
  const [previousRows] = await db.query(
    `SELECT DISTINCT w.workout_id, w.workout_date
     FROM Workout w
     JOIN WorkoutSet ws ON w.workout_id = ws.workout_id
     WHERE w.user_id = ?
       AND (
         w.workout_date < (
           SELECT workout_date
           FROM Workout
           WHERE workout_id = ? AND user_id = ?
         )
         OR (
           w.workout_date = (
             SELECT workout_date
             FROM Workout
             WHERE workout_id = ? AND user_id = ?
           )
           AND w.workout_id < ?
         )
       )
       AND ws.exercise_id IN (
         SELECT exercise_id
         FROM WorkoutSet
         WHERE workout_id = ?
       )
     ORDER BY w.workout_date DESC, w.workout_id DESC
     LIMIT 1`,
    [
      userId,
      workoutId,
      userId,
      workoutId,
      userId,
      workoutId,
      workoutId
    ]
  );

  // Calculate current workout volume
  const currentVolumeData = await calculateWorkoutVolume(workoutId, userId);
  const currentVolume = currentVolumeData.total_volume_lb;
  const currentExercises = currentVolumeData.exercises;

  // No previous matching workout
  if (previousRows.length === 0) {
    return {
      workout_id: workoutId,
      current_volume_lb: currentVolume,
      previous_volume_lb: null,
      volume_change_lb: null,
      percentage_change: null,
      exercise_comparisons: currentExercises.map((exercise) => ({
        exercise_id: exercise.exercise_id,
        exercise_name: exercise.exercise_name,
        current_volume_lb: exercise.volume_lb,
        previous_volume_lb: null,
        volume_change_lb: null,
        percentage_change: null
      }))
    };
  }

  // Calculate previous workout volume
  const previousWorkoutId = previousRows[0].workout_id;

  const previousVolumeData = await calculateWorkoutVolume(
    previousWorkoutId,
    userId
  );

  const previousVolume = previousVolumeData.total_volume_lb;
  const previousExercises = previousVolumeData.exercises;

  // Compare matching exercises individually
  const exerciseComparisons = currentExercises.map((exercise) => {
    const previousExercise = previousExercises.find(
      (prev) => prev.exercise_id === exercise.exercise_id
    );

    const previousExerciseVolume = previousExercise
      ? previousExercise.volume_lb
      : null;

    const volumeChange = previousExercise
      ? exercise.volume_lb - previousExerciseVolume
      : null;

    const percentageChange =
      previousExerciseVolume > 0
        ? Number(((volumeChange / previousExerciseVolume) * 100).toFixed(2))
        : null;

    return {
      exercise_id: exercise.exercise_id,
      exercise_name: exercise.exercise_name,
      current_volume_lb: exercise.volume_lb,
      previous_volume_lb: previousExerciseVolume,
      volume_change_lb: volumeChange,
      percentage_change: percentageChange
    };
  });

  // Calculate overall workout volume changes
  const volumeChange = currentVolume - previousVolume;

  const percentageChange =
    previousVolume > 0
      ? Number(((volumeChange / previousVolume) * 100).toFixed(2))
      : null;

  // Return complete comparison
  return {
    workout_id: workoutId,
    previous_workout_id: previousWorkoutId,
    current_volume_lb: currentVolume,
    previous_volume_lb: previousVolume,
    volume_change_lb: volumeChange,
    percentage_change: percentageChange,
    exercise_comparisons: exerciseComparisons
  };
};

// Get personal records for a user
const getPersonalRecords = async (userId) => {
  const [records] = await db.query(
    `SELECT
       e.exercise_id,
       e.name AS exercise_name,
       MAX(ws.weight_lb) AS highest_weight_lb
     FROM WorkoutSet ws
     JOIN Workout w ON ws.workout_id = w.workout_id
     JOIN Exercise e ON ws.exercise_id = e.exercise_id
     WHERE w.user_id = ?
     GROUP BY e.exercise_id, e.name
     ORDER BY e.name ASC`,
    [userId]
  );

  return records.map(record => ({
    exercise_id: record.exercise_id,
    exercise_name: record.exercise_name,
    highest_weight_lb: Number(record.highest_weight_lb)
  }));
};


// Detect personal records achieved during a workout
const detectWorkoutPRs = async (workoutId, userId) => {
  // Verify the workout belongs to the signed-in user
  const workout = await getWorkoutById(workoutId, userId);

  if (!workout) {
    return null;
  }

  // Get the highest weight for each exercise in this workout
  const [currentRecords] = await db.query(
    `SELECT
       ws.exercise_id,
       e.name AS exercise_name,
       MAX(ws.weight_lb) AS weight_lb
     FROM WorkoutSet ws
     JOIN Exercise e ON ws.exercise_id = e.exercise_id
     WHERE ws.workout_id = ?
     GROUP BY ws.exercise_id, e.name`,
    [workoutId]
  );

  const results = [];

  for (const record of currentRecords) {
    // Find the previous record before this workout
    const [previousRows] = await db.query(
      `SELECT MAX(ws.weight_lb) AS previous_record_lb
       FROM WorkoutSet ws
       JOIN Workout w ON ws.workout_id = w.workout_id
       WHERE w.user_id = ?
         AND ws.exercise_id = ?
         AND (
           w.workout_date < (
             SELECT workout_date
             FROM Workout
             WHERE workout_id = ? AND user_id = ?
           )
           OR (
             w.workout_date = (
               SELECT workout_date
               FROM Workout
               WHERE workout_id = ? AND user_id = ?
             )
             AND w.workout_id < ?
           )
         )`,
      [
        userId,
        record.exercise_id,
        workoutId,
        userId,
        workoutId,
        userId,
        workoutId
      ]
    );

    const previousRecord = previousRows[0].previous_record_lb;

    results.push({
      exercise_id: record.exercise_id,
      exercise_name: record.exercise_name,
      weight_lb: Number(record.weight_lb),
      previous_record_lb:
        previousRecord === null ? null : Number(previousRecord),
      is_new_pr:
        previousRecord === null ||
        Number(record.weight_lb) > Number(previousRecord)
    });
  }

  return {
    workout_id: Number(workoutId),
    records: results
  };
};

module.exports = {
  createWorkout,
  getWorkoutsByUser,
  getWorkoutById,
  deleteWorkout,
  updateWorkout,
  calculateWorkoutVolume,
  compareWorkoutVolume,
  getPersonalRecords,
  detectWorkoutPRs
};