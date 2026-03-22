import Link from "next/link";
import { requireActiveUser } from "@/server/current-user";
import UserMenu from "./UserMenu";
import { getRequestLang } from "@/i18n/server";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconBriefcase,
  IconCalendar,
  IconCheckCircle,
  IconClock,
  IconInbox,
  IconReport,
  IconSettings,
  IconSparkles,
  IconTasks,
  IconUsers
} from "@/components/icons";
import { getHomeDashboard } from "@/server/home";
import { hasAccessAdmin, hasHrAddon, isManagerRole } from "@/server/rbac";
import { LabelWithTooltip } from "@/components/Tooltip";

type DashboardIcon = typeof IconTasks;

type SummaryCard = {
  value: string;
  label: string;
  detail: string;
  icon: DashboardIcon;
  tone?: "default" | "warning" | "success";
};

type VisibilityRow = {
  label: string;
  value: string;
  detail?: string;
};

type QuickAction = {
  href: string;
  label: string;
  icon: DashboardIcon;
};

function getDashboardCopy(lang: "sr" | "en") {
  if (lang === "sr") {
    return {
      hero: {
        userTitle: "Danas znaš tačno šta je važno.",
        userText: "Jedan jasan pregled zadataka, dnevnog izveštaja, odsustava i stvari koje čekaju tebe.",
        managerTitle: "Tim, odobrenja i blokeri na jednom mestu.",
        managerText: "Fokus na stvari koje traže tvoju odluku, šta kasni i gde timu treba tvoja reakcija.",
        hrTitle: "HR tok bez lutanja između više ekrana.",
        hrText: "Otvoreni zahtevi, kandidati po fazama i onboarding koraci koji traže sledeći potez.",
        adminTitle: "Podešavanja i pristupi pod kontrolom.",
        adminText: "Kratak operativni pregled za sistemske izmene, pristupe i važna upozorenja."
      },
      quickActionsTitle: "Brze akcije",
      focusTitle: "Današnji fokus",
      focusTooltip:
        "Ovo su najvažnije stvari za tvoju ulogu danas. Ideja je da odmah vidiš gde treba da uđeš i reaguješ.",
      actionCenterTitle: "Akcioni centar",
      actionCenterTooltip:
        "Najbitnije stavke koje čekaju tvoju reakciju. Klik vodi pravo na tačan ekran ili zapis.",
      visibilityTitle: "Brzi pregled",
      visibilityTooltip:
        "Kratak operativni pregled bez pretrpavanja analitikom — samo ono što ti pomaže u radu danas.",
      workspaceTitle: "Glavni moduli",
      workspaceText: "Osnovni tokovi rada koje koristiš svakodnevno.",
      accessTitle: "Dodatni pristupi",
      accessText: "Moduli koje vidiš jer imaš managerski, HR ili admin pristup.",
      open: "Otvori",
      noActions: "Trenutno nema hitnih stavki.",
      viewInbox: "Idi na inbox",
      summary: {
        todayTasks: "Današnji zadaci",
        overdue: "Kasni",
        todayReport: "Današnji izveštaj",
        needsAction: "Čeka tebe",
        teamApprovals: "Čeka odobrenje",
        teamOverdue: "Kasni u timu",
        missingReports: "Fale izveštaji",
        openHiring: "Otvorene pozicije",
        hrReady: "Spremno za HR",
        hrScreening: "HR screening",
        hrRoundTwo: "Runda 2",
        hrApproved: "Spremno za onboarding",
        accessReady: "Admin pristup",
        settingsReady: "Podešavanja",
        reportDone: "Predato",
        reportMissing: "Nedostaje",
        reportMinutes: (minutes: string) => `Uneto: ${minutes}`,
        reportHint: "Status današnjeg unosa",
        actionHint: "Otvorene stvari koje traže reakciju",
        adminHint: "Podešavanja i pristupi su aktivni",
        settingsHint: "Sistemski rečnici i podrazumevane vrednosti"
      },
      focus: {
        userTasks: "Završavanje zadataka",
        userTasksText: "Ažuriraj rad koji je za danas ili kasni.",
        userReports: "Dnevni izveštaj",
        userReportsText: "Sačuvaj ili proveri današnji unos aktivnosti.",
        userAbsence: "Plan odsustava",
        userAbsenceText: "Proveri stanje dana i ko je iz tima odsutan.",
        managerApprovals: "Tvoja odobrenja",
        managerApprovalsText: "Task i absence stavke koje ne treba da čekaju.",
        managerReports: "Disciplina izveštavanja",
        managerReportsText: "Brzo vidi ko još nije predao izveštaj danas.",
        managerHiring: "Aktivni hiring",
        managerHiringText: "Otvorene pozicije i procesi koji traže odluku.",
        hrRequests: "Ulaz u HR proces",
        hrRequestsText: "Zahtevi koji su odobreni i spremni za obradu.",
        hrCandidates: "Kandidati u toku",
        hrCandidatesText: "Pomeri kandidate ka sledećoj fazi bez zastoja.",
        hrOnboarding: "Onboarding pažnja",
        hrOnboardingText: "Prati šta kasni i šta mora da krene.",
        adminAccess: "Pristupi i uloge",
        adminAccessText: "Drži dodele timova, menadžera i dodatnih pristupa ažurnim.",
        adminSettings: "Sistemske vrednosti",
        adminSettingsText: "Podešavanja, rečnici i podrazumevani linkovi na jednom mestu.",
        adminInbox: "Sistemske reakcije",
        adminInboxText: "Ako nešto traži odgovor, ovde to odmah vidiš."
      },
      visibility: {
        absenceBalance: "Preostala odsustva",
        absenceBalanceDetail: (annual: number, homeOffice: number) =>
          `${annual} godišnji · ${homeOffice} home office`,
        teamAway: "Ko je odsutan danas",
        noneAway: "Niko nije odsutan",
        onboarding: "Aktivan onboarding",
        onboardingNone: "Nema aktivnog onboardinga",
        teamPendingAbsences: "Zahtevi za odsustvo",
        teamPerformance: "Performanse tima",
        performanceDetail: (self: number, review: number, closed: number) =>
          `Čeka self: ${self} · čeka review: ${review} · zatvoreno: ${closed}`,
        missingReports: "Ko još nije predao izveštaj",
        missingReportsNone: "Svi iz tima su predali",
        hrPipeline: "Pipeline kandidata",
        hrPipelineDetail: (screening: number, roundTwo: number, finalRound: number) =>
          `Screening: ${screening} · runda 2: ${roundTwo} · finalna odluka: ${finalRound}`,
        talentPool: "Talent pool",
        talentPoolDetail: (count: number) => `${count} kandidata spremno za kasnije`,
        adminHelp: "Admin alati",
        adminHelpDetail: "Settings i Access ostaju mesto za konfiguraciju, ne za dnevni rad."
      },
      quick: {
        inbox: "Inbox",
        tasks: "Moji zadaci",
        reports: "Dnevni izveštaji",
        absence: "Odsustva",
        management: "Management Panel",
        hr: "HR System",
        candidates: "Kandidati",
        access: "Access",
        settings: "Settings",
        onboarding: "Onboarding"
      }
    };
  }

  return {
    hero: {
      userTitle: "Know exactly what matters today.",
      userText: "One clear place for tasks, daily reporting, absence visibility, and items waiting on you.",
      managerTitle: "Team, approvals, and blockers in one place.",
      managerText: "Focus on decisions, late work, and where your team needs action from you.",
      hrTitle: "HR workflow without bouncing between screens.",
      hrText: "Approved requests, candidates by phase, and onboarding steps that need the next move.",
      adminTitle: "Settings and access under control.",
      adminText: "A short operational view for system changes, permissions, and anything that needs attention."
    },
    quickActionsTitle: "Quick actions",
    focusTitle: "Today focus",
    focusTooltip:
      "These are the most important items for your role right now, so you can enter the right module immediately.",
    actionCenterTitle: "Action center",
    actionCenterTooltip:
      "Most important items waiting on you. Each row opens the exact page or record you need.",
    visibilityTitle: "At a glance",
    visibilityTooltip:
      "Short operational context without analytics noise — only the information that helps you act faster today.",
    workspaceTitle: "Core workspace",
    workspaceText: "Primary modules used in everyday operations.",
    accessTitle: "Extended access",
    accessText: "Additional modules unlocked by manager, HR, or admin access.",
    open: "Open",
    noActions: "No urgent items right now.",
    viewInbox: "Open inbox",
    summary: {
      todayTasks: "Today tasks",
      overdue: "Overdue",
      todayReport: "Today report",
      needsAction: "Needs action",
      teamApprovals: "Waiting approval",
      teamOverdue: "Team overdue",
      missingReports: "Missing reports",
      openHiring: "Open hiring",
      hrReady: "Ready for HR",
      hrScreening: "HR screening",
      hrRoundTwo: "Round 2",
      hrApproved: "Ready for onboarding",
      accessReady: "Admin access",
      settingsReady: "Settings",
      reportDone: "Submitted",
      reportMissing: "Missing",
      reportMinutes: (minutes: string) => `Logged: ${minutes}`,
      reportHint: "Status of today’s report",
      actionHint: "Open items waiting on you",
      adminHint: "Permissions and access are available",
      settingsHint: "System defaults and dictionaries"
    },
    focus: {
      userTasks: "Finish work",
      userTasksText: "Update anything due today or already late.",
      userReports: "Daily reporting",
      userReportsText: "Save or review today’s activity entry.",
      userAbsence: "Plan availability",
      userAbsenceText: "Check remaining days and who from the team is away.",
      managerApprovals: "Your approvals",
      managerApprovalsText: "Task and absence items that should not wait.",
      managerReports: "Reporting discipline",
      managerReportsText: "See right away who still has not submitted today.",
      managerHiring: "Active hiring",
      managerHiringText: "Open positions and requests that need a decision.",
      hrRequests: "HR intake",
      hrRequestsText: "Approved requests that are ready for HR work.",
      hrCandidates: "Candidates in motion",
      hrCandidatesText: "Move candidates forward without losing momentum.",
      hrOnboarding: "Onboarding attention",
      hrOnboardingText: "See what is delayed and what needs to start next.",
      adminAccess: "Roles and access",
      adminAccessText: "Keep teams, managers, and extra access assignments aligned.",
      adminSettings: "System defaults",
      adminSettingsText: "Settings, dictionaries, and Drive defaults in one place.",
      adminInbox: "System follow-up",
      adminInboxText: "If something needs a response, you should see it here first."
    },
    visibility: {
      absenceBalance: "Absence balance",
      absenceBalanceDetail: (annual: number, homeOffice: number) => `${annual} annual · ${homeOffice} home office`,
      teamAway: "Who is away today",
      noneAway: "Nobody is away today",
      onboarding: "Active onboarding",
      onboardingNone: "No active onboarding",
      teamPendingAbsences: "Pending absence requests",
      teamPerformance: "Team performance",
      performanceDetail: (self: number, review: number, closed: number) =>
        `Waiting self: ${self} · waiting review: ${review} · closed: ${closed}`,
      missingReports: "Who still missed reporting",
      missingReportsNone: "Everyone on the team submitted",
      hrPipeline: "Candidate pipeline",
      hrPipelineDetail: (screening: number, roundTwo: number, finalRound: number) =>
        `Screening: ${screening} · round 2: ${roundTwo} · final decision: ${finalRound}`,
      talentPool: "Talent pool",
      talentPoolDetail: (count: number) => `${count} candidates ready for future reuse`,
      adminHelp: "Admin workspace",
      adminHelpDetail: "Settings and Access stay focused on configuration, not daily HR work."
    },
    quick: {
      inbox: "Inbox",
      tasks: "My tasks",
      reports: "Daily reports",
      absence: "Absence",
      management: "Management Panel",
      hr: "HR System",
      candidates: "Candidates",
      access: "Access",
      settings: "Settings",
      onboarding: "Onboarding"
    }
  };
}

