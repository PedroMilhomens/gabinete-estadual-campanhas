import { z } from "zod";

const nullableDate = z
  .union([z.iso.date(), z.literal("")])
  .transform((value) => (value === "" ? null : value));

export const campaignSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Informe o nome da campanha.")
      .max(160, "O nome deve ter no máximo 160 caracteres."),
    startsAt: nullableDate,
    endsAt: nullableDate,
    active: z.boolean(),
  })
  .refine(
    ({ startsAt, endsAt }) => !startsAt || !endsAt || startsAt <= endsAt,
    {
      message: "A data final deve ser igual ou posterior à data inicial.",
      path: ["endsAt"],
    },
  );

export const activitySchema = z.object({
  campaignId: z.string().uuid(),
  name: z
    .string()
    .trim()
    .min(2, "Informe o nome da atividade.")
    .max(160, "O nome deve ter no máximo 160 caracteres."),
  description: z
    .string()
    .trim()
    .max(2000, "A descrição deve ter no máximo 2.000 caracteres."),
  points: z.number().int("Informe pontos inteiros.").min(0),
  dueAt: z.union([z.iso.datetime(), z.literal("")]),
  multipleSubmissions: z.boolean(),
});

export type CampaignFormValues = z.input<typeof campaignSchema>;
export type ActivityFormValues = z.input<typeof activitySchema>;

export const activityRecordSchema = z.object({
  id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  points: z.number().int().nullable(),
  due_at: z.string().nullable(),
  multiple_submissions: z.boolean(),
});

export const campaignRecordSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  starts_at: z.string().nullable(),
  ends_at: z.string().nullable(),
  active: z.boolean(),
  activities: z.array(activityRecordSchema),
});

export type Campaign = z.infer<typeof campaignRecordSchema>;
export type Activity = z.infer<typeof activityRecordSchema>;

export function isCampaignOpen(campaign: Campaign, today: string) {
  return (
    campaign.active &&
    (!campaign.starts_at || campaign.starts_at <= today) &&
    (!campaign.ends_at || campaign.ends_at >= today)
  );
}
