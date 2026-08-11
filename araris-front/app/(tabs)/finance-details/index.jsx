import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  ArrowLeft,
  BanknoteArrowDown,
  BanknoteArrowUp,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Inbox,
  Pencil,
  TriangleAlert,
  X,
} from "lucide-react-native";
import CategoryIcon from "../../../components/CategoryIcon";
import CommitmentEditModal from "../../../components/CommitmentEditModal";
import DateField from "../../../components/DateField";
import FinancialActivityDetailModal from "../../../components/FinancialActivityDetailModal";
import FinancialActivityEditModal from "../../../components/FinancialActivityEditModal";
import SelectField from "../../../components/SelectField";
import { PAYMENT_METHODS } from "../../../constants/financeOptions";
import { useAuth } from "../../../contexts/AuthContext";
import { useFinancePeriod } from "../../../contexts/FinancePeriodContext";
import {
  getFinancialSummary,
  deleteFinancialActivity,
  deleteFinancialCommitment,
  listExpenses,
  listCustomers,
  listPayables,
  listReceivables,
  listRevenues,
  listSuppliers,
  settlePayable,
  settleReceivable,
  updateFinancialCommitment,
  updateFinancialActivity,
} from "../../../services/financeService";

const DETAIL_CONFIG = {
  revenues: {
    title: "Total de Entradas",
    description: "Entradas recebidas",
    color: "#15803d",
    icon: BanknoteArrowUp,
  },
  expenses: {
    title: "Total de Saídas",
    description: "Saídas pagas",
    color: "#b91c1c",
    icon: BanknoteArrowDown,
  },
  payables: {
    title: "Contas a Pagar",
    description: "Compromissos pendentes",
    color: "#c2410c",
    icon: CircleDollarSign,
  },
  receivables: {
    title: "Contas a Receber",
    description: "Recebimentos pendentes",
    color: "#1d4ed8",
    icon: CircleDollarSign,
  },
  overdue: {
    title: "Contas Vencidas",
    description: "Compromissos que precisam de atenção",
    color: "#e5003d",
    icon: TriangleAlert,
  },
  due_today: {
    title: "Vencimentos de Hoje",
    description: "Compromissos com vencimento hoje",
    color: "#b45309",
    icon: Clock3,
  },
  balance: {
    title: "Saldo Mensal",
    description: "Composição do saldo",
    color: "#1d4ed8",
    icon: CircleDollarSign,
  },
};

