/**
 * Authentication schemas for login forms
 */

import * as z from 'zod';

// Schema for colleague access code login
export const colleagueLoginSchema = z.object({
  accessCode: z
    .string()
    .min(1, 'Access code is required')
    .min(4, 'Access code must be at least 4 characters')
    .max(50, 'Access code must not exceed 50 characters'),
});

// Schema for admin login
export const adminLoginSchema = z.object({
  username: z
    .string()
    .min(1, 'Username is required')
    .min(2, 'Username must be at least 2 characters')
    .max(50, 'Username must not exceed 50 characters'),
});

// Combined login form schema
export const loginFormSchema = z.object({
  accessCode: z
    .string()
    .min(4, 'Access code must be at least 4 characters')
    .max(50, 'Access code must not exceed 50 characters'),
  turnstileToken: z.string().optional(), // Optional for graceful degradation
});

// Type exports
export type ColleagueLoginSchema = z.infer<typeof colleagueLoginSchema>;
export type AdminLoginSchema = z.infer<typeof adminLoginSchema>;
export type LoginFormSchema = z.infer<typeof loginFormSchema>;
