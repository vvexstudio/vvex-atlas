import { FestivalEvent } from "@/types/festival";

/**
 * Retrieves the configured support/inquiry email address from environment variables.
 */
export function getSupportEmail(): string {
  return (process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "").trim();
}

/**
 * Builds formatted event details string for emails or copy-to-clipboard.
 */
export function getEventReportDetails(event: FestivalEvent): { subject: string; body: string; plainText: string } {
  const subject = `[Portal ROS Report] Issue with: ${event.title}`;

  const details = [
    `Event Title: ${event.title}`,
    `Date: ${event.scheduleDate || "Unscheduled / TBD"}`,
    `Time: ${event.startTime || "N/A"} - ${event.endTime || "N/A"}`,
    `Location: ${event.locationName || "N/A"}`,
    `Lead Department: ${event.department || "N/A"}`,
    `Support Department(s): ${[event.supportDept1, event.supportDept2].filter(Boolean).join(", ") || "None"}`,
    `Lead Person: ${event.leadPointPerson || "N/A"}`,
    `Support Person(s): ${[event.supportPerson1, event.supportPerson2].filter(Boolean).join(", ") || "None"}`,
    `Action Category: ${event.action || "N/A"}`,
    `Event ID: ${event.id}`,
  ].join("\n");

  const body = `Hi Support Team,

I would like to report an issue or inquiry regarding the following event:

--- EVENT DETAILS ---
${details}

--- ISSUE / FEEDBACK DETAILS ---
[Please describe the issue, discrepancy, or requested update here]

---
Sent from Vvexplore App`;

  const plainText = `${subject}\n\n${details}`;

  return { subject, body, plainText };
}

/**
 * Builds a formatted mailto URL for reporting an issue about a specific event.
 */
export function buildEventSupportMailto(event: FestivalEvent): string {
  const supportEmail = getSupportEmail();
  const { subject, body } = getEventReportDetails(event);
  return `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Builds a direct Gmail webmail compose URL for reporting an issue about a specific event.
 */
export function buildEventSupportGmailUrl(event: FestivalEvent): string {
  const supportEmail = getSupportEmail();
  const { subject, body } = getEventReportDetails(event);
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${supportEmail}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Builds a general support/inquiry mailto URL when no specific event is selected.
 */
export function buildGeneralSupportMailto(): string {
  const supportEmail = getSupportEmail();
  const subject = `[Portal ROS Inquiry] Support Request / Feedback`;

  const body = `Hi Support Team,

I have an inquiry or would like to report an issue regarding Vvexplore App:

--- DETAILS ---
[Please describe your request, issue, or feedback here]

---
Sent from Vvexplore App`;

  return `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Builds a direct Gmail webmail compose URL for general support.
 */
export function buildGeneralSupportGmailUrl(): string {
  const supportEmail = getSupportEmail();
  const subject = `[Portal ROS Inquiry] Support Request / Feedback`;

  const body = `Hi Support Team,

I have an inquiry or would like to report an issue regarding Vvexplore App:

--- DETAILS ---
[Please describe your request, issue, or feedback here]

---
Sent from Vvexplore App`;

  return `https://mail.google.com/mail/?view=cm&fs=1&to=${supportEmail}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
