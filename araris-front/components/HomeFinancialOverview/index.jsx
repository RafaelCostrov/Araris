import { Text, View } from "react-native";
import {
  BanknoteArrowDown,
  BanknoteArrowUp,
  CalendarClock,
  CircleDollarSign,
  ReceiptText,
} from "lucide-react-native";

import Card from "../Card";
import SummaryCardShort from "../SummaryCardShort";
import { formatCurrency } from "../../utils/financeFormatters";


export default function HomeFinancialOverview({ totals, period, onOpenDetail }) {
  const summaryRows = [
    [
      {
        key: "revenues",
        icon: <BanknoteArrowUp size={22} color="#15803d" />,
        title: "Total Entradas",
        value: totals.revenue,
      },
      {
        key: "expenses",
        icon: <BanknoteArrowDown size={22} color="#b91c1c" />,
        title: "Total Saídas",
        value: totals.expense,
      },
    ],
    [
      {
        key: "payables",
        icon: <ReceiptText size={22} color="#c2410c" />,
        title: "A Pagar",
        value: totals.payables_due_in_period,
      },
      {
        key: "receivables",
        icon: <CalendarClock size={22} color="#1d4ed8" />,
        title: "A Receber",
        value: totals.receivables_due_in_period,
      },
    ],
  ];
  const hasPositiveBalance = Number(totals.closing_balance ?? 0) >= 0;

  return (
    <>
      {summaryRows.map((row, index) => (
        <View key={`summary-row-${index}`} className="flex-row gap-4">
          {row.map((item) => (
            <SummaryCardShort
              key={item.key}
              icon={item.icon}
              title={item.title}
              value={formatCurrency(item.value)}
              period={period}
              onPress={() => onOpenDetail(item.key)}
            />
          ))}
        </View>
      ))}

      <Card
        className="flex-row items-center gap-4"
        onPress={() => onOpenDetail("balance")}
      >
        <View className="h-11 w-11 items-center justify-center rounded-2xl bg-blue-50">
          <CircleDollarSign size={22} color="#1d4ed8" />
        </View>
        <View className="flex-1">
          <Text className="font-poppins-semibold text-lg text-gray-600">
            Saldo Mensal
          </Text>
          <Text className="font-poppins-regular text-xs text-texto-terciario">
            {period}
          </Text>
        </View>
        <Text
          className={`font-poppins-semibold text-xl ${
            hasPositiveBalance ? "text-green-600" : "text-red-600"
          }`}
        >
          {formatCurrency(totals.closing_balance)}
        </Text>
      </Card>
    </>
  );
}
