import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import CommitmentStatusWidget from "../../../components/CommitmentStatusWidget";
import FinancialActivityDetailModal from "../../../components/FinancialActivityDetailModal";
import FinancialActivityEditModal from "../../../components/FinancialActivityEditModal";
import HomeFinancialOverview from "../../../components/HomeFinancialOverview";
import LoadErrorCard from "../../../components/LoadErrorCard";
import OrganizationGreeting from "../../../components/OrganizationGreeting";
import RecentActivityCard from "../../../components/RecentActivityCard";
import { useAuth } from "../../../contexts/AuthContext";
import { useFinancePeriod } from "../../../contexts/FinancePeriodContext";
import {
  deleteFinancialActivity,
  getFinancialSummary,
  listCustomers,
  listSuppliers,
  updateFinancialActivity,
} from "../../../services/financeService";
import { formatMonthPeriod } from "../../../utils/financeFormatters";
import FinanceDetails from "../finance-details";

export default function Home() {
  const tabBarHeight = useBottomTabBarHeight();
  const { currentOrganization, loadSession, user } = useAuth();
  const { selectedMonth } = useFinancePeriod();
  const [summary, setSummary] = useState(null);
  const [loadedSummaryPeriod, setLoadedSummaryPeriod] = useState(null);
  const [financialDetailKind, setFinancialDetailKind] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loadErrorPeriod, setLoadErrorPeriod] = useState(null);
  const summaryRequestId = useRef(0);
  const firstName = user?.name?.split(" ")[0] ?? "bem-vindo";

  const loadSummary = useCallback(async () => {
    if (!currentOrganization?.id) {
      return;
    }

    const requestId = summaryRequestId.current + 1;
    const requestPeriod = selectedMonth;
    summaryRequestId.current = requestId;

    try {
      setIsLoading(true);
      setLoadError("");
      setLoadErrorPeriod(null);
      const data = await getFinancialSummary(
        currentOrganization.id,
        requestPeriod,
      );
      if (requestId !== summaryRequestId.current) {
        return;
      }
      setSummary(data);
      setLoadedSummaryPeriod(requestPeriod);
    } catch (error) {
      if (requestId !== summaryRequestId.current) {
        return;
      }
      if (error.status === 401) {
        await loadSession();
        return;
      }

      setLoadError(error.message || "Não foi possível carregar o resumo financeiro.");
      setLoadErrorPeriod(requestPeriod);
    } finally {
      if (requestId === summaryRequestId.current) {
        setIsLoading(false);
      }
    }
  }, [currentOrganization?.id, loadSession, selectedMonth]);

  const loadContacts = useCallback(async () => {
    if (!currentOrganization?.id) {
      return;
    }

    try {
      const [customerData, supplierData] = await Promise.all([
        listCustomers(currentOrganization.id),
        listSuppliers(currentOrganization.id),
      ]);
      setCustomers(customerData);
      setSuppliers(supplierData);
    } catch (error) {
      if (error.status === 401) {
        await loadSession();
      }
    }
  }, [currentOrganization?.id, loadSession]);

  const refreshSummary = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadSummary();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadSummary]);

  useFocusEffect(
    useCallback(() => {
      loadSummary();
    }, [loadSummary]),
  );

  useFocusEffect(
    useCallback(() => {
      loadContacts();
    }, [loadContacts]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!financialDetailKind) {
        return undefined;
      }

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          setFinancialDetailKind(null);
          loadSummary();
          return true;
        },
      );

      return () => subscription.remove();
    }, [financialDetailKind, loadSummary]),
  );

  async function handleUpdate(payload) {
    if (!selectedItem) {
      return;
    }

    try {
      setIsSubmitting(true);
      await updateFinancialActivity(selectedItem.type, selectedItem.id, payload);
      setIsEditing(false);
      setSelectedItem(null);
      await loadSummary();
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

  async function handleDelete() {
    if (!selectedItem) {
      return;
    }

    try {
      setIsSubmitting(true);
      await deleteFinancialActivity(selectedItem.type, selectedItem.id);
      setSelectedItem(null);
      await loadSummary();
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

  function confirmDelete() {
    const reopensCommitment = Boolean(selectedItem?.source_commitment_id);
    Alert.alert(
      "Remover atividade",
      reopensCommitment
        ? "A atividade será removida e o compromisso correspondente voltará a ficar pendente. Deseja continuar?"
        : "Esta atividade será removida definitivamente. Deseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Remover", style: "destructive", onPress: handleDelete },
      ],
    );
  }

  const currentSummary =
    loadedSummaryPeriod === selectedMonth ? summary : null;
  const currentLoadError =
    loadErrorPeriod === selectedMonth ? loadError : "";
  const totals = currentSummary?.totals ?? {};
  const counts = currentSummary?.counts ?? {};
  const activity = currentSummary?.recent_activity ?? [];
  const currentPeriod = formatMonthPeriod(currentSummary?.period);
  const overdueCount =
    Number(counts.overdue_payables ?? 0) +
    Number(counts.overdue_receivables ?? 0);
  const dueTodayCount =
    Number(counts.due_today_payables ?? 0) +
    Number(counts.due_today_receivables ?? 0);

  function openFinancialDetail(kind) {
    setFinancialDetailKind(kind);
  }

  function closeFinancialDetail() {
    setFinancialDetailKind(null);
    loadSummary();
  }

  if (financialDetailKind) {
    return (
      <FinanceDetails
        kindOverride={financialDetailKind}
        onBack={closeFinancialDetail}
      />
    );
  }

  return (
    <View className="flex-1 bg-gray-50 pt-2">
      <ScrollView
        className="w-full"
        contentContainerStyle={{ paddingTop: 4, paddingBottom: tabBarHeight + 16 }}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refreshSummary} />
        }
      >
        <View className="w-[90%] self-center gap-4">
          <OrganizationGreeting
            firstName={firstName}
            organizationName={currentOrganization?.business_name}
          />

          <LoadErrorCard message={currentLoadError} onRetry={loadSummary} />

          {overdueCount > 0 ? (
            <CommitmentStatusWidget
              variant="overdue"
              count={overdueCount}
              payableAmount={totals.overdue_payables}
              receivableAmount={totals.overdue_receivables}
              onPress={() => openFinancialDetail("overdue")}
            />
          ) : dueTodayCount > 0 ? (
            <CommitmentStatusWidget
              variant="due_today"
              count={dueTodayCount}
              payableAmount={totals.due_today_payables}
              receivableAmount={totals.due_today_receivables}
              onPress={() => openFinancialDetail("due_today")}
            />
          ) : null}

          {isLoading && !currentSummary ? (
            <View className="py-20 items-center">
              <ActivityIndicator color="#0063f5" size="large" />
            </View>
          ) : currentSummary ? (
            <>
              <HomeFinancialOverview
                totals={totals}
                period={currentPeriod}
                onOpenDetail={openFinancialDetail}
              />
              <RecentActivityCard
                items={activity}
                onItemPress={setSelectedItem}
              />
            </>
          ) : null}
        </View>
      </ScrollView>

      <FinancialActivityDetailModal
        item={selectedItem}
        visible={Boolean(selectedItem) && !isEditing}
        isSubmitting={isSubmitting}
        onClose={() => setSelectedItem(null)}
        onEdit={() => setIsEditing(true)}
        onDelete={confirmDelete}
      />
      <FinancialActivityEditModal
        item={selectedItem}
        visible={isEditing}
        customers={customers}
        suppliers={suppliers}
        isSubmitting={isSubmitting}
        onClose={() => setIsEditing(false)}
        onSubmit={handleUpdate}
      />
    </View>
  );
}
