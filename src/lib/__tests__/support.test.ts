import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getSupportEmail,
  buildEventSupportMailto,
  buildEventSupportGmailUrl,
  buildGeneralSupportMailto,
  buildGeneralSupportGmailUrl,
} from "../support";
import { FestivalEvent } from "@/types/festival";

describe("Support / Inquiry mailto and Gmail URL helper", () => {
  const originalEnv = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
    }
  });

  const mockEvent: FestivalEvent = {
    id: "evt-123",
    venueId: "main-plaza",
    title: "Stage Setup",
    host: "Rigging",
    description: "Setting up main stage trussing",
    day: "mon",
    startTime: "09:00",
    endTime: "11:00",
    type: "services",
    thumbnailUrl: "",
    scheduleDate: "2026-08-24",
    locationName: "Main Plaza",
    department: "Rigging",
    leadPointPerson: "Alice",
    action: "Setup",
  };

  it("should return empty string for getSupportEmail when environment variable is not set", () => {
    expect(getSupportEmail()).toBe("");
  });

  it("should return trimmed email for getSupportEmail when environment variable is set", () => {
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = "  support@theportal.is  ";
    expect(getSupportEmail()).toBe("support@theportal.is");
  });

  it("should generate event mailto link with empty email when env var is blank", () => {
    const mailto = buildEventSupportMailto(mockEvent);
    expect(mailto.startsWith("mailto:?subject=")).toBe(true);
    expect(mailto).toContain(encodeURIComponent("[Portal ROS Report] Issue with: Stage Setup"));
    expect(mailto).toContain(encodeURIComponent("Event Title: Stage Setup"));
    expect(mailto).toContain(encodeURIComponent("Location: Main Plaza"));
    expect(mailto).toContain(encodeURIComponent("Lead Department: Rigging"));
    expect(mailto).toContain(encodeURIComponent("Event ID: evt-123"));
  });

  it("should generate event mailto link with target support email when env var is set", () => {
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = "support@theportal.is";
    const mailto = buildEventSupportMailto(mockEvent);
    expect(mailto.startsWith("mailto:support@theportal.is?subject=")).toBe(true);
    expect(mailto).toContain(encodeURIComponent("Stage Setup"));
  });

  it("should generate direct Gmail webmail URL for events", () => {
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = "support@theportal.is";
    const gmailUrl = buildEventSupportGmailUrl(mockEvent);
    expect(gmailUrl.startsWith("https://mail.google.com/mail/?view=cm&fs=1&to=support@theportal.is")).toBe(true);
    expect(gmailUrl).toContain(encodeURIComponent("Stage Setup"));
  });

  it("should generate general support mailto link correctly", () => {
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = "help@theportal.is";
    const mailto = buildGeneralSupportMailto();
    expect(mailto.startsWith("mailto:help@theportal.is?subject=")).toBe(true);
    expect(mailto).toContain(encodeURIComponent("[Portal ROS Inquiry] Support Request / Feedback"));
  });

  it("should generate general Gmail webmail URL correctly", () => {
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = "help@theportal.is";
    const gmailUrl = buildGeneralSupportGmailUrl();
    expect(gmailUrl.startsWith("https://mail.google.com/mail/?view=cm&fs=1&to=help@theportal.is")).toBe(true);
  });
});
