import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import {
  BanknoteArrowDown,
  BanknoteArrowUp,
  CarTaxiFront,
  Droplets,
  FileText,
  HandCoins,
  Home as HomeIcon,
  PlugZap,
  Salad,
  ScanBarcode,
} from "lucide-react-native";
import LineItem from "../../../components/LineItem";
import SummaryCardShort from "../../../components/SummaryCardShort";
import SummaryCardLong from "../../../components/SummaryCardLong";

const items = [
  {
    id: 1,
    icon: <CarTaxiFront size={24} />,
    title: "Uber",
    value: "-86.64",
    date: "12/03/2026",
    category: "Transporte",
    description: "Corridas para visitas a clientes durante a semana.",
  },
  {
    id: 2,
    icon: <PlugZap size={24} />,
    title: "Conta de Luz",
    value: "-121.36",
    date: "12/03/2026",
    category: "Utilidades",
    description: "Pagamento mensal da energia do escritório.",
  },
  {
    id: 3,
    icon: <Salad size={24} />,
    title: "Consulta",
    value: "220",
    date: "11/03/2026",
    category: "Receita",
  },
  {
    id: 4,
    icon: <Droplets size={24} />,
    title: "Conta de Água",
    value: "-67.90",
    date: "10/03/2026",
    category: "Utilidades",
  },
  {
    id: 5,
    icon: <HomeIcon size={24} />,
    title: "Aluguel",
    value: "-1500.00",
    date: "09/03/2026",
    category: "Estrutura",
  },
  {
    id: 6,
    icon: <FileText size={24} />,
    title: "DAS",
    value: "-86.05",
    date: "09/03/2026",
    category: "Impostos",
    description: "Pagamento da guia mensal do DAS.",
  },
  {
    id: 7,
    icon: <Salad size={24} />,
    title: "Consulta",
    value: "220",
    date: "08/03/2026",
    category: "Receita",
    description: "Receita recebida por atendimento avulso.",
  },
  {
    id: 8,
    icon: <Salad size={24} />,
    title: "Consulta",
    value: "220",
    date: "08/03/2026",
    category: "Receita",
  },
];

export default function Home() {
  const tabBarHeight = useBottomTabBarHeight();
  const [selectedItem, setSelectedItem] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  function openItemModal(item) {
    setSelectedItem(item);
    setIsModalVisible(true);
  }

  function closeItemModal() {
    setIsModalVisible(false);
  }

  function formatCurrency(value) {
    const numericValue = Number(value);

    if (Number.isNaN(numericValue)) {
      return value;
    }

    return numericValue.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  return (
    <View className="flex-1 bg-gray-50 pt-4">
      <Text className="text-3xl font-poppins-semibold px-8 mb-4">Homepage</Text>

      <ScrollView
        className="w-full"
        contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="w-[90%] self-center gap-4">
          <View className="flex-row gap-4">
            <SummaryCardShort
              icon={<BanknoteArrowUp size={22} />}
              title="Total Entradas"
              value="R$ 2.546,49"
              change="5,23%"
              positive={true}
              period="Esse mês"
            />
            <SummaryCardShort
              icon={<BanknoteArrowDown size={22} />}
              title="Total Saídas"
              value="R$ 1.867,31"
              change="2,54%"
              positive={false}
              period="Esse mês"
            />
          </View>
          <View className="flex-row gap-4">
            <SummaryCardShort
              icon={<ScanBarcode size={22} />}
              title="Contas Fixas"
              value="R$ 831,99"
              change="12,20%"
              positive={true}
              period="Esse mês"
            />
            <SummaryCardShort
              icon={<HandCoins size={22} />}
              title="Contas a vencer"
              value="R$ 324,99"
              change="1,04%"
              positive={false}
              period="Próximos 7 dias"
            />
          </View>
          <SummaryCardLong
            title={"Atividade Recente"}
          >
            <View>
              {items.map((item) => (
                <LineItem
                  key={item.id}
                  icon={item.icon}
                  title={item.title}
                  value={item.value}
                  date={item.date}
                  onPress={() => openItemModal(item)}
                />
              ))}
            </View>
          </SummaryCardLong>
        </View>
      </ScrollView>

      <Modal
        visible={isModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={closeItemModal}
      >
        <Pressable
          className="flex-1 bg-black/40 justify-center px-6"
          onPress={closeItemModal}
        >
          <Pressable className="bg-white rounded-3xl p-6 gap-5">
            <View className="flex-row items-start justify-between">
              <View className="flex-row items-center gap-3 flex-1">
                <View className="p-3 rounded-2xl bg-gray-200">
                  {selectedItem?.icon}
                </View>
                <View className="flex-1">
                  <Text className="font-poppins-semibold text-2xl text-texto-primario">
                    {selectedItem?.title}
                  </Text>
                  <Text className="font-poppins-regular text-texto-terciario">
                    {selectedItem?.date}
                  </Text>
                </View>
              </View>
              <Pressable onPress={closeItemModal} hitSlop={8}>
                <Text className="font-poppins-semibold text-texto-terciario text-lg">
                  Fechar
                </Text>
              </Pressable>
            </View>

            <View className="gap-4">
              <View className="rounded-2xl bg-gray-100 p-4">
                <Text className="font-poppins-medium text-texto-terciario text-sm mb-1">
                  Valor
                </Text>
                <Text
                  className={`font-poppins-semibold text-2xl ${
                    Number(selectedItem?.value) >= 0
                      ? "text-green-500"
                      : "text-red-500"
                  }`}
                >
                  {formatCurrency(selectedItem?.value ?? 0)}
                </Text>
              </View>

              <View className="gap-1">
                <Text className="font-poppins-medium text-texto-terciario text-sm">
                  Categoria
                </Text>
                <Text className="font-poppins-semibold text-texto-primario text-lg">
                  {selectedItem?.category}
                </Text>
              </View>

              <View className="gap-1">
                <Text className="font-poppins-medium text-texto-terciario text-sm">
                  Descrição
                </Text>
                <Text className="font-poppins-regular text-texto-primario leading-6">
                  {selectedItem?.description ?? "Nenhuma descrição adicional fornecida."}
                </Text>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
