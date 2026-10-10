/**
 * Owner WhatsApp chatbot router.
 * Responds to owner inquiries with live mill metrics, loom breakdowns,
 * electricity bills (1 Week / 1 Month), salary expenses, and order plans.
 */

import { todayIso } from "@/lib/dates";
import { dailySummaryText, planOrderText } from "@/lib/reports";
import {
  ownerWelcomeOverview,
  ownerMachineStatusDetails,
  ownerElectricityDetails,
  ownerSalaryDetails,
  ownerAtRiskDetails,
} from "./owner-reports";

/** Turns an incoming owner message into the reply text. */
export async function handleOwnerMessage(text: string): Promise<string> {
  const message = text.trim().toLowerCase().replace(/\s+/g, " ");
  const today = todayIso();

  // 1. Greetings & main menu: "hi", "hii", "hello", "hey", "vanakkam", "menu", "status"
  if (
    message === "hi" ||
    message === "hii" ||
    message === "hiii" ||
    message === "hello" ||
    message === "hey" ||
    message === "vanakkam" ||
    message === "menu" ||
    message === "start" ||
    message === "status" ||
    message === "overview"
  ) {
    return ownerWelcomeOverview(today);
  }

  // 2. Machine & Loom Status: "1", "machine", "machines", "loom", "looms"
  if (
    message === "1" ||
    message.startsWith("machine") ||
    message.startsWith("loom") ||
    message.startsWith("breakdown")
  ) {
    return ownerMachineStatusDetails();
  }

  // 3. Electricity & Current Bill: "2", "2w", "2m", "2t", "electricity", "bill", "power"
  if (
    message === "2w" ||
    message === "2 week" ||
    message === "week bill" ||
    message === "weekly bill" ||
    message === "1 week bill" ||
    message.includes("week electricity")
  ) {
    return ownerElectricityDetails("week", today);
  }

  if (
    message === "2m" ||
    message === "2 month" ||
    message === "month bill" ||
    message === "monthly bill" ||
    message === "1 month bill" ||
    message.includes("month electricity")
  ) {
    return ownerElectricityDetails("month", today);
  }

  if (
    message === "2t" ||
    message === "2 today" ||
    message === "today bill" ||
    message === "today electricity"
  ) {
    return ownerElectricityDetails("today", today);
  }

  if (
    message === "2" ||
    message.startsWith("electricity") ||
    message.startsWith("current bill") ||
    message.startsWith("eb bill") ||
    message === "bill"
  ) {
    return ownerElectricityDetails("ask", today);
  }

  // 4. Salary & Labour Wages: "3", "3w", "3m", "3t", "salary", "wages", "labour"
  if (
    message === "3w" ||
    message === "3 week" ||
    message === "week salary" ||
    message === "weekly wages" ||
    message === "1 week salary"
  ) {
    return ownerSalaryDetails("week", today);
  }

  if (
    message === "3m" ||
    message === "3 month" ||
    message === "month salary" ||
    message === "monthly wages" ||
    message === "1 month salary" ||
    message === "payroll"
  ) {
    return ownerSalaryDetails("month", today);
  }

  if (
    message === "3t" ||
    message === "3 today" ||
    message === "today salary" ||
    message === "today wages"
  ) {
    return ownerSalaryDetails("today", today);
  }

  if (
    message === "3" ||
    message.startsWith("salary") ||
    message.startsWith("wage") ||
    message.startsWith("labour") ||
    message.startsWith("labor")
  ) {
    return ownerSalaryDetails("ask", today);
  }

  // 5. Order Planning: "4", "4 ORD-1005", "plan order ORD-1005"
  const planMatch = message.match(/^(?:4 |plan order |plan )\s*([a-z0-9-]+)$/);
  if (planMatch) {
    const raw = planMatch[1]!;
    const orderNo = raw.startsWith("ord") ? raw.toUpperCase() : `ORD-${raw}`;
    return planOrderText(orderNo, today);
  }
  if (message === "4" || message === "plan order") {
    return "Send: *4 <orderNo>*, e.g. *4 ORD-1005* to simulate loom allocation & cost.";
  }

  // 6. At-risk orders: "5", "at risk", "at-risk"
  if (message === "5" || message.startsWith("at risk") || message.startsWith("at-risk")) {
    return ownerAtRiskDetails(today);
  }

  // 7. Full summary report: "6", "summary"
  if (message === "6" || message.startsWith("summary")) {
    return dailySummaryText(today);
  }

  // Default fallback: show today's welcome overview
  return ownerWelcomeOverview(today);
}
