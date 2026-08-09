import { Inbox } from "lucide-react-native";
import { Text, View } from "react-native";

import CategoryIcon from "../CategoryIcon";
import LineItem from "../LineItem";
import SummaryCardLong from "../SummaryCardLong";
import { formatApiDate } from "../../utils/financeFormatters";


export default function RecentActivityCard({ items, onItemPress }) {
  return (
    <SummaryCardLong title="Atividade Recente">
      {items.length > 0 ? (
        <View>
          {items.map((item) => (
            <LineItem
              key={`${item.type}-${item.id}`}
              icon={
                <CategoryIcon
                  category={item.category}
                  size={20}
                  withBackground
                />
              }
              title={item.description}
              value={item.type === "revenue" ? item.amount : `-${item.amount}`}
              date={formatApiDate(item.date)}
              onPress={() => onItemPress(item)}
            />
          ))}
        </View>
      ) : (
        <View className="items-center px-4 py-8">
          <Inbox size={34} color="#9ca3af" />
          <Text className="mt-3 font-poppins-semibold text-texto-primario">
            Nenhuma movimentação registrada
          </Text>
          <Text className="mt-1 text-center font-poppins-regular text-sm text-texto-terciario">
            Use o botão central para adicionar sua primeira entrada ou saída.
          </Text>
        </View>
      )}
    </SummaryCardLong>
  );
}
