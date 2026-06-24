import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().default(3000),

  MONGODB_URI: Joi.string().uri().required(),

  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),

  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),

  COOKIE_SECRET: Joi.string().min(16).required(),

  CORS_ORIGIN: Joi.string().default('http://localhost:3001'),

  STORAGE_DRIVER: Joi.string().valid('local', 's3').default('local'),
  LOCAL_STORAGE_DIR: Joi.string().default('./uploads-data'),
  PUBLIC_API_URL: Joi.string().default('http://localhost:3000'),

  S3_ENDPOINT: Joi.string().when('STORAGE_DRIVER', {
    is: 's3',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  S3_REGION: Joi.string().default('us-east-1'),
  S3_BUCKET: Joi.string().when('STORAGE_DRIVER', {
    is: 's3',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  S3_ACCESS_KEY_ID: Joi.string().when('STORAGE_DRIVER', {
    is: 's3',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  S3_SECRET_ACCESS_KEY: Joi.string().when('STORAGE_DRIVER', {
    is: 's3',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  S3_FORCE_PATH_STYLE: Joi.boolean().default(true),
  S3_PUBLIC_ENDPOINT: Joi.string().optional(),

  TURN_SECRET: Joi.string().min(16).required(),
  TURN_URLS: Joi.string().default('stun:localhost:3478,turn:localhost:3478'),
  TURN_CREDENTIAL_TTL_SECONDS: Joi.number().default(300),
});
