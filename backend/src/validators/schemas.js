import { z } from 'zod';

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(120),
  email: z.string().trim().email('Valid email address required').toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  phone: z.string().trim().min(8, 'Valid mobile number required').max(20).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Valid email required').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Valid email required').toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Valid reset token required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(100),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(100),
});

export const enquirySchema = z.object({
  fullName: z.string().trim().min(2, 'Full name required').max(120),
  email: z.string().trim().email('Valid email required').toLowerCase(),
  mobileNumber: z.string().trim().min(8, 'Valid mobile number required').max(20),
  courseId: z.coerce.number().int().positive().optional().nullable(),
  courseInterest: z.string().trim().min(2, 'Course interest required').max(200),
  learningPreference: z.string().trim().min(2).max(80).default('Live Online Cohort'),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(2000),
});

export const admissionSchema = z.object({
  courseId: z.coerce.number().int().positive('Please select a valid course'),
  fullName: z.string().trim().min(2, 'Full name required').max(120),
  email: z.string().trim().email('Valid email required').toLowerCase(),
  mobileNumber: z.string().trim().min(8, 'Valid mobile number required').max(20),
  whatsappNumber: z.string().trim().min(8, 'Valid WhatsApp number required').max(20),
  collegeName: z.string().trim().min(2, 'College or organization name required').max(200),
  department: z.string().trim().min(2, 'Department required').max(120),
  yearOfStudy: z.string().trim().min(1, 'Year of study required').max(60),
  state: z.string().trim().min(2, 'State required').max(80),
  learningPreference: z.string().trim().min(2).max(80).default('Live Online Cohort'),
  paymentOption: z.enum(['ADVANCE', 'FULL']).default('ADVANCE'),
  message: z.string().trim().max(1500).optional().nullable(),
});

export const courseUpsertSchema = z.object({
  title: z.string().trim().min(4).max(200),
  slug: z.string().trim().min(3).max(220).optional(),
  shortSummary: z.string().trim().min(10).max(400),
  description: z.string().trim().min(20).max(5000),
  categoryId: z.coerce.number().int().positive(),
  instructorId: z.coerce.number().int().positive().optional().nullable(),
  thumbnailUrl: z.string().trim().min(3),
  technologies: z.array(z.string().trim().min(1)).min(1),
  skillLevel: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  duration: z.string().trim().min(2).max(50),
  durationWeeks: z.coerce.number().int().min(1).max(104).default(12),
  courseFee: z.coerce.number().int().min(1000),
  advanceAmount: z.coerce.number().int().min(500),
  learningOutcomes: z.array(z.string().trim().min(3)).min(1),
  internshipAvailable: z.boolean().default(true),
  internshipDetails: z.string().trim().max(1000).optional().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('PUBLISHED'),
  featured: z.boolean().default(false),
  liveSessionInfo: z.string().trim().max(300).optional().nullable(),
});