function formatCurrency(value) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatApiDate(value) {
  if (!value) {
    return "";
  }
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function todayInputValue() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${today.getFullYear()}`;
}

function formatDateInput(value) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 8);
  return digits
    .replace(/^(\d{2})(\d)/, "$1/$2")
    .replace(/^(\d{2})\/(\d{2})(\d)/, "$1/$2/$3");
}

function itemCountLabel(count) {
  return `${count} ${count === 1 ? "item" : "itens"}`;
}

function normalizeMovement(item, type) {
  return {
    ...item,
    type,
    date: item.occurred_on,
    source_commitment_id:
      item.source_receivable_id ?? item.source_payable_id ?? null,
  };
}

function parseDate(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) {
    return null;
  }
  const [, day, month, year] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day)
  ) {
    return null;
  }
  return `${year}-${month}-${day}`;
}

function periodLabel(value) {
  const label = new Date(`${value}-01T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function MovementRow({ item, type, onPress }) {
  const isRevenue = type === "revenue";
  return (
    <Pressable
      className="bg-white rounded-2xl p-4 flex-row items-center gap-3 active:opacity-70"
      onPress={onPress}
    >
      <CategoryIcon category={item.category} withBackground size={20} />
      <View className="flex-1">
        <Text className="font-poppins-semibold text-texto-primario">
          {item.description}
        </Text>
        <Text className="font-poppins-regular text-xs text-texto-terciario">
          {item.category_label} · {formatApiDate(item.occurred_on)}
        </Text>
        <Text className="font-poppins-regular text-[11px] text-texto-terciario">
          {isRevenue ? "Cliente" : "Fornecedor"}: {isRevenue
            ? item.customer_name || "Outros"
            : item.supplier_name || "Outros"}
        </Text>
      </View>
      <Text
        className={`font-poppins-semibold ${
          isRevenue ? "text-green-600" : "text-red-600"
        }`}
      >
        {isRevenue ? "+ " : "- "}{formatCurrency(item.amount)}
      </Text>
    </Pressable>
  );
}

function CommitmentCard({ item, onSettle, onEdit }) {
  const isPayable = item.type === "payable";
  const isOverdue = item.effective_status === "overdue";
  const StatusIcon = isOverdue ? TriangleAlert : Clock3;
  const statusColor = isOverdue ? "#b91c1c" : "#a16207";

  return (
    <View className="bg-white rounded-2xl p-4">
      <View className="flex-row gap-3">
        <CategoryIcon category={item.category} withBackground size={20} />
        <View className="flex-1">
          <Text className="font-poppins-semibold text-texto-primario">
            {item.description}
          </Text>
          <Text className="font-poppins-regular text-xs text-texto-terciario">
            {item.category_label} · {formatApiDate(item.due_date)}
          </Text>
          <Text className="font-poppins-regular text-[11px] text-texto-terciario">
            {isPayable ? "Fornecedor" : "Cliente"}: {isPayable
              ? item.supplier_name || "Outros"
              : item.customer_name || "Outros"}
          </Text>
          <View className="flex-row items-center gap-1 mt-1">
            <StatusIcon size={14} color={statusColor} />
            <Text
              className="font-poppins-medium text-xs"
              style={{ color: statusColor }}
            >
              {item.effective_status_label}
            </Text>
          </View>
        </View>
        <View className="items-end gap-2">
          <Text
            className="font-poppins-semibold"
            style={{ color: isPayable ? "#b91c1c" : "#15803d" }}
          >
            {formatCurrency(item.amount)}
          </Text>
          <View className="flex-row items-center gap-2">
            <Pressable
              className="w-9 h-9 rounded-lg border border-azul-primario items-center justify-center active:bg-blue-50"
              onPress={() => onEdit(item)}
              accessibilityRole="button"
              accessibilityLabel="Editar compromisso"
            >
              <Pencil size={15} color="#0063f5" />
            </Pressable>
            <Pressable
              className="bg-azul-primario rounded-lg px-4 py-2 active:opacity-75"
              onPress={() => onSettle(item)}
            >
              <Text className="font-poppins-semibold text-white text-xs">
                {isPayable ? "Pagar" : "Receber"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function FinanceDetails({ kindOverride, onBack } = {}) {
  const router = useRouter();
  const params = useLocalSearchParams();
  const tabBarHeight = useBottomTabBarHeight();
  const { currentOrganization, loadSession } = useAuth();
  const { selectedMonth } = useFinancePeriod();
  const requestedKind = Array.isArray(params.kind)
    ? params.kind.at(-1)
    : params.kind;
  const resolvedKind = kindOverride ?? requestedKind;
  const kind = DETAIL_CONFIG[resolvedKind] ? resolvedKind : "balance";
  const config = DETAIL_CONFIG[kind] ?? DETAIL_CONFIG.balance;
  const ConfigIcon = config.icon;
  const currentDataKey = `${currentOrganization?.id ?? "no-organization"}:${kind}:${selectedMonth}`;
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loadedDataKey, setLoadedDataKey] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loadErrorKey, setLoadErrorKey] = useState(null);
  const [settlementItem, setSettlementItem] = useState(null);
  const [lastSettlementItem, setLastSettlementItem] = useState(null);
  const [editingCommitment, setEditingCommitment] = useState(null);
  const [settlementForm, setSettlementForm] = useState({
    date: todayInputValue(),
    paymentMethod: "pix",
  });
  const [settlementErrors, setSettlementErrors] = useState({});
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [isEditingActivity, setIsEditingActivity] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const detailsRequestId = useRef(0);
  const contactsRequestId = useRef(0);
  const scrollRef = useRef(null);

  const loadDetails = useCallback(async () => {
    if (!currentOrganization?.id) {
      return;
    }

    const requestId = detailsRequestId.current + 1;
    const requestDataKey = currentDataKey;
    detailsRequestId.current = requestId;

    try {
      setIsLoading(true);
      setLoadError("");
      setLoadErrorKey(null);
      let nextItems = [];
      let nextSummary = null;

      if (kind === "revenues") {
        const data = await listRevenues(currentOrganization.id, selectedMonth);
        nextItems = data.map((item) => normalizeMovement(item, "revenue"));
      } else if (kind === "expenses") {
        const data = await listExpenses(currentOrganization.id, selectedMonth);
        nextItems = data.map((item) => normalizeMovement(item, "expense"));
      } else if (kind === "payables") {
        const [periodData, overdueData] = await Promise.all([
          listPayables(currentOrganization.id, "period_pending", selectedMonth),
          listPayables(currentOrganization.id, "overdue", selectedMonth),
        ]);
        const periodIds = new Set(periodData.map((item) => item.id));
        nextItems = [
          ...periodData.map((item) => ({
            ...item,
            type: "payable",
            includedInTotal: true,
          })),
          ...overdueData
            .filter((item) => !periodIds.has(item.id))
            .map((item) => ({
              ...item,
              type: "payable",
              includedInTotal: false,
            })),
        ];
      } else if (kind === "receivables") {
        const [periodData, overdueData] = await Promise.all([
          listReceivables(
            currentOrganization.id,
            "period_pending",
            selectedMonth,
          ),
          listReceivables(currentOrganization.id, "overdue", selectedMonth),
        ]);
        const periodIds = new Set(periodData.map((item) => item.id));
        nextItems = [
          ...periodData.map((item) => ({
            ...item,
            type: "receivable",
            includedInTotal: true,
          })),
          ...overdueData
            .filter((item) => !periodIds.has(item.id))
            .map((item) => ({
              ...item,
              type: "receivable",
              includedInTotal: false,
            })),
        ];
      } else if (kind === "overdue") {
        const [payableData, receivableData] = await Promise.all([
          listPayables(currentOrganization.id, "overdue", selectedMonth),
          listReceivables(currentOrganization.id, "overdue", selectedMonth),
        ]);
        nextItems = [
          ...payableData.map((item) => ({
            ...item,
            type: "payable",
            includedInTotal: true,
          })),
          ...receivableData.map((item) => ({
            ...item,
            type: "receivable",
            includedInTotal: true,
          })),
        ].sort((left, right) => left.due_date.localeCompare(right.due_date));
      } else if (kind === "due_today") {
        const [payableData, receivableData] = await Promise.all([
          listPayables(currentOrganization.id, "due_today", selectedMonth),
          listReceivables(currentOrganization.id, "due_today", selectedMonth),
        ]);
        nextItems = [
          ...payableData.map((item) => ({
            ...item,
            type: "payable",
            includedInTotal: true,
          })),
          ...receivableData.map((item) => ({
            ...item,
            type: "receivable",
            includedInTotal: true,
          })),
        ].sort((left, right) => left.type.localeCompare(right.type));
      } else {
        const [summaryData, revenues, expenses] = await Promise.all([
          getFinancialSummary(currentOrganization.id, selectedMonth),
          listRevenues(currentOrganization.id, selectedMonth),
          listExpenses(currentOrganization.id, selectedMonth),
        ]);
        nextSummary = summaryData;
        nextItems = [
          ...revenues.map((item) => normalizeMovement(item, "revenue")),
          ...expenses.map((item) => normalizeMovement(item, "expense")),
        ].sort((left, right) =>
          right.occurred_on.localeCompare(left.occurred_on),
        );
      }

      if (requestId !== detailsRequestId.current) {
        return;
      }
      setItems(nextItems);
      setSummary(nextSummary);
      setLoadedDataKey(requestDataKey);
    } catch (error) {
      if (requestId !== detailsRequestId.current) {
        return;
      }
      if (error.status === 401) {
        await loadSession();
        return;
      }
      setLoadError(error.message || "Não foi possível carregar os detalhes.");
      setLoadErrorKey(requestDataKey);
    } finally {
      if (requestId === detailsRequestId.current) {
        setIsLoading(false);
      }
    }
  }, [
    currentDataKey,
    currentOrganization?.id,
    kind,
    loadSession,
    selectedMonth,
  ]);

  const loadContacts = useCallback(async () => {
    if (!currentOrganization?.id) {
      return;
    }

    const requestId = contactsRequestId.current + 1;
    contactsRequestId.current = requestId;

    try {
      const [customerData, supplierData] = await Promise.all([
        listCustomers(currentOrganization.id),
        listSuppliers(currentOrganization.id),
      ]);
      if (requestId !== contactsRequestId.current) {
        return;
      }
      setCustomers(customerData);
      setSuppliers(supplierData);
    } catch (error) {
      if (requestId !== contactsRequestId.current) {
        return;
      }
      if (error.status === 401) {
        await loadSession();
      }
    }
  }, [currentOrganization?.id, loadSession]);

  const refreshDetails = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadDetails();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadDetails]);

  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      loadDetails();
      loadContacts();

      return () => {
        detailsRequestId.current += 1;
        contactsRequestId.current += 1;
      };
    }, [loadContacts, loadDetails]),
  );

  function openSettlement(item) {
    setSettlementItem(item);
    setLastSettlementItem(item);
    setSettlementForm({ date: todayInputValue(), paymentMethod: "pix" });
    setSettlementErrors({});
  }

  async function handleSettlement() {
    const date = parseDate(settlementForm.date);
    const nextErrors = {};
    if (!date) {
      nextErrors.date = "Informe uma data válida.";
    }
    if (!settlementForm.paymentMethod) {
      nextErrors.paymentMethod = "Selecione uma forma de pagamento.";
    }
    setSettlementErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        date,
        payment_method: settlementForm.paymentMethod,
      };
      if (settlementItem.type === "payable") {
        await settlePayable(settlementItem.id, payload);
      } else {
        await settleReceivable(settlementItem.id, payload);
      }
      setSettlementItem(null);
      await loadDetails();
    } catch (error) {
      if (error.status === 401) {
        await loadSession();
        return;
      }
      Alert.alert(
        "Não foi possível concluir",
        error.message || "Tente novamente em instantes.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCommitmentUpdate(item, payload) {
    try {
      setIsSubmitting(true);
      await updateFinancialCommitment(item.type, item.id, payload);
      setEditingCommitment(null);
      await loadDetails();
    } catch (error) {
      if (error.status === 401) {
        await loadSession();
        return;
      }
      Alert.alert(
        "Não foi possível atualizar",
        error.message || "Revise os dados e tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function confirmCommitmentDelete(item) {
    Alert.alert(
      "Excluir compromisso",
      item.recurrence !== "none"
        ? "Somente esta ocorrência será cancelada e removida das listas ativas. Deseja continuar?"
        : "O compromisso será cancelado e removido das listas ativas. Deseja continuar?",
      [
        { text: "Voltar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              setIsSubmitting(true);
              await deleteFinancialCommitment(item.type, item.id);
              setEditingCommitment(null);
              await loadDetails();
            } catch (error) {
              if (error.status === 401) {
                await loadSession();
                return;
              }
              Alert.alert(
                "Não foi possível excluir",
                error.message || "Tente novamente em instantes.",
              );
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ],
    );
  }

  async function handleActivityUpdate(payload) {
    if (!selectedActivity) {
      return;
    }

    try {
      setIsSubmitting(true);
      await updateFinancialActivity(
        selectedActivity.type,
        selectedActivity.id,
        payload,
      );
      setIsEditingActivity(false);
      setSelectedActivity(null);
      await loadDetails();
    } catch (error) {
      if (error.status === 401) {
        await loadSession();
        return;
      }
      Alert.alert(
        "Não foi possível editar",
        error.message || "Revise os dados e tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleActivityDelete() {
    if (!selectedActivity) {
      return;
    }

    try {
      setIsSubmitting(true);
      await deleteFinancialActivity(selectedActivity.type, selectedActivity.id);
      setSelectedActivity(null);
      await loadDetails();
    } catch (error) {
      if (error.status === 401) {
        await loadSession();
        return;
      }
      Alert.alert(
        "Não foi possível remover",
        error.message || "Tente novamente em instantes.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function confirmActivityDelete() {
    const reopensCommitment = Boolean(selectedActivity?.source_commitment_id);
    Alert.alert(
      "Remover atividade",
      reopensCommitment
        ? "A atividade será removida e o compromisso correspondente voltará a ficar pendente. Deseja continuar?"
        : "Esta atividade será removida definitivamente. Deseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: handleActivityDelete,
        },
      ],
    );
  }

  const hasCurrentData = loadedDataKey === currentDataKey;
  const currentLoadError =
    loadErrorKey === currentDataKey ? loadError : "";
  const currentItems = hasCurrentData ? items : [];
  const currentSummary = hasCurrentData ? summary : null;
  const isCommitment = [
    "payables",
    "receivables",
    "overdue",
    "due_today",
  ].includes(kind);
  const includedItems = isCommitment
    ? currentItems.filter((item) => item.includedInTotal)
    : currentItems;
  const overdueOutsidePeriod = isCommitment
    ? currentItems.filter((item) => !item.includedInTotal)
    : [];
  const itemTotal = includedItems.reduce(
    (total, item) => total + Number(item.amount),
    0,
  );
  const totals = currentSummary?.totals ?? {};
  const displayedSettlementItem = settlementItem ?? lastSettlementItem;

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView
        key={currentDataKey}
        ref={scrollRef}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshDetails}
          />
        }
      >
        <View className="w-[90%] self-center pt-5 gap-5">
          <Pressable
            className="self-start flex-row items-center gap-2 py-1"
            onPress={onBack ?? (() => router.back())}
          >
            <ArrowLeft size={20} color="#0063f5" />
            <Text className="font-poppins-semibold text-azul-primario">
              Voltar
            </Text>
          </Pressable>

          <View className="flex-row items-center gap-3">
            <View className="w-12 h-12 rounded-2xl bg-blue-50 items-center justify-center">
              <ConfigIcon size={24} color={config.color} />
            </View>
            <View className="flex-1">
              <Text className="font-poppins-semibold text-2xl text-texto-primario">
                {config.title}
              </Text>
              <Text className="font-poppins-regular text-sm text-texto-terciario">
                {config.description}
              </Text>
              <Text className="font-poppins-medium text-sm text-azul-primario mt-0.5">
                {kind === "overdue"
                  ? "Todas as pendências vencidas"
                  : kind === "due_today"
                    ? "Vencimentos de hoje"
                  : periodLabel(selectedMonth)}
              </Text>
            </View>
          </View>

          {currentLoadError ? (
            <Pressable className="rounded-2xl bg-red-50 p-4" onPress={loadDetails}>
              <Text className="font-poppins-medium text-red-700">
                {currentLoadError}
              </Text>
              <Text className="font-poppins-regular text-red-600 text-sm">
                Toque para tentar novamente.
              </Text>
            </Pressable>
          ) : null}

          {kind === "balance" && currentSummary ? (
            <View className="bg-white rounded-2xl p-5 gap-3">
              <Text className="font-poppins-semibold text-lg text-texto-primario">
                Cálculo do saldo
              </Text>
              <View className="flex-row justify-between">
                <Text className="font-poppins-regular text-texto-terciario">Saldo inicial do mês</Text>
                <Text className="font-poppins-semibold text-texto-primario">{formatCurrency(totals.opening_balance)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="font-poppins-regular text-green-700">+ Entradas</Text>
                <Text className="font-poppins-semibold text-green-700">{formatCurrency(totals.revenue)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="font-poppins-regular text-red-700">− Saídas</Text>
                <Text className="font-poppins-semibold text-red-700">{formatCurrency(totals.expense)}</Text>
              </View>
              <View className="h-[1px] bg-gray-200" />
              <View className="flex-row justify-between items-center">
                <Text className="font-poppins-semibold text-texto-primario">Saldo final do mês</Text>
                <Text className="font-poppins-semibold text-xl text-blue-700">{formatCurrency(totals.closing_balance)}</Text>
              </View>
            </View>
          ) : kind !== "balance" && hasCurrentData ? (
            <View className="bg-white rounded-2xl p-5 flex-row justify-between items-center">
              <View>
                <Text className="font-poppins-medium text-texto-terciario">
                  {kind === "overdue"
                    ? "Total vencido"
                    : kind === "due_today"
                      ? "Total com vencimento hoje"
                    : isCommitment
                      ? "Total pendente"
                      : "Total considerado"}
                </Text>
                <Text className="font-poppins-regular text-xs text-texto-terciario">
                  {itemCountLabel(includedItems.length)}
                </Text>
              </View>
              <Text className="font-poppins-semibold text-2xl" style={{ color: config.color }}>
                {formatCurrency(itemTotal)}
              </Text>
            </View>
          ) : null}

          {(isLoading || (!hasCurrentData && !currentLoadError)) &&
          currentItems.length === 0 ? (
            <View className="py-16 items-center">
              <ActivityIndicator size="large" color="#0063f5" />
            </View>
          ) : null}

          {!isLoading &&
          !currentLoadError &&
          hasCurrentData &&
          currentItems.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center">
              <Inbox size={34} color="#9ca3af" />
              <Text className="font-poppins-semibold text-texto-primario mt-3">
                {kind === "overdue"
                  ? "Nenhuma conta vencida"
                  : kind === "due_today"
                    ? "Nenhuma conta vence hoje"
                  : "Nenhum item neste período"}
              </Text>
            </View>
          ) : null}

          {currentItems.length > 0 && !isCommitment ? (
            <View className="gap-3">
              <Text className="font-poppins-semibold text-lg text-texto-primario">
                {kind === "balance" ? "Movimentações consideradas" : "Itens considerados"}
              </Text>
              {currentItems.map((item) => (
                <MovementRow
                  key={`${item.type ?? kind}-${item.id}`}
                  item={item}
                  type={
                    item.type ?? (kind === "revenues" ? "revenue" : "expense")
                  }
                  onPress={() => setSelectedActivity(item)}
                />
              ))}
            </View>
          ) : null}

          {isCommitment && includedItems.length > 0 ? (
            <View className="gap-3">
              <Text className="font-poppins-semibold text-lg text-texto-primario">
                {kind === "overdue"
                  ? "Contas vencidas"
                  : kind === "due_today"
                    ? "Contas que vencem hoje"
                  : "Itens considerados no total"}
              </Text>
              {includedItems.map((item) => (
                <CommitmentCard
                  key={`${item.type}-${item.id}`}
                  item={item}
                  onSettle={openSettlement}
                  onEdit={setEditingCommitment}
                />
              ))}
            </View>
          ) : null}

          {overdueOutsidePeriod.length > 0 ? (
            <View className="gap-3">
              <View>
                <Text className="font-poppins-semibold text-lg text-red-700">
                  Vencidos de outros meses
                </Text>
                <Text className="font-poppins-regular text-xs text-texto-terciario">
                  Permanecem visíveis, mas não compõem o total deste período.
                </Text>
              </View>
              {overdueOutsidePeriod.map((item) => (
                <CommitmentCard
                  key={item.id}
                  item={item}
                  onSettle={openSettlement}
                  onEdit={setEditingCommitment}
                />
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <FinancialActivityDetailModal
        item={selectedActivity}
        visible={Boolean(selectedActivity) && !isEditingActivity}
        isSubmitting={isSubmitting}
        onClose={() => setSelectedActivity(null)}
        onEdit={() => setIsEditingActivity(true)}
        onDelete={confirmActivityDelete}
      />

      <CommitmentEditModal
        item={editingCommitment}
        customers={customers}
        suppliers={suppliers}
        isSubmitting={isSubmitting}
        onClose={() => !isSubmitting && setEditingCommitment(null)}
        onSave={handleCommitmentUpdate}
        onDelete={confirmCommitmentDelete}
      />

      <FinancialActivityEditModal
        item={selectedActivity}
        visible={isEditingActivity}
        customers={customers}
        suppliers={suppliers}
        isSubmitting={isSubmitting}
        onClose={() => setIsEditingActivity(false)}
        onSubmit={handleActivityUpdate}
      />

      <Modal
        visible={Boolean(settlementItem)}
        animationType="fade"
        transparent
        onRequestClose={() => !isSubmitting && setSettlementItem(null)}
      >
        <KeyboardAvoidingView
          className="flex-1 justify-center bg-black/40 px-6"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View className="bg-white rounded-3xl p-5 gap-5">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-4">
                <Text className="font-poppins-semibold text-xl text-texto-primario">
                  {displayedSettlementItem?.type === "payable"
                    ? "Registrar pagamento"
                    : "Registrar recebimento"}
                </Text>
                <Text className="font-poppins-regular text-texto-terciario">
                  {displayedSettlementItem?.description} ·{" "}
                  {formatCurrency(displayedSettlementItem?.amount)}
                </Text>
              </View>
              <Pressable hitSlop={10} onPress={() => setSettlementItem(null)} disabled={isSubmitting}>
                <X size={24} color="#6b7280" />
              </Pressable>
            </View>
            <DateField
              label="Data da baixa"
              placeholder="DD/MM/AAAA"
              value={settlementForm.date}
              onChangeText={(value) => {
                setSettlementForm((current) => ({ ...current, date: formatDateInput(value) }));
                setSettlementErrors((current) => ({ ...current, date: "" }));
              }}
              error={settlementErrors.date}
              maximumDate={parseDate(todayInputValue())}
              required
            />
            <SelectField
              label="Forma de pagamento"
              options={PAYMENT_METHODS}
              value={settlementForm.paymentMethod}
              onChange={(value) => {
                setSettlementForm((current) => ({ ...current, paymentMethod: value }));
                setSettlementErrors((current) => ({ ...current, paymentMethod: "" }));
              }}
              placeholder="Selecione uma forma"
              error={settlementErrors.paymentMethod}
              required
            />
            <Pressable
              className="bg-azul-primario rounded-xl p-4 items-center"
              onPress={handleSettlement}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <View className="flex-row items-center gap-2">
                  <CheckCircle2 size={18} color="#ffffff" />
                  <Text className="font-poppins-semibold text-white">Confirmar baixa</Text>
                </View>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
