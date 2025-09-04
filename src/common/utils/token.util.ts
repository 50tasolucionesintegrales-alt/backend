import { randomInt } from 'crypto';

export const generateRandomToken = (digits = 6): string => {
  const min = 10 ** (digits - 1); // 100000
  const max = 10 ** digits; // 1000000
  return randomInt(min, max).toString();
};
