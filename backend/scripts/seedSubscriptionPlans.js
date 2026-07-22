require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Organization = require('../models/Organization');

const DEFAULT_PLANS = [
  { name: 'Basic', slug: 'basic', maxCameras: 5, maxOperators: 5, alertRetentionDays: 30, storageLimit: 10, supportPriority: 'standard' },
  { name: 'Pro', slug: 'pro', maxCameras: 20, maxOperators: 15, alertRetentionDays: 90, storageLimit: 50, supportPriority: 'priority' },
  { name: 'Enterprise', slug: 'enterprise', maxCameras: 100, maxOperators: 50, alertRetentionDays: 365, storageLimit: 500, supportPriority: 'premium' },
];

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing in .env');
  }
  await mongoose.connect(process.env.MONGODB_URI);

  for (const plan of DEFAULT_PLANS) {
    const existing = await SubscriptionPlan.findOne({ slug: plan.slug });
    if (!existing) {
      await SubscriptionPlan.create(plan);
      console.log(`Created subscription plan: ${plan.name}`);
    } else {
      console.log(`Plan already exists: ${plan.name}`);
    }
  }

  // Optional: set existing organizations without status to ACTIVE (backward compatibility)
  const updated = await Organization.updateMany(
    { $or: [{ status: { $exists: false } }, { status: '' }], isDeleted: false },
    { $set: { status: 'ACTIVE' } }
  );
  if (updated.modifiedCount > 0) {
    console.log(`Updated ${updated.modifiedCount} organization(s) to status ACTIVE`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
