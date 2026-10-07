import { z } from '@hono/zod-openapi'
import { UuidSchema } from './common'

export const BeneficiaryKindSchema = z.enum(['member', 'child', 'relative', 'property', 'other'])

export const BeneficiarySchema = z
  .object({
    id: UuidSchema,
    name: z.string(),
    kind: BeneficiaryKindSchema,
    member_id: UuidSchema.nullable(),
    aliases: z.array(z.string()),
    icon: z.string(),
    color: z.string(),
  })
  .openapi('Beneficiary')

export const CreateBeneficiaryBodySchema = z
  .object({
    name: z.string().min(1).max(60),
    kind: BeneficiaryKindSchema.default('other'),
    member: z.string().optional().openapi({ description: 'Nama/alias/uuid member, hanya kalau kind="member".' }),
    aliases: z.array(z.string()).default([]),
    icon: z.string().optional(),
    color: z.string().optional(),
  })
  .openapi('CreateBeneficiaryBody')

export const UpdateBeneficiaryBodySchema = z
  .object({
    name: z.string().min(1).max(60).optional(),
    aliases: z.array(z.string()).optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
  })
  .openapi('UpdateBeneficiaryBody')

/** Referensi beneficiary: beneficiary_id (UUID) ATAU beneficiary (nama manusia). Keduanya opsional
 * (beda dari AccountRefSchema/CategoryRefSchema) — beneficiary memang boleh kosong = bersama. */
export const BeneficiaryRefSchema = z.object({
  beneficiary_id: UuidSchema.optional(),
  beneficiary: z.string().min(1).optional(),
})
