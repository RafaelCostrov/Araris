import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { BarChart, LineChartBicolor, PieChart } from "react-native-gifted-charts";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  ChartNoAxesCombined,
  CircleAlert,
  CircleDollarSign,
  Inbox,
  Lightbulb,
  TrendingDown,
  WalletCards,
  X,
} from "lucide-react-native";
import Card from "../../../components/Card";
import CategoryIcon from "../../../components/CategoryIcon";
import SummaryCardShort from "../../../components/SummaryCardShort";
import { useAuth } from "../../../contexts/AuthContext";
import { getFinancialDashboard } from "../../../services/financeService";

const CATEGORY_COLORS = [
  "#1d4ed8",
  "#2563eb",
  "#4f46e5",
  "#7c3aed",
  "#0891b2",
  "#0d9488",
  "#f59e0b",
  "#dc2626",
];
const Y_AXIS_LABEL_WIDTH = 42;
const PROJECTION_POINT_SPACING = 20;
const PROJECTION_LABEL_WIDTH = 44;
const CHART_VERTICAL_SECTIONS = 4;
const PROJECTION_PLOT_HEIGHT = 205;

function formatCurrency(value) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function currentMonthValue() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  return `${today.getFullYear()}-${month}`;
}

function formatCompactNumber(value) {
  const numeric = Number(value ?? 0);
  const absolute = Math.abs(numeric);
  if (absolute >= 1000000) {
    return `${(numeric / 1000000).toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
    })} mi`;
  }
  if (absolute >= 1000) {
    return `${(numeric / 1000).toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
    })} mil`;
  }
  return numeric.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function roundUpChartStep(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }

  const magnitude = 10 ** (Math.floor(Math.log10(value)) - 1);
  return Math.ceil(value / magnitude) * magnitude;
}

function formatApiDate(value, options = {}) {
  if (!value) {
    return "";
  }
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", options);
}

function formatShortDate(value) {
  return formatApiDate(value, { day: "2-digit", month: "2-digit" });
}

