import {
  Wallet,
  Smartphone,
  Zap,
  Landmark,
  Building2,
  Banknote,
  CircleDollarSign,
  ShoppingBag,
  CreditCard,
  PiggyBank,
} from "lucide-react";

export const ACCOUNT_TYPES = [
  { value: "Efectivo", icon: Wallet, color: "#2E7D5B" },
  { value: "Yape", icon: Smartphone, color: "#7C3AED" },
  { value: "Plin", icon: Zap, color: "#0EA5E9" },
  { value: "BCP", icon: Landmark, color: "#F26122" },
  { value: "BBVA", icon: Building2, color: "#004481" },
  { value: "Interbank", icon: Banknote, color: "#D5003F" },
  { value: "Scotiabank", icon: CircleDollarSign, color: "#E00026" },
  { value: "Falabella", icon: ShoppingBag, color: "#C0392B" },
  { value: "Tarjeta de crédito", icon: CreditCard, color: "#64748B" },
  { value: "Otro", icon: PiggyBank, color: "#94A3B8" },
];

export function accountTypeMeta(value) {
  return (
    ACCOUNT_TYPES.find((t) => t.value === value) ||
    ACCOUNT_TYPES[ACCOUNT_TYPES.length - 1]
  );
}
