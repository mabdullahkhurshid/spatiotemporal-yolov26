require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Organization = require('../models/Organization');

const DEFAULT_PLANS = [
  {
    name: 'Basic',
    slug: 'basic',
    description: 'Essential fire & smoke monitoring for small sites',
    price: 49,
    currency: 'USD',
    durationMonths: 1,
    billingCycle: 'monthly',
    maxCameras: 5,
    maxOperators: 5,
    alertRetentionDays: 30,
    storageLimit: 10,
    supportPriority: 'standard',
    displayOrder: 1,
  },
  {
    name: 'Pro',
    slug: 'pro',
    description: 'Advanced monitoring for growing organizations',
    price: 149,
    currency: 'USD',
    durationMonths: 1,
    billingCycle: 'monthly',
    maxCameras: 20,
    maxOperators: 15,
    alertRetentionDays: 90,
    storageLimit: 50,
    supportPriority: 'priority',
    displayOrder: 2,
    isPopular: true,
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    description: 'Full-scale surveillance with premium support',
    price: 499,
    currency: 'USD',
    durationMonths: 12,
    billingCycle: 'yearly',
    maxCameras: 100,
    maxOperators: 50,
    alertRetentionDays: 365,
    storageLimit: 500,
    supportPriority: 'premium',
    displayOrder: 3,
    isRecommended: true,
  },
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
      await SubscriptionPlan.updateOne(
        { _id: existing._id },
        {
          $set: {
            price: existing.price ?? plan.price,
            currency: existing.currency || plan.currency,
            durationMonths: existing.durationMonths ?? plan.durationMonths,
            billingCycle: existing.billingCycle || plan.billingCycle,
            description: existing.description || plan.description,
            displayOrder: existing.displayOrder ?? plan.displayOrder,
          },
        }
      );
      console.log(`Plan already exists (updated defaults if missing): ${plan.name}`);
    }
  }

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