function formatLongDate(value) {
  const label = formatApiDate(value, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatMonth(value, short = false) {
  const date = new Date(`${value}-01T12:00:00`);
  if (short) {
    const month = date
      .toLocaleDateString("pt-BR", { month: "short" })
      .replace(".", "")
      .slice(0, 3)
      .replace(/^./, (letter) => letter.toUpperCase());
    return `${month}/${String(date.getFullYear()).slice(-2)}`;
  }

  const label = date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function SectionHeader({ title, subtitle, action }) {
  return (
    <View className="flex-row items-start justify-between gap-3 mb-4">
      <View className="flex-1">
        <Text className="font-poppins-semibold text-lg text-texto-primario">
          {title}
        </Text>
        {subtitle ? (
          <Text className="font-poppins-regular text-xs text-texto-terciario mt-0.5">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

function LegendItem({ color, label }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      <Text className="font-poppins-regular text-xs text-texto-terciario">
        {label}
      </Text>
    </View>
  );
}

function DonutBreakdownCard({
  title,
  subtitle,
  items,
  idField,
  emptyTitle,
}) {
  const [selectedKey, setSelectedKey] = useState(null);
  const itemKey = (item) => item[idField] ?? "other";
  const selectedIndex = items.findIndex(
    (item) => itemKey(item) === selectedKey,
  );
  const selectedItem = selectedIndex >= 0 ? items[selectedIndex] : null;
  const total = items.reduce(
    (sum, item) => sum + Number(item.total),
    0,
  );
  const chartData = items.map((item, index) => {
    const key = itemKey(item);
    return {
      value: Number(item.total),
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      focused: selectedKey === key,
      onPress: () =>
        setSelectedKey((current) => (current === key ? null : key)),
    };
  });

  return (
    <Card>
      <SectionHeader title={title} subtitle={subtitle} />
      {chartData.length > 0 ? (
        <>
          <View className="items-center mb-5">
            <PieChart
              data={chartData}
              donut
              radius={92}
              innerRadius={56}
              focusOnPress
              sectionAutoFocus
              focusedPieIndex={selectedIndex >= 0 ? selectedIndex : undefined}
              extraRadius={7}
              isAnimated
              animationDuration={650}
              centerLabelComponent={() => (
                <View className="items-center w-28">
                  <Text
                    className="font-poppins-regular text-[10px] text-texto-terciario text-center"
                    numberOfLines={2}
                  >
                    {selectedItem?.label ?? "Total"}
                  </Text>
                  <Text
                    className="font-poppins-semibold text-sm text-texto-primario"
                    numberOfLines={1}
                  >
                    {formatCurrency(selectedItem?.total ?? total)}
                  </Text>
                </View>
              )}
            />
          </View>
          <View className="gap-2">
            {items.map((item, index) => {
              const key = itemKey(item);
              const isSelected = selectedKey === key;
              return (
                <Pressable
                  key={key}
                  className={`flex-row items-center gap-3 py-2 px-2 rounded-xl active:opacity-70 ${
                    isSelected ? "bg-blue-50" : ""
                  }`}
                  onPress={() =>
                    setSelectedKey((current) =>
                      current === key ? null : key,
                    )
                  }
                >
                  <View
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor:
                        CATEGORY_COLORS[index % CATEGORY_COLORS.length],
                    }}
                  />
                  <Text
                    className={`text-sm flex-1 ${
                      isSelected
                        ? "font-poppins-semibold text-blue-700"
                        : "font-poppins-medium text-texto-primario"
                    }`}
                    numberOfLines={2}
                  >
                    {item.label}
                  </Text>
                  <Text
                    className={`text-xs ${
                      isSelected
                        ? "font-poppins-semibold text-blue-700"
                        : "font-poppins-regular text-texto-terciario"
                    }`}
                  >
                    {Number(item.percentage).toLocaleString("pt-BR", {
                      maximumFractionDigits: 1,
                    })}%
                  </Text>
                  <Text
                    className={`font-poppins-semibold text-sm ${
                      isSelected ? "text-blue-700" : "text-texto-primario"
                    }`}
                  >
                    {formatCurrency(item.total)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : (
        <View className="items-center py-8">
          <Inbox size={32} color="#9ca3af" />
          <Text className="font-poppins-semibold text-texto-primario mt-3">
            {emptyTitle}
          </Text>
        </View>
      )}
    </Card>
  );
}

function ProjectionAxisLabel({ label, verticalShift = 0 }) {
  return (
    <View
      style={{
        width: PROJECTION_LABEL_WIDTH,
        marginLeft:
          (PROJECTION_POINT_SPACING - PROJECTION_LABEL_WIDTH) / 2,
        transform: [{ translateY: verticalShift }],
      }}
    >
      <Text
        className="font-poppins-regular text-[10px] text-texto-terciario text-center"
        style={{ lineHeight: 16 }}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {label}
      </Text>
    </View>
  );
}

function InsightRow({ icon: Icon, title, value, description, danger = false }) {
  const color = danger ? "#b91c1c" : "#1d4ed8";
  return (
    <View className="flex-row items-center gap-3 py-3 border-b border-gray-100 last:border-b-0">
      <View
        className="w-10 h-10 rounded-2xl items-center justify-center"
        style={{ backgroundColor: danger ? "#fef2f2" : "#eff6ff" }}
      >
        <Icon size={19} color={color} />
      </View>
      <View className="flex-1">
        <Text className="font-poppins-medium text-sm text-texto-primario">
          {title}
        </Text>
        <Text className="font-poppins-regular text-xs text-texto-terciario">
          {description}
        </Text>
      </View>
      <Text
        className="font-poppins-semibold text-sm text-right"
        style={{ color }}
      >
        {value}
      </Text>
    </View>
  );
}

function DetailModal({ detail, onClose }) {
  const isVisible = Boolean(detail);
  const data = detail?.data;

  if (!detail || !data) {
    return null;
  }

  function renderDay() {
    const commitments = data?.commitments ?? [];
    return (
      <>
        <View className="rounded-2xl bg-blue-50 p-4">
          <Text className="font-poppins-medium text-xs text-blue-700">
            Saldo projetado ao fim do dia
          </Text>
          <Text className="font-poppins-semibold text-2xl text-blue-800 mt-1">
            {formatCurrency(data?.projected_balance)}
          </Text>
          <View className="flex-row gap-4 mt-3">
            <Text className="font-poppins-medium text-xs text-green-700">
              + {formatCurrency(data?.receivables)}
            </Text>
            <Text className="font-poppins-medium text-xs text-red-700">
              − {formatCurrency(data?.payables)}
            </Text>
          </View>
        </View>
        <View className="gap-2">
          <Text className="font-poppins-semibold text-texto-primario">
            Impactos do dia
          </Text>
          {commitments.length > 0 ? (
            commitments.map((item) => (
              <ImpactRow key={`${item.type}-${item.id}`} item={item} compact />
            ))
          ) : (
            <Text className="font-poppins-regular text-sm text-texto-terciario">
              Nenhum pagamento ou recebimento previsto para esta data.
            </Text>
          )}
        </View>
      </>
    );
  }

  function renderMonth() {
    const net = Number(data?.revenue ?? 0) - Number(data?.expense ?? 0);
    return (
      <View className="gap-3">
        <View className="flex-row justify-between rounded-2xl bg-green-50 p-4">
          <Text className="font-poppins-medium text-green-700">Entradas</Text>
          <Text className="font-poppins-semibold text-green-700">
            {formatCurrency(data?.revenue)}
          </Text>
        </View>
        <View className="flex-row justify-between rounded-2xl bg-red-50 p-4">
          <Text className="font-poppins-medium text-red-700">Saídas</Text>
          <Text className="font-poppins-semibold text-red-700">
            {formatCurrency(data?.expense)}
          </Text>
        </View>
        <View className="flex-row justify-between rounded-2xl bg-blue-50 p-4">
          <Text className="font-poppins-medium text-blue-700">Resultado</Text>
          <Text className="font-poppins-semibold text-blue-700">
            {formatCurrency(net)}
          </Text>
        </View>
      </View>
    );
  }

  function renderCategory() {
    return (
      <View className="items-center rounded-2xl bg-blue-50 p-6">
        <CategoryIcon category={data?.category} withBackground size={26} />
        <Text className="font-poppins-semibold text-xl text-texto-primario mt-3">
          {data?.label}
        </Text>
        <Text className="font-poppins-semibold text-2xl text-blue-700 mt-2">
          {formatCurrency(data?.total)}
        </Text>
        <Text className="font-poppins-regular text-sm text-texto-terciario mt-1">
          {Number(data?.percentage ?? 0).toLocaleString("pt-BR", {
            maximumFractionDigits: 1,
          })}% das saídas do período
        </Text>
      </View>
    );
  }

  function renderImpact() {
    return <ImpactRow item={data} compact />;
  }

  const title =
    detail?.type === "day"
      ? formatLongDate(data?.date)
      : detail?.type === "month"
        ? formatMonth(data?.month)
        : detail?.type === "category"
          ? "Despesa por categoria"
          : "Impacto no caixa";

  return (
    <Modal
      visible={isVisible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/40 justify-center px-6"
        onPress={onClose}
      >
        <Pressable
          className="bg-white rounded-3xl p-5 gap-5 max-h-[85%]"
          onPress={(event) => event.stopPropagation()}
        >
          <View className="flex-row items-center justify-between gap-3">
            <Text className="font-poppins-semibold text-xl text-texto-primario flex-1">
              {title}
            </Text>
            <Pressable hitSlop={10} onPress={onClose}>
              <X size={23} color="#6b7280" />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {detail?.type === "day"
              ? renderDay()
              : detail?.type === "month"
                ? renderMonth()
                : detail?.type === "category"
                  ? renderCategory()
                  : detail?.type === "impact"
                    ? renderImpact()
                    : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ImpactRow({ item, compact = false, onPress }) {
  if (!item) {
    return null;
  }

  const isPayable = item.type === "payable";
  const content = (
    <View className="flex-row items-center gap-3 flex-1">
      <CategoryIcon category={item.category} withBackground size={19} />
      <View className="flex-1">
        <Text
          className="font-poppins-semibold text-sm text-texto-primario"
          numberOfLines={1}
        >
          {item.description}
        </Text>
        <Text className="font-poppins-regular text-xs text-texto-terciario">
          {item.effective_status === "overdue"
            ? `Vencido em ${formatShortDate(item.due_date)}`
            : `${isPayable ? "Pagamento" : "Recebimento"} em ${formatShortDate(item.due_date)}`}
        </Text>
        <Text className="font-poppins-regular text-[10px] text-texto-terciario">
          {isPayable ? "Fornecedor" : "Cliente"}: {item.counterparty_name || "Outros"}
        </Text>
        {item.recurrence !== "none" ? (
          <Text className="font-poppins-medium text-[10px] text-azul-primario mt-0.5">
            {item.recurrence_label}
            {item.recurrence_indefinite ? " · Sem data final" : ""}
          </Text>
        ) : null}
      </View>
      <Text
        className="font-poppins-semibold text-sm"
        style={{ color: isPayable ? "#b91c1c" : "#15803d" }}
      >
        {isPayable ? "− " : "+ "}
        {formatCurrency(item.amount)}
      </Text>
    </View>
  );

  if (!onPress) {
    if (compact) {
      return <View className="py-3">{content}</View>;
    }
    return <Card>{content}</Card>;
  }

  if (!compact) {
    return <Card onPress={onPress}>{content}</Card>;
  }

  return (
    <Pressable
      className="py-3 active:opacity-70"
      onPress={onPress}
    >
      {content}
    </Pressable>
  );
}

export default function Dashboard() {
  const tabBarHeight = useBottomTabBarHeight();
  const { width } = useWindowDimensions();
  const { currentOrganization, loadSession } = useAuth();
  const dashboardMonth = currentMonthValue();
  const dashboardRequestId = useRef(0);
  const dashboardInFlightKey = useRef("");
  const [dashboard, setDashboard] = useState(null);
  const [historyMonths, setHistoryMonths] = useState(6);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [detail, setDetail] = useState(null);
  const chartWidth = Math.max(
    width * 0.9 - 32 - Y_AXIS_LABEL_WIDTH,
    180,
  );

  const loadDashboard = useCallback(async () => {
    if (!currentOrganization?.id) {
      return;
    }

    const requestKey = `${currentOrganization.id}-${dashboardMonth}-${historyMonths}`;
    if (dashboardInFlightKey.current === requestKey) {
      return;
    }
    dashboardInFlightKey.current = requestKey;

    const requestId = dashboardRequestId.current + 1;
    dashboardRequestId.current = requestId;

    try {
      setIsLoading(true);
      setLoadError("");
      const data = await getFinancialDashboard(
        currentOrganization.id,
        dashboardMonth,
        historyMonths,
      );
      if (dashboardRequestId.current === requestId) {
        setDashboard(data);
      }
    } catch (error) {
      if (dashboardRequestId.current !== requestId) {
        return;
      }
      if (error.status === 401) {
        await loadSession();
        return;
      }
      setLoadError(error.message || "Não foi possível carregar o Dashboard.");
    } finally {
      if (dashboardRequestId.current === requestId) {
        setIsLoading(false);
      }
      if (dashboardInFlightKey.current === requestKey) {
        dashboardInFlightKey.current = "";
      }
    }
  }, [currentOrganization?.id, dashboardMonth, historyMonths, loadSession]);

  const refreshDashboard = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadDashboard();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadDashboard]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard]),
  );

  useEffect(() => {
    if (currentOrganization?.id && !dashboard) {
      loadDashboard();
    }
  }, [currentOrganization?.id, dashboard, loadDashboard]);

  const forecast = dashboard?.forecast;
  const insights = dashboard?.insights ?? {};
  const categories = useMemo(
    () => dashboard?.expense_categories ?? [],
    [dashboard?.expense_categories],
  );
  const customerSegments = useMemo(
    () => dashboard?.revenue_customers ?? [],
    [dashboard?.revenue_customers],
  );
  const supplierSegments = useMemo(
    () => dashboard?.expense_suppliers ?? [],
    [dashboard?.expense_suppliers],
  );
  const history = useMemo(
    () => dashboard?.monthly_history ?? [],
    [dashboard?.monthly_history],
  );
  const upcomingImpacts = useMemo(() => {
    const directImpacts = Array.isArray(forecast?.upcoming_impacts)
      ? forecast.upcoming_impacts
      : [];
    if (directImpacts.length > 0) {
      return directImpacts;
    }

    const uniqueImpacts = new Map();
    for (const day of forecast?.daily ?? []) {
      for (const item of day.commitments ?? []) {
        const key = `${item.type}-${item.id}`;
        if (!uniqueImpacts.has(key)) {
          uniqueImpacts.set(key, {
            ...item,
            projection_date: item.projection_date ?? day.date,
          });
        }
      }
    }

    return [...uniqueImpacts.values()]
      .sort((left, right) => {
        const projectionOrder = String(left.projection_date).localeCompare(
          String(right.projection_date),
        );
        if (projectionOrder !== 0) {
          return projectionOrder;
        }
        return Number(right.amount) - Number(left.amount);
      })
      .slice(0, 8);
  }, [forecast?.daily, forecast?.upcoming_impacts]);
  const displayedHistoryMonths = dashboard?.history_months ?? historyMonths;
  const historyBarWidth = displayedHistoryMonths === 12 ? 10 : 14;
  const historyPairWidth = historyBarWidth * 2 + 3;
  const historyLabelWidth = displayedHistoryMonths === 12 ? 40 : 46;
  const historyLabelOffset = (historyLabelWidth - historyPairWidth) / 2;
  const historyGroupSpacing =
    displayedHistoryMonths === 3
      ? Math.max(
          Math.floor(
            (chartWidth -
              44 -
              displayedHistoryMonths * historyPairWidth) /
              (displayedHistoryMonths - 1),
          ),
          18,
        )
      : displayedHistoryMonths === 12
        ? 22
        : 18;

  const projectionScale = useMemo(() => {
    const balances = (forecast?.daily ?? []).map((item) =>
      Number(item.projected_balance),
    );
    const highestBalance = Math.max(0, ...balances);
    const lowestBalance = Math.min(0, ...balances);
    const negativeRange = Math.abs(lowestBalance);

    let positiveSections = CHART_VERTICAL_SECTIONS;
    let negativeSections = 0;

    if (negativeRange > 0) {
      positiveSections =
        highestBalance > 0
          ? Math.min(
              CHART_VERTICAL_SECTIONS - 1,
              Math.max(
                1,
                Math.round(
                  (CHART_VERTICAL_SECTIONS * highestBalance) /
                    (highestBalance + negativeRange),
                ),
              ),
            )
          : 1;
      negativeSections = CHART_VERTICAL_SECTIONS - positiveSections;
    }

    const stepValue = roundUpChartStep(
      Math.max(
        highestBalance / positiveSections,
        negativeSections > 0 ? negativeRange / negativeSections : 0,
      ),
    );

    return {
      height:
        (PROJECTION_PLOT_HEIGHT * positiveSections) /
        CHART_VERTICAL_SECTIONS,
      maxValue: stepValue * positiveSections,
      mostNegativeValue: -stepValue * negativeSections,
      negativeSections,
      positiveSections,
      stepValue,
      xAxisLabelShift:
        (PROJECTION_PLOT_HEIGHT * negativeSections) /
        CHART_VERTICAL_SECTIONS,
    };
  }, [forecast?.daily]);

  const projectionData = useMemo(
    () =>
      (forecast?.daily ?? []).map((item, index) => ({
        value: Number(item.projected_balance),
        label: index % 7 === 0 ? formatShortDate(item.date) : "",
        labelComponent:
          index % 7 === 0
            ? () => (
                <ProjectionAxisLabel
                  label={formatShortDate(item.date)}
                  verticalShift={projectionScale.xAxisLabelShift}
                />
              )
            : undefined,
        dataPointColor:
          Number(item.projected_balance) < 0 ? "#dc2626" : "#2563eb",
        dataPointRadius: item.commitments.length > 0 ? 4 : 2,
        hideDataPoint: item.commitments.length === 0 && index % 7 !== 0,
        onPress: () => setDetail({ type: "day", data: item }),
      })),
    [forecast?.daily, projectionScale.xAxisLabelShift],
  );

  const historyData = useMemo(
    () =>
      history.flatMap((item) => [
        {
          value: Number(item.revenue),
          label: formatMonth(item.month, true),
          labelWidth: historyLabelWidth,
          frontColor: "#16a34a",
          spacing: 3,
          labelTextStyle: {
            color: "#6b7280",
            fontSize: 9,
            transform: [{ translateX: -historyLabelOffset }],
          },
          onPress: () => setDetail({ type: "month", data: item }),
        },
        {
          value: Number(item.expense),
          frontColor: "#ef4444",
          spacing: historyGroupSpacing,
          onPress: () => setDetail({ type: "month", data: item }),
        },
      ]),
    [
      history,
      historyGroupSpacing,
      historyLabelOffset,
      historyLabelWidth,
    ],
  );

  const historyScale = useMemo(() => {
    const highestValue = Math.max(
      0,
      ...history.flatMap((item) => [
        Number(item.revenue),
        Number(item.expense),
      ]),
    );
    const stepValue = roundUpChartStep(
      highestValue / CHART_VERTICAL_SECTIONS,
    );

    return {
      maxValue: stepValue * CHART_VERTICAL_SECTIONS,
      stepValue,
    };
  }, [history]);

  const largestImpact = insights.largest_upcoming_impact;
  const largestOutflowDay = insights.largest_outflow_day;
  const topCategory = insights.top_expense_category;

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshDashboard}
          />
        }
      >
        <View className="w-[90%] self-center pt-4 gap-4">
          <View>
            <Text className="font-poppins-semibold text-2xl text-texto-primario">
              Dashboard financeiro
            </Text>
            <Text className="font-poppins-regular text-sm text-texto-terciario mt-1">
              Histórico, composição e visão dos próximos 30 dias.
            </Text>
          </View>

          {loadError ? (
            <Pressable
              className="rounded-2xl bg-red-50 p-4"
              onPress={loadDashboard}
            >
              <Text className="font-poppins-medium text-red-700">
                {loadError}
              </Text>
              <Text className="font-poppins-regular text-red-600 text-sm mt-1">
                Toque para tentar novamente.
              </Text>
            </Pressable>
          ) : null}

          {isLoading && !dashboard ? (
            <View className="py-24 items-center">
              <ActivityIndicator size="large" color="#0063f5" />
            </View>
          ) : dashboard ? (
            <>
              <View className="gap-4">
                <View className="flex-row gap-4">
                  <SummaryCardShort
                    icon={<WalletCards size={22} color="#1d4ed8" />}
                    title="Saldo Atual"
                    value={formatCurrency(forecast.current_balance)}
                    period="Hoje"
                  />
                  <SummaryCardShort
                    icon={
                      <ChartNoAxesCombined
                        size={22}
                        color={forecast.has_deficit ? "#b91c1c" : "#0f766e"}
                      />
                    }
                    title="Saldo Projetado"
                    value={formatCurrency(forecast.projected_balance)}
                    period="em 30 dias"
                  />
                </View>
                <View className="flex-row gap-4">
                  <SummaryCardShort
                    icon={<ArrowDownRight size={22} color="#b91c1c" />}
                    title="A Pagar"
                    value={formatCurrency(forecast.total_payables)}
                    period="em 30 dias"
                  />
                  <SummaryCardShort
                    icon={<ArrowUpRight size={22} color="#15803d" />}
                    title="A Receber"
                    value={formatCurrency(forecast.total_receivables)}
                    period="em 30 dias"
                  />
                </View>
              </View>

              {forecast.has_deficit ? (
                <View className="rounded-2xl bg-red-50 border border-red-100 p-4 flex-row items-start gap-3">
                  <CircleAlert size={23} color="#b91c1c" />
                  <View className="flex-1">
                    <Text className="font-poppins-semibold text-red-700">
                      Atenção ao caixa projetado
                    </Text>
                    <Text className="font-poppins-regular text-sm text-red-600 mt-1">
                      O saldo pode chegar a {formatCurrency(forecast.lowest_balance)} em {formatLongDate(forecast.lowest_balance_date)}.
                    </Text>
                  </View>
                </View>
              ) : null}

              <Card>
                <SectionHeader
                  title="Saldo projetado"
                  subtitle="Toque nos pontos para ver os impactos de cada dia."
                  action={
                    <View className="rounded-full bg-blue-50 px-3 py-1.5">
                      <Text className="font-poppins-semibold text-xs text-blue-700">
                        30 dias
                      </Text>
                    </View>
                  }
                />
                <View className="flex-row gap-4 mb-4">
                  <View>
                    <Text className="font-poppins-regular text-xs text-texto-terciario">
                      Menor saldo
                    </Text>
                    <Text
                      className={`font-poppins-semibold ${
                        Number(forecast.lowest_balance) < 0
                          ? "text-red-700"
                          : "text-texto-primario"
                      }`}
                    >
                      {formatCurrency(forecast.lowest_balance)}
                    </Text>
                  </View>
                  <View>
                    <Text className="font-poppins-regular text-xs text-texto-terciario">
                      Data
                    </Text>
                    <Text className="font-poppins-semibold text-texto-primario">
                      {formatShortDate(forecast.lowest_balance_date)}
                    </Text>
                  </View>
                </View>
                <LineChartBicolor
                  data={projectionData}
                  width={chartWidth}
                  height={projectionScale.height}
                  spacing={PROJECTION_POINT_SPACING}
                  areaChart
                  color="#2563eb"
                  colorNegative="#dc2626"
                  startFillColor="#60a5fa"
                  endFillColor="#ffffff"
                  startFillColorNegative="#f87171"
                  endFillColorNegative="#ffffff"
                  startOpacity={0.28}
                  endOpacity={0.02}
                  startOpacityNegative={0.26}
                  endOpacityNegative={0.02}
                  thickness={3}
                  dataPointsColor="#2563eb"
                  dataPointsRadius={3}
                  noOfSections={projectionScale.positiveSections}
                  noOfSectionsBelowXAxis={projectionScale.negativeSections}
                  maxValue={projectionScale.maxValue}
                  mostNegativeValue={projectionScale.mostNegativeValue}
                  stepValue={projectionScale.stepValue}
                  rulesColor="#e5e7eb"
                  rulesType="dashed"
                  xAxisColor="#d1d5db"
                  yAxisColor="transparent"
                  yAxisTextStyle={{ color: "#6b7280", fontSize: 9 }}
                  xAxisLabelTextStyle={{ color: "#6b7280", fontSize: 9 }}
                  xAxisLabelsHeight={26}
                  xAxisTextNumberOfLines={1}
                  formatYLabel={(label) => formatCompactNumber(label)}
                  yAxisLabelWidth={Y_AXIS_LABEL_WIDTH}
                  initialSpacing={PROJECTION_LABEL_WIDTH / 2}
                  endSpacing={PROJECTION_LABEL_WIDTH / 2}
                  showScrollIndicator={false}
                  allowFontScaling={false}
                  isAnimated
                  animationDuration={650}
                />
                <Text className="font-poppins-regular text-[10px] text-texto-terciario text-center mt-2">
                  Deslize horizontalmente para ver os 30 dias. Vencidos entram
                  no primeiro dia.
                </Text>
              </Card>

              <Card>
                <SectionHeader
                  title="Entradas x Saídas"
                  subtitle={`Histórico encerrado em ${formatMonth(dashboardMonth)}.`}
                  action={
                    <View className="flex-row rounded-full bg-gray-100 p-1">
                      {[3, 6, 12].map((months) => (
                        <Pressable
                          key={months}
                          className={`rounded-full px-3 py-1 ${
                            historyMonths === months ? "bg-white" : ""
                          }`}
                          onPress={() => setHistoryMonths(months)}
                        >
                          <Text
                            className={`font-poppins-semibold text-xs ${
                              historyMonths === months
                                ? "text-azul-primario"
                                : "text-texto-terciario"
                            }`}
                          >
                            {months}m
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  }
                />
                <View className="flex-row gap-4 mb-4">
                  <LegendItem color="#16a34a" label="Entradas" />
                  <LegendItem color="#ef4444" label="Saídas" />
                </View>
                <BarChart
                  key={`history-${dashboard.history_months}-${dashboard.period}`}
                  data={historyData}
                  width={chartWidth}
                  height={190}
                  barWidth={historyBarWidth}
                  spacing={0}
                  initialSpacing={22}
                  endSpacing={22}
                  noOfSections={CHART_VERTICAL_SECTIONS}
                  maxValue={historyScale.maxValue}
                  stepValue={historyScale.stepValue}
                  rulesColor="#e5e7eb"
                  rulesType="dashed"
                  xAxisColor="#d1d5db"
                  yAxisColor="transparent"
                  yAxisTextStyle={{ color: "#6b7280", fontSize: 9 }}
                  xAxisLabelTextStyle={{ color: "#6b7280", fontSize: 9 }}
                  xAxisLabelsHeight={26}
                  xAxisLabelsVerticalShift={5}
                  xAxisTextNumberOfLines={1}
                  formatYLabel={(label) => formatCompactNumber(label)}
                  yAxisLabelWidth={Y_AXIS_LABEL_WIDTH}
                  roundedTop
                  allowFontScaling={false}
                  isAnimated
                  animationDuration={600}
                  showScrollIndicator={false}
                />
              </Card>

              <DonutBreakdownCard
                title="Despesas por categoria"
                subtitle={formatMonth(dashboardMonth)}
                items={categories}
                idField="category"
                emptyTitle="Nenhuma saída neste mês"
              />

              <DonutBreakdownCard
                title="Entradas por cliente"
                subtitle={`${formatMonth(dashboardMonth)} · Sem vínculo aparece em Outros`}
                items={customerSegments}
                idField="customer_id"
                emptyTitle="Nenhuma entrada neste mês"
              />

              <DonutBreakdownCard
                title="Saídas por fornecedor"
                subtitle={`${formatMonth(dashboardMonth)} · Sem vínculo aparece em Outros`}
                items={supplierSegments}
                idField="supplier_id"
                emptyTitle="Nenhuma saída neste mês"
              />

              <Card>
                <SectionHeader
                  title="Próximos impactos no caixa"
                  subtitle="Pendências vencidas e compromissos dos próximos 30 dias."
                />
                {upcomingImpacts.length > 0 ? (
                  <View className="gap-1">
                    {upcomingImpacts.map((item) => (
                      <ImpactRow
                        key={`${item.type}-${item.id}`}
                        item={item}
                        compact
                        onPress={() =>
                          setDetail({ type: "impact", data: item })
                        }
                      />
                    ))}
                  </View>
                ) : (
                  <View className="p-6 items-center">
                    <CalendarClock size={32} color="#9ca3af" />
                    <Text className="font-poppins-semibold text-texto-primario mt-3">
                      Nenhum impacto previsto
                    </Text>
                  </View>
                )}
              </Card>

              <Card>
                <SectionHeader
                  title="Indicadores do período"
                  subtitle="Leituras automáticas a partir dos seus lançamentos."
                  action={<Lightbulb size={21} color="#1d4ed8" />}
                />
                <InsightRow
                  icon={forecast.has_deficit ? CircleAlert : CircleDollarSign}
                  title="Menor saldo projetado"
                  value={formatCurrency(insights.lowest_balance)}
                  description={formatLongDate(insights.lowest_balance_date)}
                  danger={forecast.has_deficit}
                />
                {topCategory ? (
                  <InsightRow
                    icon={TrendingDown}
                    title="Maior categoria de saída"
                    value={formatCurrency(topCategory.total)}
                    description={`${topCategory.label} · ${Number(
                      topCategory.percentage,
                    ).toLocaleString("pt-BR", {
                      maximumFractionDigits: 1,
                    })}% das saídas`}
                  />
                ) : null}
                {largestImpact ? (
                  <InsightRow
                    icon={CalendarClock}
                    title="Maior impacto futuro"
                    value={formatCurrency(largestImpact.amount)}
                    description={`${largestImpact.description} · ${formatShortDate(
                      largestImpact.due_date,
                    )}`}
                    danger={largestImpact.type === "payable"}
                  />
                ) : null}
                {largestOutflowDay ? (
                  <InsightRow
                    icon={ArrowDownRight}
                    title="Maior saída prevista em um dia"
                    value={formatCurrency(largestOutflowDay.payables)}
                    description={formatLongDate(largestOutflowDay.date)}
                    danger
                  />
                ) : null}
              </Card>
            </>
          ) : null}
        </View>
      </ScrollView>

      <DetailModal detail={detail} onClose={() => setDetail(null)} />
    </View>
  );
}
