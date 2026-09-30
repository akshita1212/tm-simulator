import MARK_DARK from "/src/assets/mark-dark.png";

/* --------------------------------------------------------------------------
   Icons — Lucide, rendered to inline SVG strings for the view templates.
   Imported by name so the bundle carries only the icons actually used.
   -------------------------------------------------------------------------- */
import {
  LayoutDashboard, Inbox, FolderSearch, UserRound, ArrowLeftRight, Network, Briefcase,
  NotebookPen, FileText, ArrowUpRight, ShieldCheck, ChartColumn, GraduationCap, Search,
  Bell, Settings, ChevronsUpDown, EllipsisVertical, Moon, Sun, Monitor, Command, Flag, X,
  ChevronRight, ChevronLeft, ChevronDown, Plus, Sparkles, CircleAlert, Clock, Building2,
  Landmark, Zap, Repeat, Smartphone, Banknote, TrendingUp, TrendingDown, Check, Globe,
  Handshake, FolderOpen, ShieldAlert, Scale, SearchCheck, Newspaper, Menu, ArrowRight,
  Target, Layers, CornerDownLeft, RotateCcw, Hourglass, Table2, ChartNoAxesColumn, LogOut,
  CircleCheck, Gauge, BookOpen, Users, Flame, MapPin, Keyboard, Undo2, Timer, Hash
} from "lucide";

const ICONS = {
  dashboard: LayoutDashboard, queue: Inbox, mine: FolderSearch, customer: UserRound,
  txn: ArrowLeftRight, entity: Network, cases: Briefcase, notes: NotebookPen, evidence: FileText,
  escalations: ArrowUpRight, qa: ShieldCheck, performance: ChartColumn, training: GraduationCap,
  search: Search, bell: Bell, settings: Settings, updown: ChevronsUpDown, more: EllipsisVertical,
  moon: Moon, sun: Sun, monitor: Monitor, command: Command, flag: Flag, x: X,
  right: ChevronRight, left: ChevronLeft, down: ChevronDown, plus: Plus, sparkles: Sparkles,
  alert: CircleAlert, clock: Clock, building: Building2, landmark: Landmark, zap: Zap,
  repeat: Repeat, phone: Smartphone, cash: Banknote, up: TrendingUp, downTrend: TrendingDown,
  check: Check, globe: Globe, handshake: Handshake, folder: FolderOpen, shieldAlert: ShieldAlert,
  scale: Scale, searchCheck: SearchCheck, news: Newspaper, menu: Menu, arrow: ArrowRight,
  target: Target, layers: Layers, enter: CornerDownLeft, reset: RotateCcw, hourglass: Hourglass,
  table: Table2, chart: ChartNoAxesColumn, logout: LogOut, done: CircleCheck, gauge: Gauge,
  book: BookOpen, users: Users, flame: Flame, pin: MapPin, keyboard: Keyboard, undo: Undo2,
  timer: Timer, hash: Hash
};

/* institution and team identities, replacing the old emoji glyphs */
const INST_ICON = { retail:"landmark", invest:"up", fintech:"zap", paymentinst:"repeat", digital:"phone", msb:"cash" };
const TEAM_ICON = { customer:"customer", rm:"handshake", kyc:"folder", fraud:"shieldAlert", sanctions:"scale",
                    aml:"searchCheck", ops:"building", corr:"globe", external:"news" };

function icon(name, size, cls){
  const node = ICONS[name];
  if (!node) return "";
  size = size || 18;
  const inner = node.map(([tag, attrs]) =>
    "<" + tag + Object.keys(attrs).map(k => " " + k + '="' + attrs[k] + '"').join("") + "/>").join("");
  return '<svg class="ic' + (cls ? " " + cls : "") + '" width="' + size + '" height="' + size +
    '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"' +
    ' stroke-linejoin="round" aria-hidden="true" focusable="false">' + inner + "</svg>";
}
