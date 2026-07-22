/**
 * Clear all operators and org admins from the database.
 * Super Admin users are NOT removed.
 *
 * - Removes OperatorCameraAssignment for all operators
 * - Clears Organization.adminId where the admin was an org_admin
 * - Deletes Notification documents for removed users
 * - Deletes User documents where role is 'operator' or 'org_admin'
 *
 * Run: node backend/scripts/clearOperatorsAndOrgAdmins.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const User = require('../models/User');
const Organization = require('../models/Organization');
const OperatorCameraAssignment = require('../models/OperatorCameraAssignment');
const Notification = require('../models/Notification');

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing in .env');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const operatorsAndAdmins = await User.find({
    role: { $in: ['operator', 'org_admin'] },
  }).select('_id role email');

  if (operatorsAndAdmins.length === 0) {
    console.log('No operators or org admins found. Nothing to clear.');
    await mongoose.disconnect();
    process.exit(0);
  }

  const ids = operatorsAndAdmins.map((u) => u._id);
  const operatorIds = operatorsAndAdmins.filter((u) => u.role === 'operator').map((u) => u._id);

  console.log(`Found ${operatorsAndAdmins.length} user(s) to remove (${operatorIds.length} operators, ${ids.length - operatorIds.length} org admins).`);

  const resAssignments = await OperatorCameraAssignment.deleteMany({ operatorId: { $in: operatorIds } });
  console.log(`Deleted ${resAssignments.deletedCount} operator camera assignment(s).`);

  const resNotifications = await Notification.deleteMany({ userId: { $in: ids } });
  console.log(`Deleted ${resNotifications.deletedCount} notification(s).`);

  const resOrgs = await Organization.updateMany(
    { adminId: { $in: ids } },
    { $set: { adminId: null } }
  );
  console.log(`Cleared adminId on ${resOrgs.modifiedCount} organization(s).`);

  const resUsers = await User.deleteMany({ _id: { $in: ids } });
  console.log(`Deleted ${resUsers.deletedCount} user(s) (operators and org admins).`);

  await mongoose.disconnect();
  console.log('Done. Super Admin users were not modified.');
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
