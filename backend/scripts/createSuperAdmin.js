require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  const email = process.env.SUPERADMIN_EMAIL || 'superadmin@gmail.com';
  const password = process.env.SUPERADMIN_PASSWORD || 'Admin@123';
  const name = process.env.SUPERADMIN_NAME || 'Super Admin';

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing in .env');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const existing = await User.findOne({ email, isDeleted: false }).select('+password');

  if (existing) {
    existing.role = 'super_admin';
    existing.isEmailVerified = true;
    existing.isVerified = true;
    existing.isActive = true;
    existing.isDeleted = false;
    if (!existing.password) {
      existing.password = password; // will be hashed by pre-save hook
    }
    await existing.save();
    console.log(`Updated existing user to super_admin: ${email}`);
  } else {
    await User.create({
      name,
      email,
      password, // will be hashed by pre-save hook
      role: 'super_admin',
      isEmailVerified: true,
      isVerified: true,
      isActive: true,
      isDeleted: false,
    });
    console.log(`Created super_admin: ${email}`);
  }

  console.log('Login credentials:');
  console.log(`  email: ${email}`);
  console.log(`  password: ${password}`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});

