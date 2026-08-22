import type { AppCardItem, AppShowcaseItem } from "../types/types";

export const appFeatures: AppCardItem[] = [
  {
    index: "01",
    badge: "Scheduling",
    title: "Sessions & Attendance",
    description:
      "Coaches build recurring or one off sessions with a location, then mark attendance in a couple of taps instead of a sign in sheet.",
  },
  {
    index: "02",
    badge: "Development",
    title: "Player Assessments",
    description:
      "Every session, coaches score players on technical, physical, tactical and mental fundamentals, building a real record of growth over time.",
  },
  {
    index: "03",
    badge: "Feedback",
    title: "Coach Notes",
    description:
      "Coaches log observations after every session and choose which notes are visible to the player and family, keeping feedback honest and useful.",
  },
  {
    index: "04",
    badge: "Progress",
    title: "Development Milestones",
    description:
      "Key achievements are logged against each player, so progress is a timeline rather than a memory a coach has to keep in their head.",
  },
  {
    index: "05",
    badge: "Access",
    title: "Role Based Portals",
    description:
      "Admins, coaches, players and parents each see a portal built for what they actually need to do, nothing more, nothing less.",
  },
  {
    index: "06",
    badge: "Structure",
    title: "Multi Program Support",
    description:
      "One platform runs every team, age group and program at the club, with coaches assigned exactly where they coach.",
  },
];

export const appRoles: AppCardItem[] = [
  {
    index: "01",
    badge: "Oversight",
    title: "Admin Portal",
    description:
      "Set up programs, age groups and coach assignments, and see the whole academy from one place.",
    meta: [{ label: "Primary Use", value: "Programs & Coaches" }],
  },
  {
    index: "02",
    badge: "On the Field",
    title: "Coach Portal",
    description:
      "Run sessions, take attendance, score assessments and write notes, all from the sideline.",
    meta: [{ label: "Primary Use", value: "Sessions & Assessments" }],
  },
  {
    index: "03",
    badge: "Growth",
    title: "Player Portal",
    description:
      "See attendance history, assessment scores and milestones, and the notes a coach has chosen to share.",
    meta: [{ label: "Primary Use", value: "Personal Progress" }],
  },
  {
    index: "04",
    badge: "Staying Close",
    title: "Parent Portal",
    description:
      "Follow a player's development and attendance without chasing a coach for an update.",
    meta: [{ label: "Primary Use", value: "Player Updates" }],
  },
];

export const appShowcase: AppShowcaseItem[] = [
  {
    slug: "admin",
    role: "Admin Dashboard",
    caption:
      "A single view of every program, age group and coach assignment across the club.",
  },
  {
    slug: "coach",
    role: "Coach Session View",
    caption:
      "Attendance and assessments for the day's session, built to move fast between players.",
  },
  {
    slug: "player",
    role: "Player & Parent Portal",
    caption:
      "Attendance, scores and shared coach notes, in one place instead of scattered messages.",
  },
];
