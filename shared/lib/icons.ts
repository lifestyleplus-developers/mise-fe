import { cssInterop } from 'nativewind';
import {
  Archive,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Clock,
  Eye,
  EyeOff,
  Flag,
  Globe,
  House,
  Info,
  KeyRound,
  LayoutGrid,
  ListChecks,
  Lock,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  Store,
  Sun,
  TriangleAlert,
  Users,
  UserX,
  WifiOff,
  X,
} from 'lucide-react-native';

/**
 * Lets `className="text-foreground"` colour an icon. Without this the colour
 * class is ignored and the icon draws black, which vanishes in dark mode.
 * Every icon used with a `className` must be listed here.
 */
const ICONS = [
  Archive,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Clock,
  Eye,
  EyeOff,
  Flag,
  Globe,
  House,
  Info,
  KeyRound,
  LayoutGrid,
  ListChecks,
  Lock,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  Store,
  Sun,
  TriangleAlert,
  Users,
  UserX,
  WifiOff,
  X,
];

for (const Icon of ICONS) {
  cssInterop(Icon, {
    className: { target: 'style', nativeStyleToProp: { color: true } },
  });
}
