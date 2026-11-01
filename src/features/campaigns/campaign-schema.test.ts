import { describe, expect, it } from "vitest";
import {
  activitySchema,
  campaignSchema,
  isCampaignOpen,
} from "./campaign-schema";

describe("campaignSchema", () => {
  const campaign = {
    name: "Campanha Estadual",
    startsAt: "2026-01-01",
    endsAt: "2026-12-31",
    active: true,
  };

  it("accepts a valid campaign", () => {
    expect(campaignSchema.safeParse(campaign).success).toBe(true);
  });

  it("rejects an end date earlier than the start date", () => {
    expect(
      campaignSchema.safeParse({
        ...campaign,
        startsAt: "2026-12-01",
        endsAt: "2026-01-01",
      }).success,
    ).toBe(false);
  });
});

describe("activitySchema", () => {
  const activity = {
    campaignId: "11111111-1111-4111-8111-111111111111",
    name: "Ação solidária",
    description: "Descrição da atividade",
    points: 10,
    dueAt: "2026-11-30T23:59:00.000Z",
    multipleSubmissions: false,
  };

  it("accepts valid activity data", () => {
    expect(activitySchema.safeParse(activity).success).toBe(true);
  });

  it("rejects fractional and negative points", () => {
    expect(activitySchema.safeParse({ ...activity, points: 2.5 }).success).toBe(
      false,
    );
    expect(activitySchema.safeParse({ ...activity, points: -1 }).success).toBe(
      false,
    );
  });

  it("accepts an activity configured for unlimited chapter submissions", () => {
    expect(
      activitySchema.safeParse({
        ...activity,
        multipleSubmissions: true,
      }).success,
    ).toBe(true);
  });
});

describe("isCampaignOpen", () => {
  const campaignBase = {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Campaign",
    starts_at: null,
    ends_at: null,
    active: true,
    activities: [],
  };

  it("respects active state and campaign date boundaries", () => {
    expect(isCampaignOpen(campaignBase, "2026-10-30")).toBe(true);
    expect(
      isCampaignOpen({ ...campaignBase, active: false }, "2026-10-30"),
    ).toBe(false);
    expect(
      isCampaignOpen(
        { ...campaignBase, starts_at: "2026-11-01" },
        "2026-10-30",
      ),
    ).toBe(false);
    expect(
      isCampaignOpen({ ...campaignBase, ends_at: "2026-10-29" }, "2026-10-30"),
    ).toBe(false);
  });
});
