require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function createAdminUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Check if admin already exists
        const existingAdmin = await User.findOne({ email: 'admin@example.com' });
        if (existingAdmin) {
            console.log('Admin user already exists');
            return;
        }

        // Create admin user
        const hashedPassword = await bcrypt.hash('Admin@123', 10);
        const admin = new User({
            username: 'admin',
            email: 'admin@example.com',
            password: hashedPassword,
            role: 'admin',
            isActive: true
        });

        await admin.save();
        console.log('Admin user created successfully');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

createAdminUser();
