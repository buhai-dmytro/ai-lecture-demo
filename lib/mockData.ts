export type AccountStatus = "Active" | "Suspended";
export type SubscriptionTier = "Free" | "Pro" | "Enterprise";
export type DeviceType = "iOS" | "Android" | "Web";

export type UserProfile = {
  userId: string;
  name: string;
  email: string;
  status: AccountStatus;
  tier: SubscriptionTier;
  appVersion: string;
  deviceType: DeviceType;
  lastSeen: string;
};

export type ActivityLog = {
  id: string;
  at: string;
  action: string;
  statusCode: number;
  metadata: string;
};

export type AgentData = {
  profile: UserProfile;
  logs: ActivityLog[];
};

const NAMES = [
  "Avery Clarke",
  "Jordan Rivera",
  "Riley Chen",
  "Sam Patel",
  "Taylor Brooks",
  "Alex Morgan",
  "Jamie Park",
  "Casey Nguyen",
  "Morgan Reed",
  "Drew Santos",
];

const ACTIONS = [
  "Logged In",
  "Viewed Dashboard",
  "Clicked 'Buy'",
  "Updated Profile",
  "Upload Failed",
  "Password Reset",
  "Export Started",
  "Sync Error",
  "Payment Retry",
  "Logged Out",
];

const DEVICES: DeviceType[] = ["iOS", "Android", "Web"];
const TIERS: SubscriptionTier[] = ["Free", "Pro", "Enterprise"];
const STATUSES: AccountStatus[] = ["Active", "Suspended"];

const META = [
  "requestId=9bf2",
  "session=mobile",
  "latency=640ms",
  "region=us-east",
  "ip=203.0.113.42",
  "plan=annual",
  "build=stable",
  "cache=miss",
  "cdn=hit",
  "retry=1",
];

const ERROR_CODES = [400, 401, 403, 404, 409, 429, 500, 502, 503];
const OK_CODES = [200, 201, 202, 204, 206];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(list: T[], rand: () => number): T {
  return list[Math.floor(rand() * list.length)];
}

function pad2(value: number) {
  return value.toString().padStart(2, "0");
}

function randomDateWithinDays(days: number, rand: () => number) {
  const now = new Date();
  const delta = Math.floor(rand() * days * 24 * 60 * 60 * 1000);
  return new Date(now.getTime() - delta);
}

function formatDate(date: Date) {
  const yyyy = date.getFullYear();
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const min = pad2(date.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function buildAppVersion(rand: () => number) {
  const major = 2 + Math.floor(rand() * 2);
  const minor = Math.floor(rand() * 9);
  const patch = Math.floor(rand() * 9);
  return `v${major}.${minor}.${patch}`;
}

function buildLogs(rand: () => number, count: number): ActivityLog[] {
  return Array.from({ length: count }, (_, index) => {
    const hasError = rand() > 0.72;
    const statusCode = hasError ? pick(ERROR_CODES, rand) : pick(OK_CODES, rand);
    const action = hasError ? pick(["Upload Failed", "Sync Error"], rand) : pick(ACTIONS, rand);
    const eventDate = randomDateWithinDays(7, rand);

    return {
      id: `log_${index}_${Math.floor(rand() * 10000)}`,
      at: formatDate(eventDate),
      action,
      statusCode,
      metadata: pick(META, rand),
    };
  }).sort((a, b) => (a.at < b.at ? 1 : -1));
}

export function generateAgentData(query: string): AgentData | null {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized.includes("notfound") || normalized.includes("missing") || normalized.includes("unknown")) {
    return null;
  }

  const seed = hashString(normalized);
  const rand = mulberry32(seed);
  const name = pick(NAMES, rand);
  const userId = `usr_${seed.toString(16).slice(0, 8)}`;
  const email = normalized.includes("@") ? normalized : `${normalized}@example.com`;

  const profile: UserProfile = {
    userId,
    name,
    email,
    status: pick(STATUSES, rand),
    tier: pick(TIERS, rand),
    appVersion: buildAppVersion(rand),
    deviceType: pick(DEVICES, rand),
    lastSeen: formatDate(randomDateWithinDays(2, rand)),
  };

  return {
    profile,
    logs: buildLogs(rand, 10),
  };
}
