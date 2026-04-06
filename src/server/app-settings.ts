import { cache } from "react";
import { getAllSettingsMap } from "./settings";

export const APP_TIMEZONE = "Europe/Belgrade";

function parseNumber(value: string | undefined | null) {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normalizeLogoUrl(url: string | undefined | null) {
  const s = String(url ?? "").trim();
  if (!s) return "";
  const driveMatch = s.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (driveMatch?.[1]) return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
  const openMatch = s.match(/drive\.google\.com\/open\?id=([^&]+)/i);
  if (openMatch?.[1]) return `https://lh3.googleusercontent.com/d/${openMatch[1]}`;
  const ucMatch = s.match(/drive\.google\.com\/uc\?[^#]*id=([^&]+)/i);
  if (ucMatch?.[1]) return `https://lh3.googleusercontent.com/d/${ucMatch[1]}`;
  const idMatch = s.match(/[?&]id=([^&]+)/i);
  if (idMatch?.[1]) return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
  return s;
}

export type AppSettings = {
  AppTitle: string;
  AppSubtitle: string;
  LogoUrl: string;
  LogoVersion: string;
  HomeOfficeLimit: number;
  AnnualLeaveDays: number;
  SeetingUpdateTime: number;
  MinDayActivtyDuration: number;
  MaxDayActivtyDuration: number;
  MaxActivitiesPerDay: number;
  AllowAncestorApprovalAbsence: number;
  AllowAncestorApprovalTasks: number;
  EmailFooterTask: string;
  EmailFooterLeave: string;
  PerformancePeriodMonths: number;
  PerformanceSelfReviewStartDays: number;
  PerformanceSelfReviewDeadlineDays: number;
  PerformanceReminderDay: string;
  PerformanceReminderHour: number;
  PerformanceReminderMinute: number;
  PerformancePersonalWeight: number;
  PerformanceGoalsWeight: number;
  PerformanceManagerLockDays: number;
  PerformanceFinalConfirmDays: number;
  PerformanceCriticalDays: number;
  PerformanceAllowCloseBeforePeriodEnd: number;
};

export const getAppSettings = cache(async (): Promise<AppSettings> => {
  const map = await getAllSettingsMap();

  const title = map.AppTitle?.trim() || "VLAH ENTERPRISE EMPLOYER SYSTEM";
  const subtitle = map.AppSubtitle?.trim() || "";

  const logoRaw =
    map.LogoUrl || map.Logo_link || map.LogoLink || map.LogoURL || map.Logo || map.logo || "";
  const logoUrl = normalizeLogoUrl(logoRaw);

  const logoVersion = map.LogoVersion?.trim() || "";

  const homeOfficeLimit = parseNumber(map.HomeOfficeLimit) ?? 0;
  const annualLeaveDays = parseNumber(map.AnnualLeaveDays) ?? 0;

  const seetingUpdateTime = parseNumber(map.SeetingUpdateTime) ?? 10;

  const minDayActivtyDuration = parseNumber(map.MinDayActivtyDuration) ?? 1;
  const maxDayActivtyDuration = parseNumber(map.MaxDayActivtyDuration) ?? 20;
  const maxActivitiesPerDay = Math.floor(parseNumber(map.MaxActivitiesPerDay) ?? 20);

  const allowAncestorApprovalAbsence = Math.floor(parseNumber(map.AllowAncestorApprovalAbsence) ?? 1);
  const allowAncestorApprovalTasks = Math.floor(parseNumber(map.AllowAncestorApprovalTasks) ?? 1);

  const emailFooterTask =
    map.EmailFooterTask?.trim() || "This email is an automated notification from the Task Manager app.";
  const emailFooterLeave =
    map.EmailFooterLeave?.trim() || "This email is an automated notification from the Absence system.";

  const performancePeriodMonths = Math.floor(parseNumber(map.PerformancePeriodMonths) ?? 3);
  const performanceSelfReviewStartDays = Math.floor(parseNumber(map.PerformanceSelfReviewStartDays) ?? 20);
  const performanceSelfReviewDeadlineDays = Math.floor(parseNumber(map.PerformanceSelfReviewDeadlineDays) ?? 10);
  const performanceReminderDay = map.PerformanceReminderDay?.trim() || "MON";
  const performanceReminderHour = Math.floor(parseNumber(map.PerformanceReminderHour) ?? 9);
  const performanceReminderMinute = Math.floor(parseNumber(map.PerformanceReminderMinute) ?? 0);
  const performancePersonalWeight = parseNumber(map.PerformancePersonalWeight) ?? 30;
  const performanceGoalsWeight = parseNumber(map.PerformanceGoalsWeight) ?? 70;
  const performanceManagerLockDays = Math.floor(parseNumber(map.PerformanceManagerLockDays) ?? 5);
  const performanceFinalConfirmDays = Math.floor(parseNumber(map.PerformanceFinalConfirmDays) ?? 5);
  const performanceCriticalDays = Math.floor(parseNumber(map.PerformanceCriticalDays) ?? 3);
  const performanceAllowCloseBeforePeriodEnd = Math.floor(parseNumber(map.PerformanceAllowCloseBeforePeriodEnd) ?? 1);

  return {
    AppTitle: title,
    AppSubtitle: subtitle,
    LogoUrl: logoUrl && logoVersion ? `${logoUrl}?v=${encodeURIComponent(logoVersion)}` : logoUrl,
    LogoVersion: logoVersion,
    HomeOfficeLimit: homeOfficeLimit,
    AnnualLeaveDays: annualLeaveDays,
    SeetingUpdateTime: seetingUpdateTime,
    MinDayActivtyDuration: minDayActivtyDuration,
    MaxDayActivtyDuration: maxDayActivtyDuration,
    MaxActivitiesPerDay: maxActivitiesPerDay,
    AllowAncestorApprovalAbsence: allowAncestorApprovalAbsence,
    AllowAncestorApprovalTasks: allowAncestorApprovalTasks,
    EmailFooterTask: emailFooterTask,
    EmailFooterLeave: emailFooterLeave,
    PerformancePeriodMonths: performancePeriodMonths,
    PerformanceSelfReviewStartDays: performanceSelfReviewStartDays,
    PerformanceSelfReviewDeadlineDays: performanceSelfReviewDeadlineDays,
    PerformanceReminderDay: performanceReminderDay,
    PerformanceReminderHour: performanceReminderHour,
    PerformanceReminderMinute: performanceReminderMinute,
    PerformancePersonalWeight: performancePersonalWeight,
    PerformanceGoalsWeight: performanceGoalsWeight,
    PerformanceManagerLockDays: performanceManagerLockDays,
    PerformanceFinalConfirmDays: performanceFinalConfirmDays,
    PerformanceCriticalDays: performanceCriticalDays,
    PerformanceAllowCloseBeforePeriodEnd: performanceAllowCloseBeforePeriodEnd
  };
});