function getHeroContent(copy: ReturnType<typeof getDashboardCopy>, mode: Awaited<ReturnType<typeof getHomeDashboard>>["mode"]) {
  if (mode === "manager") return { title: copy.hero.managerTitle, text: copy.hero.managerText };
  if (mode === "hr") return { title: copy.hero.hrTitle, text: copy.hero.hrText };
  if (mode === "admin") return { title: copy.hero.adminTitle, text: copy.hero.adminText };
  return { title: copy.hero.userTitle, text: copy.hero.userText };
}

function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes}m`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function getTeamPerformanceCount(
  rows: Array<{ status: string; _count: { _all: number } }>,
  status: string
) {
  return rows.find((item) => item.status === status)?._count._all ?? 0;
}

function formatOnboardingStatus(status: string | null | undefined, lang: "sr" | "en") {
  if (!status) return lang === "sr" ? "Nema aktivnog onboardinga" : "No active onboarding";
  const map = {
    PLANNED: lang === "sr" ? "Planiran" : "Planned",
    ACTIVE: lang === "sr" ? "Aktivan" : "Active",
    WAITING_EMPLOYEE_ACTIONS: lang === "sr" ? "Čeka zaposlenog" : "Waiting employee",
    WAITING_MANAGER_ACTIONS: lang === "sr" ? "Čeka menadžera" : "Waiting manager",
    WAITING_HR_ACTIONS: lang === "sr" ? "Čeka HR" : "Waiting HR",
    COMPLETED: lang === "sr" ? "Završen" : "Completed"
  } as const;
  return map[status as keyof typeof map] ?? status;
}

function getSummaryCards({
  lang,
  copy,
  home
}: {
  lang: "sr" | "en";
  copy: ReturnType<typeof getDashboardCopy>;
  home: Awaited<ReturnType<typeof getHomeDashboard>>;
}): SummaryCard[] {
  if (home.mode === "manager") {
    return [
      {
        value: String(home.summary.inbox.totals.needsMyAction),
        label: copy.summary.needsAction,
        detail: copy.summary.actionHint,
        icon: IconCheckCircle
      },
      {
        value: String(home.summary.teamOverdueTasks),
        label: copy.summary.teamOverdue,
        detail: lang === "sr" ? "Zadaci u timu koji kasne." : "Late tasks across your team.",
        icon: IconAlertTriangle,
        tone: home.summary.teamOverdueTasks > 0 ? "warning" : "default"
      },
      {
        value: String(home.summary.missingReports.length),
        label: copy.summary.missingReports,
        detail: lang === "sr" ? "Ko još nije predao današnji izveštaj." : "Who still has not submitted today.",
        icon: IconReport,
        tone: home.summary.missingReports.length > 0 ? "warning" : "default"
      },
      {
        value: String(home.summary.teamOpenHiring),
        label: copy.summary.openHiring,
        detail: lang === "sr" ? "Aktivni zahtevi i otvorene pozicije." : "Active requests and open roles.",
        icon: IconBriefcase,
        tone: home.summary.teamOpenHiring > 0 ? "success" : "default"
      }
    ];
  }

  if (home.mode === "hr") {
    return [
      {
        value: String(home.summary.hrApprovedRequests),
        label: copy.summary.hrReady,
        detail: lang === "sr" ? "Zahtevi koje HR sada treba da obradi." : "Requests HR can start processing now.",
        icon: IconBriefcase
      },
      {
        value: String(home.summary.hrScreening),
        label: copy.summary.hrScreening,
        detail: lang === "sr" ? "Kandidati u prvom HR krugu." : "Candidates currently in HR screening.",
        icon: IconUsers
      },
      {
        value: String(home.summary.hrRoundTwo),
        label: copy.summary.hrRoundTwo,
        detail: lang === "sr" ? "Kandidati koji čekaju round 2." : "Candidates waiting round 2 action.",
        icon: IconClock
      },
      {
        value: String(home.summary.hrApprovedForHire),
        label: copy.summary.hrApproved,
        detail: lang === "sr" ? "Spremni da pređu u onboarding." : "Approved and ready for onboarding.",
        icon: IconCheckCircle,
        tone: home.summary.hrApprovedForHire > 0 ? "success" : "default"
      }
    ];
  }

  if (home.mode === "admin") {
    return [
      {
        value: String(home.summary.inbox.totals.needsMyAction),
        label: copy.summary.needsAction,
        detail: copy.summary.actionHint,
        icon: IconInbox
      },
      {
        value: lang === "sr" ? "AKTIVNO" : "LIVE",
        label: copy.summary.accessReady,
        detail: copy.summary.adminHint,
        icon: IconUsers,
        tone: "success"
      },
      {
        value: lang === "sr" ? "SPREMNO" : "READY",
        label: copy.summary.settingsReady,
        detail: copy.summary.settingsHint,
        icon: IconSettings
      },
      {
        value: home.summary.todayReport ? copy.summary.reportDone : copy.summary.reportMissing,
        label: copy.summary.todayReport,
        detail: home.summary.todayReport
          ? copy.summary.reportMinutes(formatMinutes(home.summary.todayReport.totalMinutes))
          : copy.summary.reportHint,
        icon: IconReport,
        tone: home.summary.todayReport ? "success" : "warning"
      }
    ];
  }

  return [
    {
      value: String(home.summary.todayTaskCount),
      label: copy.summary.todayTasks,
      detail: lang === "sr" ? "Aktivni zadaci koji su na tebi danas." : "Active tasks that matter today.",
      icon: IconTasks
    },
    {
      value: String(home.summary.overdueTaskCount),
      label: copy.summary.overdue,
      detail: lang === "sr" ? "Zadaci kojima treba povratak danas." : "Items that need attention first today.",
      icon: IconAlertTriangle,
      tone: home.summary.overdueTaskCount > 0 ? "warning" : "default"
    },
    {
      value: home.summary.todayReport ? copy.summary.reportDone : copy.summary.reportMissing,
      label: copy.summary.todayReport,
      detail: home.summary.todayReport
        ? copy.summary.reportMinutes(formatMinutes(home.summary.todayReport.totalMinutes))
        : copy.summary.reportHint,
      icon: IconReport,
      tone: home.summary.todayReport ? "success" : "warning"
    },
    {
      value: String(home.summary.inbox.totals.needsMyAction),
      label: copy.summary.needsAction,
      detail: copy.summary.actionHint,
      icon: IconInbox
    }
  ];
}

function getVisibilityRows({
  lang,
  copy,
  home,
  hasHrAccess,
  hasAdminAccess
}: {
  lang: "sr" | "en";
  copy: ReturnType<typeof getDashboardCopy>;
  home: Awaited<ReturnType<typeof getHomeDashboard>>;
  hasHrAccess: boolean;
  hasAdminAccess: boolean;
}): VisibilityRow[] {
  const awayNames = home.summary.teamAbsencesToday.map((item) => item.employee.name).filter(Boolean);
  const missingReportNames = home.summary.missingReports.map((item) => item.name).filter(Boolean);
  const performanceWaitingSelf = getTeamPerformanceCount(home.summary.teamPerformance, "OPEN");
  const performanceWaitingReview = getTeamPerformanceCount(home.summary.teamPerformance, "SELF_SUBMITTED");
  const performanceClosed = getTeamPerformanceCount(home.summary.teamPerformance, "CLOSED");

  if (home.mode === "manager") {
    return [
      {
        label: copy.visibility.teamAway,
        value: awayNames.length ? awayNames.slice(0, 3).join(", ") : copy.visibility.noneAway,
        detail: awayNames.length > 3 ? `+${awayNames.length - 3}` : undefined
      },
      {
        label: copy.visibility.teamPendingAbsences,
        value: String(home.summary.teamPendingAbsences),
        detail: lang === "sr" ? "Zahtevi koji čekaju odluku." : "Requests waiting for a decision."
      },
      {
        label: copy.visibility.missingReports,
        value: missingReportNames.length ? missingReportNames.slice(0, 3).join(", ") : copy.visibility.missingReportsNone,
        detail: missingReportNames.length > 3 ? `+${missingReportNames.length - 3}` : undefined
      },
      {
        label: copy.visibility.teamPerformance,
        value: lang === "sr" ? "Status kvartala" : "Quarter status",
        detail: copy.visibility.performanceDetail(performanceWaitingSelf, performanceWaitingReview, performanceClosed)
      }
    ];
  }

  if (home.mode === "hr") {
    return [
      {
        label: copy.visibility.hrPipeline,
        value: String(home.summary.hrScreening + home.summary.hrRoundTwo + home.summary.hrFinalRound),
        detail: copy.visibility.hrPipelineDetail(
          home.summary.hrScreening,
          home.summary.hrRoundTwo,
          home.summary.hrFinalRound
        )
      },
      {
        label: copy.visibility.onboarding,
        value: formatOnboardingStatus(home.summary.activeOnboarding?.status, lang),
        detail: home.summary.activeOnboarding?.employee?.name || home.summary.activeOnboarding?.candidate?.fullName || undefined
      },
      {
        label: copy.visibility.talentPool,
        value: String(home.summary.talentPoolCount),
        detail: copy.visibility.talentPoolDetail(home.summary.talentPoolCount)
      },
      {
        label: lang === "sr" ? "Onboarding koji kasni" : "Overdue onboarding",
        value: String(home.summary.hrOverdueOnboarding),
        detail: lang === "sr" ? "Stavke koje traže HR reakciju." : "Items that require HR follow-up."
      }
    ];
  }

  if (home.mode === "admin") {
    return [
      {
        label: copy.visibility.adminHelp,
        value: hasAdminAccess ? (lang === "sr" ? "Access + Settings" : "Access + Settings") : "—",
        detail: copy.visibility.adminHelpDetail
      },
      {
        label: copy.visibility.onboarding,
        value: formatOnboardingStatus(home.summary.activeOnboarding?.status, lang),
        detail: home.summary.activeOnboarding?.employee?.name || home.summary.activeOnboarding?.candidate?.fullName || undefined
      },
      {
        label: copy.visibility.teamAway,
        value: awayNames.length ? awayNames.slice(0, 3).join(", ") : copy.visibility.noneAway
      },
      {
        label: copy.summary.needsAction,
        value: String(home.summary.inbox.totals.needsMyAction),
        detail: lang === "sr" ? "Najbolji ulaz je kroz inbox." : "The inbox is the best entry point."
      }
    ];
  }

  const rows: VisibilityRow[] = [
    {
      label: copy.visibility.absenceBalance,
      value: copy.visibility.absenceBalanceDetail(
        home.summary.remaining.annualRemaining,
        home.summary.remaining.homeOfficeRemaining
      )
    },
    {
      label: copy.visibility.teamAway,
      value: awayNames.length ? awayNames.slice(0, 3).join(", ") : copy.visibility.noneAway,
      detail: awayNames.length > 3 ? `+${awayNames.length - 3}` : undefined
    },
    {
      label: copy.visibility.onboarding,
      value: formatOnboardingStatus(home.summary.activeOnboarding?.status, lang),
      detail: home.summary.activeOnboarding?.employee?.name || home.summary.activeOnboarding?.candidate?.fullName || copy.visibility.onboardingNone
    },
    {
      label: copy.summary.needsAction,
      value: String(home.summary.inbox.totals.needsMyAction),
      detail: lang === "sr" ? "Sve što te čeka vidiš i u inbox-u." : "Everything waiting on you is also available in the inbox."
    }
  ];

  if (hasHrAccess) {
    rows.push({
      label: copy.visibility.hrPipeline,
      value: String(home.summary.hrApprovedRequests),
      detail: copy.visibility.hrPipelineDetail(home.summary.hrScreening, home.summary.hrRoundTwo, home.summary.hrFinalRound)
    });
  }

  if (hasAdminAccess) {
    rows.push({
      label: copy.visibility.adminHelp,
      value: lang === "sr" ? "Podešavanja dostupna" : "Settings available",
      detail: copy.visibility.adminHelpDetail
    });
  }

  return rows.slice(0, 5);
}

function getQuickActions({
  home,
  copy,
  hasManagementPanel,
  hasHrAccess,
  hasAdminAccess
}: {
  home: Awaited<ReturnType<typeof getHomeDashboard>>;
  copy: ReturnType<typeof getDashboardCopy>;
  hasManagementPanel: boolean;
  hasHrAccess: boolean;
  hasAdminAccess: boolean;
}) {
  const actions: QuickAction[] = [];
  const push = (action: QuickAction) => {
    if (actions.some((item) => item.href === action.href)) return;
    actions.push(action);
  };

  if (home.mode === "manager") {
    push({ href: "/management", label: copy.quick.management, icon: IconBriefcase });
    push({ href: "/tasks", label: copy.quick.tasks, icon: IconTasks });
    push({ href: "/reports/manager", label: copy.quick.reports, icon: IconReport });
    push({ href: "/inbox", label: copy.quick.inbox, icon: IconInbox });
    return actions;
  }

  if (home.mode === "hr") {
    push({ href: "/hr", label: copy.quick.hr, icon: IconBriefcase });
    push({ href: "/candidates", label: copy.quick.candidates, icon: IconUsers });
    push({ href: "/onboarding", label: copy.quick.onboarding, icon: IconSparkles });
    push({ href: "/inbox", label: copy.quick.inbox, icon: IconInbox });
    return actions;
  }

  if (home.mode === "admin") {
    if (hasAdminAccess) push({ href: "/access", label: copy.quick.access, icon: IconUsers });
    if (hasAdminAccess) push({ href: "/admin/settings", label: copy.quick.settings, icon: IconSettings });
    push({ href: "/inbox", label: copy.quick.inbox, icon: IconInbox });
    push({ href: "/tasks", label: copy.quick.tasks, icon: IconTasks });
    return actions;
  }

  push({ href: "/tasks", label: copy.quick.tasks, icon: IconTasks });
  push({ href: hasManagementPanel ? "/reports/manager" : "/reports", label: copy.quick.reports, icon: IconReport });
  push({ href: "/absence", label: copy.quick.absence, icon: IconCalendar });
  push({ href: "/inbox", label: copy.quick.inbox, icon: IconInbox });
  if (hasHrAccess) push({ href: "/hr", label: copy.quick.hr, icon: IconBriefcase });
  if (hasAdminAccess) push({ href: "/access", label: copy.quick.access, icon: IconUsers });

  return actions.slice(0, 4);
}

function getToneLabel(tone: "review" | "warning" | "info" | "success", lang: "sr" | "en") {
  if (tone === "review") return lang === "sr" ? "Akcija" : "Action";
  if (tone === "warning") return lang === "sr" ? "Važno" : "Important";
  if (tone === "success") return lang === "sr" ? "Novo" : "Update";
  return lang === "sr" ? "Info" : "Info";
}

export default async function DashboardPage() {
  const user = await requireActiveUser();
  const lang = getRequestLang();
  const copy = getDashboardCopy(lang);
  const home = await getHomeDashboard({
    id: user.id,
    email: user.email,
    role: user.role,
    hrAddon: user.hrAddon,
    adminAddon: user.adminAddon,
    teamId: user.teamId
  });
  const hasHrAccess = hasHrAddon(user);
  const hasManagementPanel = isManagerRole(user.role);
  const hasAdminAccess = hasAccessAdmin(user);
  const inboxPreview = home.summary.inbox.needsMyAction.slice(0, 4);
  const summaryCards = getSummaryCards({ lang, copy, home });
  const visibilityRows = getVisibilityRows({ lang, copy, home, hasHrAccess, hasAdminAccess });
  const quickActions = getQuickActions({ home, copy, hasManagementPanel, hasHrAccess, hasAdminAccess });
  const hero = getHeroContent(copy, home.mode);

  return (
    <main className="page">
      <div className="card stack">
        <div className="page-topbar">
          <div className="page-topbar-main stack">
            <div className="brand">
              <div>
                <h1 className="brand-title">{lang === "sr" ? "Početna" : "Home"}</h1>
                <p className="muted">
                  {lang === "sr"
                    ? "Jedan centralni pregled zadataka, ljudi i akcija koje traže tvoju pažnju."
                    : "One central place for tasks, people, and actions that need your attention."}
                </p>
              </div>
            </div>
          </div>

          <UserMenu
            name={user.name}
            email={user.email}
            role={user.role}
            hrAddon={user.hrAddon}
            adminAddon={user.adminAddon}
            position={user.position}
            team={user.team?.name ?? null}
            lang={lang}
          />
        </div>

        <section className="panel stack dashboard-hero">
          <div className="dashboard-hero-main">
            <div className="stack dashboard-hero-copy">
              <div>
                <h2 className="h2">{hero.title}</h2>
                <p className="muted">{hero.text}</p>
              </div>
            </div>

            <div className="dashboard-quick-actions">
              <div className="small muted">{copy.quickActionsTitle}</div>
              <div className="inline">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link key={action.href} className="button button-secondary dashboard-quick-action" href={action.href}>
                      <Icon size={16} /> {action.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid4 dashboard-summary-grid">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className={`item item-compact kpi-card${card.tone === "warning" ? " dashboard-kpi-warning" : ""}${
                    card.tone === "success" ? " dashboard-kpi-success" : ""
                  }`}
                >
                  <div className="kpi-icon">
                    <Icon size={18} />
                  </div>
                  <div>
                    <div className="kpi-value">{card.value}</div>
                    <div className="kpi-label">{card.label}</div>
                    <div className="dashboard-kpi-detail">{card.detail}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="grid2 dashboard-home-grid">
          <section className="panel stack">
            <div className="dashboard-section-head">
              <h2 className="h2">
                <LabelWithTooltip label={copy.actionCenterTitle} tooltip={copy.actionCenterTooltip} />
              </h2>
              <Link className="button button-secondary" href="/inbox">
                {copy.viewInbox} <IconArrowRight size={18} />
              </Link>
            </div>
            <div className="dashboard-action-list">
              {inboxPreview.map((item) => (
                <div key={item.id} className="item dashboard-action-row">
                  <div className="dashboard-action-copy">
                    <div className="dashboard-action-top">
                      <span
                        className={`pill dashboard-tone-pill dashboard-tone-${item.tone}`}
                      >
                        {getToneLabel(item.tone, lang)}
                      </span>
                      {item.meta ? <span className="muted small">{item.meta}</span> : null}
                    </div>
                    <div className="item-title">{item.title}</div>
                    <div className="muted small">{item.description}</div>
                  </div>
                  <Link className="button button-secondary" href={item.href}>
                    {copy.open}
                  </Link>
                </div>
              ))}
              {inboxPreview.length === 0 ? <div className="dashboard-empty muted small">{copy.noActions}</div> : null}
            </div>
          </section>
        </div>

        <section className="panel stack">
          <div className="dashboard-section-head">
            <h2 className="h2">
              <LabelWithTooltip label={copy.visibilityTitle} tooltip={copy.visibilityTooltip} />
            </h2>
          </div>
          <div className="dashboard-visibility-list">
            {visibilityRows.map((row) => (
              <div key={row.label} className="item dashboard-visibility-row">
                <div>
                  <div className="item-title">{row.label}</div>
                  {row.detail ? <div className="muted small">{row.detail}</div> : null}
                </div>
                <div className="dashboard-visibility-value">{row.value}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
