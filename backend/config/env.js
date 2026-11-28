// Validates configuration at startup so a misconfigured server refuses to boot instead of running
// with missing or placeholder secrets. Other variables pass through untouched (process.env is never rewritten).
const Joi = require('joi');

const PLACEHOLDER = /change-me|your-super-secret|changeme/i;
const MIN_SECRET_LENGTH = 32;
const GENERATE_HINT = `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`;

const strongSecret = Joi.string()
  .min(MIN_SECRET_LENGTH)
  .custom((value, helpers) => (PLACEHOLDER.test(value) ? helpers.error('secret.placeholder') : value))
  .messages({
    'string.min': `{{#label}} must be at least ${MIN_SECRET_LENGTH} characters`,
    'secret.placeholder': '{{#label}} still uses the example placeholder value',
  });

const baseSchema = Joi.object({
  JWT_SECRET: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().required(),
  MONGODB_URI: Joi.string().required(),
}).unknown(true);

const productionSchema = baseSchema.keys({
  JWT_SECRET: strongSecret.required(),
  JWT_REFRESH_SECRET: strongSecret.required().invalid(Joi.ref('JWT_SECRET')).messages({
    'any.invalid': '"JWT_REFRESH_SECRET" must differ from "JWT_SECRET"',
  }),
  INFERENCE_SERVICE_API_KEY: strongSecret.allow(''),
  MEDIAMTX_INTERNAL_PASS: Joi.when('DEMO_CAMERAS_ENABLED', {
    is: 'true',
    then: strongSecret.required(),
    otherwise: Joi.any(),
  }),
});

/** Returns a list of problems ([] when valid). Exported for tests. */
function checkEnv(env = process.env) {
  const isProduction = env.NODE_ENV === 'production';
  const schema = isProduction ? productionSchema : baseSchema;
  const { error } = schema.validate(env, { abortEarly: false });
  return error ? error.details.map((d) => d.message) : [];
}

/** Exits the process on invalid configuration (production) or missing essentials (any mode). */
function validateEnv(env = process.env) {
  const problems = checkEnv(env);
  if (problems.length === 0) return;

  console.error('Invalid server configuration:');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(`Generate a strong secret with: ${GENERATE_HINT}`);
  process.exit(1);
}

module.exports = { validateEnv, checkEnv };
