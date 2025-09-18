require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function createNewAdminUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Create new admin user
        const hashedPassword = await bcrypt.hash('NewAdmin@123', 10);
        const admin = new User({
            username: 'newadmin',
            email: 'newadmin@example.com',
            password: hashedPassword,
            role: 'admin',
            isActive: true
        });

        await admin.save();
        console.log('New admin user created successfully');
        console.log('Username: newadmin');
        console.log('Email: newadmin@example.com');
        console.log('Password: NewAdmin@123');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

createNewAdminUser();
