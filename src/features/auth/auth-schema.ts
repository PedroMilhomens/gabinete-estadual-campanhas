import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().trim().email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe sua senha.'),
})

export const signupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Informe seu nome completo.')
    .max(120, 'O nome deve ter no máximo 120 caracteres.'),
  email: z.string().trim().email('Informe um e-mail válido.'),
  password: z
    .string()
    .min(10, 'A senha deve ter pelo menos 10 caracteres.'),
  chapterNumber: z
    .number()
    .int('Informe o número do capítulo.')
    .positive('Informe um número de capítulo válido.'),
  position: z
    .string()
    .trim()
    .min(2, 'Informe seu cargo no capítulo.')
    .max(80, 'O cargo deve ter no máximo 80 caracteres.'),
  termsAccepted: z.boolean().refine((accepted) => accepted, {
    message: 'É necessário aceitar os termos para continuar.',
  }),
  guardianConsent: z.boolean(),
})

export const profileSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string(),
  chapter_id: z.string().uuid().nullable(),
  role: z.enum(['member', 'reviewer', 'admin']),
  status: z.enum(['pending', 'approved', 'rejected']),
})

export const signupChaptersSchema = z.array(
  z.object({
    id: z.string().uuid(),
    name: z.string(),
    number: z.number().int(),
  }),
)

export type LoginFormValues = z.infer<typeof loginSchema>
export type SignupFormValues = z.infer<typeof signupSchema>
export type UserProfile = z.infer<typeof profileSchema>
