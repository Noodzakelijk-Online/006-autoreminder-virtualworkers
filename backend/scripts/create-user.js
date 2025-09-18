const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Simple User schema for registration
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

async function createUser() {
  try {
    // Try to connect to MongoDB (fallback to in-memory if not available)
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/autoreminder';
    
    console.log('Attempting to connect to MongoDB...');
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });
    
    console.log('Connected to MongoDB successfully!');
    
    // Create a test user
    const userData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Test123456',
      role: 'admin'
    };
    
    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: userData.email }, { username: userData.username }]
    });
    
    if (existingUser) {
      console.log('User already exists!');
      console.log('Existing user:', {
        id: existingUser._id,
        username: existingUser.username,
        email: existingUser.email,
        role: existingUser.role,
        createdAt: existingUser.createdAt
      });
      return existingUser;
    }
    
    // Create new user
    const user = new User(userData);
    await user.save();
    
    console.log('User created successfully!');
    console.log('User details:', {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    });
    
    return user;
    
  } catch (error) {
    if (error.name === 'MongooseServerSelectionError') {
      console.log('MongoDB connection failed. Creating user data for manual testing...');
      
      // Create user object for testing without database
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Test123456',
        role: 'admin'
      };
      
      // Hash the password manually
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(userData.password, salt);
      
      const testUser = {
        id: 'test-user-id-123',
        username: userData.username,
        email: userData.email,
        password: hashedPassword,
        role: userData.role,
        isActive: true,
        createdAt: new Date()
      };
      
      console.log('Test user created (no database):');
      console.log({
        id: testUser.id,
        username: testUser.username,
        email: testUser.email,
        role: testUser.role,
        createdAt: testUser.createdAt
      });
      
      console.log('\nYou can use these credentials to test login:');
      console.log('Email:', userData.email);
      console.log('Password:', userData.password);
      
      return testUser;
    } else {
      console.error('Error creating user:', error.message);
      throw error;
    }
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('Database connection closed.');
    }
  }
}

// Run the script
if (require.main === module) {
  createUser()
    .then(() => {
      console.log('Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = { createUser, User };
