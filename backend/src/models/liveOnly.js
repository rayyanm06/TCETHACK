import { ENV } from '../config/env.js';
export function liveOnly(schema) {
  schema.pre(/^find/, function () { if (!ENV.DEMO_MODE) this.where({isSeed: {$ne: true}}); });
  schema.pre('countDocuments', function () { if (!ENV.DEMO_MODE) this.where({isSeed: {$ne: true}}); });
}
