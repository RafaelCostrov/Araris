import { View } from "react-native";
import {
  CarFront,
  CircleDollarSign,
  House,
  HousePlug,
  Landmark,
  Megaphone,
  PackageOpen,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  Toolbox,
  TrendingUp,
  Users,
} from "lucide-react-native";

const CATEGORY_VISUALS = {
  sales: { icon: ShoppingBag, color: "#15803d", background: "#dcfce7" },
  services: { icon: Toolbox, color: "#1d4ed8", background: "#dbeafe" },
  refund: { icon: RotateCcw, color: "#0f766e", background: "#ccfbf1" },
  investment: { icon: TrendingUp, color: "#7e22ce", background: "#f3e8ff" },
  supplies: { icon: PackageOpen, color: "#b45309", background: "#fef3c7" },
  rent: { icon: House, color: "#c2410c", background: "#ffedd5" },
  utilities: { icon: HousePlug, color: "#a16207", background: "#fef9c3" },
  transportation: { icon: CarFront, color: "#4338ca", background: "#e0e7ff" },
  taxes: { icon: ReceiptText, color: "#b91c1c", background: "#fee2e2" },
  marketing: { icon: Megaphone, color: "#be185d", background: "#fce7f3" },
  salaries: { icon: Users, color: "#6d28d9", background: "#ede9fe" },
  bank_fees: { icon: Landmark, color: "#475569", background: "#e2e8f0" },
  other: { icon: CircleDollarSign, color: "#4b5563", background: "#f3f4f6" },
};

const FALLBACK_VISUAL = CATEGORY_VISUALS.other;

export function getCategoryVisual(category) {
  return CATEGORY_VISUALS[category] ?? FALLBACK_VISUAL;
}

export default function CategoryIcon({
  category,
  size = 22,
  withBackground = false,
}) {
  const visual = getCategoryVisual(category);
  const Icon = visual.icon;

  if (!withBackground) {
    return <Icon size={size} color={visual.color} />;
  }

  return (
    <View
      className="rounded-2xl items-center justify-center"
      style={{
        width: size + 22,
        height: size + 22,
        backgroundColor: visual.background,
      }}
    >
      <Icon size={size} color={visual.color} />
    </View>
  );
}
