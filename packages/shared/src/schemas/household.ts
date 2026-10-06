import { z } from '@hono/zod-openapi'
import { UuidSchema } from './common'

export const MemberRoleSchema = z.enum(['owner', 'member', 'viewer'])

export const CreateInvitationBodySchema = z
  .object({
    email: z.string().email().optional(),
    role: MemberRoleSchema.default('owner'),
    display_name_suggestion: z.string().min(1).max(60).optional(),
  })
  .openapi('CreateInvitationBody')

export const AcceptInvitationBodySchema = z
  .object({
    display_name: z.string().min(1).max(60),
    mode: z.enum(['fresh', 'merge']),
  })
  .openapi('AcceptInvitationBody')

export const UpdateMemberBodySchema = z
  .object({
    display_name: z.string().min(1).max(60).optional(),
    aliases: z.array(z.string()).optional(),
    color: z.string().optional(),
    role: MemberRoleSchema.optional(),
  })
  .openapi('UpdateMemberBody')

export const UpdateHouseholdSettingsBodySchema = z
  .object({
    default_account_visibility: z.enum(['shared', 'private']).optional(),
    owners_can_view_private_totals: z.boolean().optional(),
  })
  .openapi('UpdateHouseholdSettingsBody')

export const UpdateHouseholdBodySchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    timezone: z.string().optional(),
    settings: UpdateHouseholdSettingsBodySchema.optional(),
  })
  .openapi('UpdateHouseholdBody')

export const RemoveMemberQuerySchema = z.object({
  reassign_to_member_id: z.union([UuidSchema, z.literal('joint')]).optional(),
})
