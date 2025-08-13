const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const log = require('electron-log');
const Store = require('electron-store');
const axios = require('axios');

// Initialize store for database configuration
const store = new Store();

// Database modes
const DB_MODES = {
  LOCAL: 'local',
  CLOUD: 'cloud',
  HYBRID: 'hybrid'
};

// Local database instance
let localDb = null;

/**
 * Get database configuration from store
 * @returns {Object} Database configuration
 */
const getDatabaseConfig = () => {
  return {
    mode: store.get('database.mode') || DB_MODES.LOCAL,
    cloudUri: store.get('database.cloudUri') || '',
    syncInterval: store.get('database.syncInterval') || 3600000, // 1 hour in milliseconds
    lastSyncTime: store.get('database.lastSyncTime') || null
  };
};

/**
 * Save database configuration
 * @param {Object} config - Database configuration
 * @returns {boolean} Save result
 */
const saveDatabaseConfig = (config) => {
  try {
    store.set('database.mode', config.mode);
    store.set('database.cloudUri', config.cloudUri);
    store.set('database.syncInterval', config.syncInterval);
    
    return true;
  } catch (error) {
    log.error('Error saving database configuration:', error);
    return false;
  }
};

/**
 * Initialize local database
 * @returns {Object} Database instance
 */
const initLocalDatabase = () => {
  try {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'autoreminder.db');
    
    log.info(`Initializing local database at ${dbPath}`);
    
    const db = new Database(dbPath, { verbose: log.debug });
    
    // Create tables if they don't exist
    createTables(db);
    
    return db;
  } catch (error) {
    log.error('Error initializing local database:', error);
    throw error;
  }
};

/**
 * Create database tables
 * @param {Object} db - Database instance
 */
const createTables = (db) => {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
  
  // Templates table
  db.exec(`
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      subject TEXT,
      content TEXT NOT NULL,
      variables TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
  
  // Cards table
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      due_date INTEGER,
      board_id TEXT NOT NULL,
      board_name TEXT NOT NULL,
      list_id TEXT NOT NULL,
      list_name TEXT,
      url TEXT,
      members TEXT,
      is_urgent INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
  
  // Reminders table
  db.exec(`
    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      scheduled_time INTEGER NOT NULL,
      day_offset INTEGER NOT NULL,
      job_id TEXT,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (card_id) REFERENCES cards (id) ON DELETE CASCADE
    )
  `);
  
  // Notifications table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      template_id TEXT,
      channel TEXT NOT NULL,
      recipient TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL,
      sent_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (card_id) REFERENCES cards (id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES templates (id) ON DELETE SET NULL
    )
  `);
  
  // Logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      type TEXT NOT NULL,
      channel TEXT,
      message TEXT NOT NULL,
      status TEXT NOT NULL,
      user_id TEXT,
      card_id TEXT,
      created_at INTEGER NOT NULL
    )
  `);
  
  // Reports table
  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      report_type TEXT NOT NULL,
      start_date INTEGER NOT NULL,
      end_date INTEGER NOT NULL,
      metrics TEXT,
      generated_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);
  
  // Configuration table
  db.exec(`
    CREATE TABLE IF NOT EXISTS configuration (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
  
  log.info('Database tables created');
};

/**
 * Get local database instance
 * @returns {Object} Database instance
 */
const getLocalDatabase = () => {
  if (!localDb) {
    localDb = initLocalDatabase();
  }
  
  return localDb;
};

/**
 * Close local database connection
 */
const closeLocalDatabase = () => {
  if (localDb) {
    localDb.close();
    localDb = null;
    log.info('Local database connection closed');
  }
};

/**
 * Sync with cloud database
 * @returns {Promise<boolean>} Sync result
 */
const syncWithCloud = async () => {
  try {
    const config = getDatabaseConfig();
    
    // Skip if not in cloud or hybrid mode
    if (config.mode === DB_MODES.LOCAL) {
      return true;
    }
    
    // Skip if no cloud URI
    if (!config.cloudUri) {
      log.warn('Cloud database URI not configured');
      return false;
    }
    
    log.info('Syncing with cloud database');
    
    // Get local database
    const db = getLocalDatabase();
    
    // Get all local data
    const users = db.prepare('SELECT * FROM users').all();
    const templates = db.prepare('SELECT * FROM templates').all();
    const cards = db.prepare('SELECT * FROM cards').all();
    const reminders = db.prepare('SELECT * FROM reminders').all();
    const notifications = db.prepare('SELECT * FROM notifications').all();
    const logs = db.prepare('SELECT * FROM logs').all();
    const reports = db.prepare('SELECT * FROM reports').all();
    const configuration = db.prepare('SELECT * FROM configuration').all();
    
    // Send data to cloud
    await axios.post(`${config.cloudUri}/sync`, {
      users,
      templates,
      cards,
      reminders,
      notifications,
      logs,
      reports,
      configuration,
      lastSyncTime: config.lastSyncTime
    });
    
    // Update last sync time
    store.set('database.lastSyncTime', Date.now());
    
    log.info('Cloud database sync completed');
    
    return true;
  } catch (error) {
    log.error('Error syncing with cloud database:', error);
    return false;
  }
};

/**
 * Switch database mode
 * @param {string} mode - Database mode (local, cloud, hybrid)
 * @returns {boolean} Switch result
 */
const switchDatabaseMode = (mode) => {
  try {
    if (!Object.values(DB_MODES).includes(mode)) {
      throw new Error(`Invalid database mode: ${mode}`);
    }
    
    const config = getDatabaseConfig();
    
    // Update mode
    config.mode = mode;
    
    // Save configuration
    saveDatabaseConfig(config);
    
    log.info(`Switched database mode to ${mode}`);
    
    return true;
  } catch (error) {
    log.error('Error switching database mode:', error);
    return false;
  }
};

/**
 * Get database status
 * @returns {Object} Database status
 */
const getDatabaseStatus = () => {
  const config = getDatabaseConfig();
  
  return {
    mode: config.mode,
    cloudConfigured: !!config.cloudUri,
    lastSyncTime: config.lastSyncTime,
    localDatabaseSize: localDb ? localDb.pragma('page_count * page_size') : 0
  };
};

module.exports = {
  DB_MODES,
  getDatabaseConfig,
  saveDatabaseConfig,
  getLocalDatabase,
  closeLocalDatabase,
  syncWithCloud,
  switchDatabaseMode,
  getDatabaseStatus
};
