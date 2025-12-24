import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl: { rejectUnauthorized: true }
});

try {
  // Check if columns exist
  const [columns] = await connection.execute(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_working_hours' AND COLUMN_NAME IN ('weeklyHoursMin', 'weeklyHoursMax', 'dailyHoursMin', 'dailyHoursMax')"
  );
  
  const existingColumns = columns.map(c => c.COLUMN_NAME);
  console.log('Existing columns:', existingColumns);
  
  // Add missing columns
  if (!existingColumns.includes('weeklyHoursMin')) {
    await connection.execute("ALTER TABLE user_working_hours ADD COLUMN weeklyHoursMin INT NOT NULL DEFAULT 40");
    console.log('Added weeklyHoursMin column');
  }
  
  if (!existingColumns.includes('weeklyHoursMax')) {
    await connection.execute("ALTER TABLE user_working_hours ADD COLUMN weeklyHoursMax INT NOT NULL DEFAULT 45");
    console.log('Added weeklyHoursMax column');
  }
  
  if (!existingColumns.includes('dailyHoursMin')) {
    await connection.execute("ALTER TABLE user_working_hours ADD COLUMN dailyHoursMin DECIMAL(4,2) NOT NULL DEFAULT 8.00");
    console.log('Added dailyHoursMin column');
  }
  
  if (!existingColumns.includes('dailyHoursMax')) {
    await connection.execute("ALTER TABLE user_working_hours ADD COLUMN dailyHoursMax DECIMAL(4,2) NOT NULL DEFAULT 9.00");
    console.log('Added dailyHoursMax column');
  }
  
  console.log('Migration complete!');
} catch (error) {
  console.error('Migration error:', error);
} finally {
  await connection.end();
}
