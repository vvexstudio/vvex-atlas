"use client";

/**
 * Single icon layer for the whole app. Components never import from
 * lucide-react directly — they render <Icon name="..." /> so the set
 * stays consistent (16px, 1.75 stroke, currentColor) and swappable.
 */
import {
  Anchor,
  Building2,
  Bus,
  CalendarDays,
  Car,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Coffee,
  ConciergeBell,
  Construction,
  Copy,
  Cross,
  Droplets,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Hotel,
  Hourglass,
  KeyRound,
  Link2,
  LoaderCircle,
  Lock,
  LogOut,
  Mail,
  Map,
  MapPin,
  Megaphone,
  Moon,
  Palette,
  Phone,
  Pin,
  Plane,
  Search,
  Settings,
  ShieldPlus,
  Sparkles,
  Star,
  Stethoscope,
  Sun,
  Tent,
  Toilet,
  Tractor,
  Trash2,
  Trees,
  TriangleAlert,
  User,
  UtensilsCrossed,
  Wrench,
  X,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";

const ICONS = {
  anchor: Anchor,
  building: Building2,
  bus: Bus,
  calendar: CalendarDays,
  car: Car,
  check: Check,
  checkCircle: CheckCircle2,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  clipboard: ClipboardList,
  clock: Clock,
  coffee: Coffee,
  conciergeBell: ConciergeBell,
  construction: Construction,
  copy: Copy,
  cross: Cross,
  droplets: Droplets,
  externalLink: ExternalLink,
  eye: Eye,
  eyeOff: EyeOff,
  file: FileText,
  hotel: Hotel,
  hourglass: Hourglass,
  key: KeyRound,
  link: Link2,
  loader: LoaderCircle,
  lock: Lock,
  logout: LogOut,
  mail: Mail,
  map: Map,
  mapPin: MapPin,
  megaphone: Megaphone,
  moon: Moon,
  palette: Palette,
  phone: Phone,
  pin: Pin,
  plane: Plane,
  search: Search,
  settings: Settings,
  shieldPlus: ShieldPlus,
  sparkles: Sparkles,
  star: Star,
  stethoscope: Stethoscope,
  sun: Sun,
  tent: Tent,
  toilet: Toilet,
  tractor: Tractor,
  trash: Trash2,
  trees: Trees,
  warning: TriangleAlert,
  user: User,
  utensils: UtensilsCrossed,
  wrench: Wrench,
  x: X,
  xCircle: XCircle,
  zap: Zap,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  /** Fill the icon (e.g. active star). */
  filled?: boolean;
  "aria-hidden"?: boolean;
}

export function Icon({
  name,
  size = 16,
  className,
  filled = false,
  ...rest
}: IconProps) {
  const Cmp = ICONS[name];
  return (
    <Cmp
      size={size}
      strokeWidth={1.75}
      className={className}
      fill={filled ? "currentColor" : "none"}
      aria-hidden={rest["aria-hidden"] ?? true}
    />
  );
}

/**
 * Department → icon, keyed by the names used in the Google Sheet.
 * Always look up with .trim() — sheet data carries trailing spaces.
 */
const DEPARTMENT_ICON_MAP: Record<string, IconName> = {
  ATPF: "tent",
  Electricity: "zap",
  "F&B": "utensils",
  "Fly Fleet": "plane",
  "Heavy Equipment (WonderBros)": "tractor",
  Hospitality: "conciergeBell",
  "Med / Sec": "shieldPlus",
  Rigging: "anchor",
  "Set Design": "palette",
  SolarPunks: "sun",
  Structural: "construction",
};

export function departmentIcon(department: string | undefined): IconName {
  if (!department) return "building";
  return DEPARTMENT_ICON_MAP[department.trim()] ?? "building";
}
