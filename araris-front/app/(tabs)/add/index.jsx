import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Inbox,
  Pencil,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  Truck,
  Users,
  X,
} from "lucide-react-native";
import Card from "../../../components/Card";
import CategoryIcon from "../../../components/CategoryIcon";
import CommitmentEditModal from "../../../components/CommitmentEditModal";
import DateField from "../../../components/DateField";
import FinanceConfirmationModal from "../../../components/FinanceConfirmationModal";
import InputText from "../../../components/InputText";
import SearchableSelectField from "../../../components/SearchableSelectField";
import SelectField from "../../../components/SelectField";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  RECURRENCE_OPTIONS,
  REVENUE_CATEGORIES,
} from "../../../constants/financeOptions";
import { useAuth } from "../../../contexts/AuthContext";
import { useFinancePeriod } from "../../../contexts/FinancePeriodContext";
import {
  createExpense,
  createCustomer,
  createPayable,
  createReceivable,
  createRevenue,
  createSupplier,
  deactivateCustomer,
  deactivateSupplier,
  deleteFinancialCommitment,
  listCustomers,
  listCommitments,
  listSuppliers,
  settlePayable,
  settleReceivable,
  updateCustomer,
  updateFinancialCommitment,
  updateSupplier,
} from "../../../services/financeService";


const ACTIONS = [
  {
    type: "revenue",
    title: "Entrada recebida",
    subtitle: "Dinheiro que já entrou",
    color: "#15803d",
    background: "#dcfce7",
    icon: ArrowDownToLine,
  },
  {
    type: "expense",
    title: "Saída paga",
    subtitle: "Despesa já realizada",
    color: "#b91c1c",
    background: "#fee2e2",
    icon: ArrowUpFromLine,
  },
  {
    type: "receivable",
    title: "Conta a receber",
    subtitle: "Entrada para outra data",
    color: "#1d4ed8",
    background: "#dbeafe",
    icon: CalendarClock,
  },
  {
    type: "payable",
    title: "Conta a pagar",
    subtitle: "Compromisso futuro",
    color: "#c2410c",
    background: "#ffedd5",
    icon: CircleDollarSign,
  },
];

const STATUS_FILTERS = [
  { value: "pending", label: "Pendentes" },
  { value: "overdue", label: "Vencidos" },
  { value: "completed", label: "Concluídos" },
];

function todayInputValue() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${today.getFullYear()}`;
}

function initialForm() {
  return {
    description: "",
    amount: "",
    date: todayInputValue(),
    category: "",
    paymentMethod: "pix",
    recurrence: "none",
    recurrenceIndefinite: false,
    occurrences: "2",
    counterpartyId: "",
    notes: "",
  };
}

function initialCounterpartyForm() {
  return {
    name: "",
    document: "",
    email: "",
    phone: "",
  };
}

function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function formatDateInput(value) {
  const digits = onlyDigits(value).slice(0, 8);
  return digits
    .replace(/^(\d{2})(\d)/, "$1/$2")
    .replace(/^(\d{2})\/(\d{2})(\d)/, "$1/$2/$3");
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

function normalizeAmount(value) {
  const trimmed = String(value ?? "").trim();

  if (trimmed.includes(",")) {
    return trimmed.replace(/\./g, "").replace(",", ".");
  }

  return trimmed;
}

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

function actionConfig(type) {
  return ACTIONS.find((action) => action.type === type);
}

function categoriesFor(type) {
  return ["revenue", "receivable"].includes(type)
    ? REVENUE_CATEGORIES
    : EXPENSE_CATEGORIES;
}

function isRealizedMovement(type) {
  return ["revenue", "expense"].includes(type);
}

function optionLabel(options, value) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export default function Add() {
  const tabBarHeight = useBottomTabBarHeight();
  const { currentOrganization, loadSession } = useAuth();
  const { selectedMonth } = useFinancePeriod();
  const [selectedAction, setSelectedAction] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commitments, setCommitments] = useState([]);
  const [overdueCommitments, setOverdueCommitments] = useState([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [settlementItem, setSettlementItem] = useState(null);
  const [editingCommitment, setEditingCommitment] = useState(null);
  const [settlementForm, setSettlementForm] = useState({
    date: todayInputValue(),
    paymentMethod: "pix",
  });
  const [settlementErrors, setSettlementErrors] = useState({});
  const [creationValidation, setCreationValidation] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [isCreatingCounterparty, setIsCreatingCounterparty] = useState(false);
  const [counterpartyForm, setCounterpartyForm] = useState(
    initialCounterpartyForm,
  );
  const [counterpartyErrors, setCounterpartyErrors] = useState({});
  const [contactManagerType, setContactManagerType] = useState(null);
  const [managerForm, setManagerForm] = useState(initialCounterpartyForm);
  const [managerErrors, setManagerErrors] = useState({});
  const [editingManagedContact, setEditingManagedContact] = useState(null);
  const [contactSearch, setContactSearch] = useState("");

  const loadCommitments = useCallback(async () => {
    if (!currentOrganization?.id) {
      return;
    }

    try {
      setIsLoading(true);
      setLoadError("");
      const [data, overdueData] = await Promise.all([
        listCommitments(currentOrganization.id, statusFilter, selectedMonth),
        statusFilter === "overdue"
          ? Promise.resolve(null)
          : listCommitments(currentOrganization.id, "overdue", selectedMonth),
      ]);
      setCommitments(data);
      setOverdueCommitments(overdueData ?? data);
    } catch (error) {
      if (error.status === 401) {
        await loadSession();
        return;
      }

      setLoadError(error.message || "Não foi possível carregar os compromissos.");
    } finally {
      setIsLoading(false);
    }
  }, [currentOrganization?.id, loadSession, selectedMonth, statusFilter]);

  const refreshCommitments = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadCommitments();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadCommitments]);

  const loadCounterparties = useCallback(async () => {
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

  useFocusEffect(
    useCallback(() => {
      loadCommitments();
      loadCounterparties();
    }, [loadCommitments, loadCounterparties]),
  );

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: "" }));
  }

  function openCreateModal(type) {
    setSelectedAction(type);
    setForm(initialForm());
    setFormErrors({});
    setCreationValidation(null);
    setIsCreatingCounterparty(false);
    setCounterpartyForm(initialCounterpartyForm());
    setCounterpartyErrors({});
  }

  function updateCounterpartyForm(field, value) {
    setCounterpartyForm((current) => ({ ...current, [field]: value }));
    setCounterpartyErrors((current) => ({ ...current, [field]: "" }));
  }

  async function handleCreateCounterparty() {
    const nextErrors = {};
    if (!counterpartyForm.name.trim()) {
      nextErrors.name = "Informe um nome.";
    }
    setCounterpartyErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !currentOrganization?.id) {
      return;
    }

    const isIncome = ["revenue", "receivable"].includes(selectedAction);
    const createContact = isIncome ? createCustomer : createSupplier;

    try {
      setIsSubmitting(true);
      const contact = await createContact(currentOrganization.id, {
        name: counterpartyForm.name.trim(),
        document: counterpartyForm.document.trim(),
        email: counterpartyForm.email.trim(),
        phone: counterpartyForm.phone.trim(),
      });
      if (isIncome) {
        setCustomers((current) =>
          [...current, contact].sort((left, right) =>
            left.name.localeCompare(right.name, "pt-BR"),
          ),
        );
      } else {
        setSuppliers((current) =>
          [...current, contact].sort((left, right) =>
            left.name.localeCompare(right.name, "pt-BR"),
          ),
        );
      }
      updateForm("counterpartyId", contact.id);
      setIsCreatingCounterparty(false);
      setCounterpartyForm(initialCounterpartyForm());
    } catch (error) {
      if (error.status === 401) {
        await loadSession();
        return;
      }
      Alert.alert(
        `Não foi possível cadastrar ${isIncome ? "o cliente" : "o fornecedor"}`,
        error.message || "Revise os dados e tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function openContactManager(type) {
    setContactManagerType(type);
    setManagerForm(initialCounterpartyForm());
    setManagerErrors({});
    setEditingManagedContact(null);
    setContactSearch("");
  }

  function closeContactManager() {
    if (!isSubmitting) {
      setContactManagerType(null);
      setContactSearch("");
    }
  }

  function updateManagerForm(field, value) {
    setManagerForm((current) => ({ ...current, [field]: value }));
    setManagerErrors((current) => ({ ...current, [field]: "" }));
  }

  async function handleCreateManagedContact() {
    const nextErrors = {};
    if (!managerForm.name.trim()) {
      nextErrors.name = "Informe um nome.";
    }
    setManagerErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !currentOrganization?.id) {
      return;
    }

    const isCustomer = contactManagerType === "customer";
    try {
      setIsSubmitting(true);
      const payload = {
        name: managerForm.name.trim(),
        document: managerForm.document.trim(),
        email: managerForm.email.trim(),
        phone: managerForm.phone.trim(),
      };
      const contact = editingManagedContact
        ? await (isCustomer ? updateCustomer : updateSupplier)(
            editingManagedContact.id,
            payload,
          )
        : await (isCustomer ? createCustomer : createSupplier)(
            currentOrganization.id,
            payload,
          );
      const updateContacts = (current) =>
        (editingManagedContact
          ? current.map((item) => (item.id === contact.id ? contact : item))
          : [...current, contact]
        ).sort((left, right) =>
          left.name.localeCompare(right.name, "pt-BR"),
        );
      if (isCustomer) {
        setCustomers(updateContacts);
      } else {
        setSuppliers(updateContacts);
      }
      setManagerForm(initialCounterpartyForm());
      setEditingManagedContact(null);
    } catch (error) {
      if (error.status === 401) {
        await loadSession();
        return;
      }
      Alert.alert(
        "Não foi possível cadastrar",
        error.message || "Revise os dados e tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function editManagedContact(contact) {
    setEditingManagedContact(contact);
    setManagerForm({
      name: contact.name ?? "",
      document: contact.document ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
    });
    setManagerErrors({});
  }

  function confirmDeactivateContact(contact) {
    const isCustomer = contactManagerType === "customer";
    Alert.alert(
      `Desativar ${isCustomer ? "cliente" : "fornecedor"}`,
      `${contact.name} deixará de aparecer em novos lançamentos. O histórico financeiro será preservado.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Desativar",
          style: "destructive",
          onPress: async () => {
            try {
              setIsSubmitting(true);
              await (isCustomer ? deactivateCustomer : deactivateSupplier)(
                contact.id,
              );
              if (isCustomer) {
                setCustomers((current) =>
                  current.filter((item) => item.id !== contact.id),
                );
              } else {
                setSuppliers((current) =>
                  current.filter((item) => item.id !== contact.id),
                );
              }
              setForm((current) =>
                current.counterpartyId === contact.id
                  ? { ...current, counterpartyId: "" }
                  : current,
              );
              if (editingManagedContact?.id === contact.id) {
                setEditingManagedContact(null);
                setManagerForm(initialCounterpartyForm());
              }
            } catch (error) {
              Alert.alert(
                "Não foi possível desativar",
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

  function closeCreateModal() {
    if (!isSubmitting) {
      setSelectedAction(null);
      setCreationValidation(null);
    }
  }

  function validateForm() {
    const nextErrors = {};
    const normalizedAmount = normalizeAmount(form.amount);
    const numericAmount = Number(normalizedAmount);
    const parsedDate = parseDate(form.date);

    if (!form.description.trim()) {
      nextErrors.description = "Informe uma descrição.";
    }
    if (!normalizedAmount || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      nextErrors.amount = "Informe um valor maior que zero.";
    }
    if (!parsedDate) {
      nextErrors.date = "Informe uma data válida.";
    }
    if (
      parsedDate &&
      form.recurrenceIndefinite &&
      parsedDate < parseDate(todayInputValue())
    ) {
      nextErrors.date =
        "Uma recorrência sem data final deve começar hoje ou no futuro.";
    }
    if (!form.category) {
      nextErrors.category = "Selecione uma categoria.";
    }
    if (isRealizedMovement(selectedAction) && !form.paymentMethod) {
      nextErrors.paymentMethod = "Selecione uma forma de pagamento.";
    }
    const occurrences = Number(form.occurrences);
    if (
      !isRealizedMovement(selectedAction) &&
      form.recurrence !== "none" &&
      !form.recurrenceIndefinite &&
      (!Number.isInteger(occurrences) || occurrences < 2 || occurrences > 60)
    ) {
      nextErrors.occurrences = "Informe entre 2 e 60 ocorrências.";
    }

    setFormErrors(nextErrors);
    return {
      isValid: Object.keys(nextErrors).length === 0,
      amount: normalizedAmount,
      date: parsedDate,
      occurrences:
        form.recurrence === "none" || form.recurrenceIndefinite ? 1 : occurrences,
    };
  }

  function requestCreateConfirmation() {
    const validation = validateForm();

    if (!validation.isValid || !currentOrganization?.id) {
      return;
    }

    setCreationValidation(validation);
  }

  async function handleCreate() {
    const validation = creationValidation;

    if (!validation?.isValid || !currentOrganization?.id) {
      setCreationValidation(null);
      return;
    }

    const commonPayload = {
      description: form.description.trim(),
      amount: validation.amount,
      category: form.category,
      notes: form.notes.trim(),
    };
    const counterpartyPayload = ["revenue", "receivable"].includes(
      selectedAction,
    )
      ? { customer_id: form.counterpartyId || null }
      : { supplier_id: form.counterpartyId || null };

    const requests = {
      revenue: () =>
        createRevenue(currentOrganization.id, {
          ...commonPayload,
          ...counterpartyPayload,
          occurred_on: validation.date,
          payment_method: form.paymentMethod,
        }),
      expense: () =>
        createExpense(currentOrganization.id, {
          ...commonPayload,
          ...counterpartyPayload,
          occurred_on: validation.date,
          payment_method: form.paymentMethod,
        }),
      payable: () =>
        createPayable(currentOrganization.id, {
          ...commonPayload,
          ...counterpartyPayload,
          due_date: validation.date,
          recurrence: form.recurrence,
          recurrence_indefinite: form.recurrenceIndefinite,
          occurrences: validation.occurrences,
        }),
      receivable: () =>
        createReceivable(currentOrganization.id, {
          ...commonPayload,
          ...counterpartyPayload,
          due_date: validation.date,
          recurrence: form.recurrence,
          recurrence_indefinite: form.recurrenceIndefinite,
          occurrences: validation.occurrences,
        }),
    };

    try {
      setIsSubmitting(true);
      await requests[selectedAction]();
      setCreationValidation(null);
      setSelectedAction(null);
      await loadCommitments();
    } catch (error) {
      if (error.status === 401) {
        await loadSession();
        return;
      }

      Alert.alert(
        "Não foi possível registrar",
        error.message || "Revise os dados e tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function openSettlement(item) {
    setSettlementItem(item);
    setSettlementForm({ date: todayInputValue(), paymentMethod: "pix" });
    setSettlementErrors({});
  }

  function closeSettlement() {
    if (!isSubmitting) {
      setSettlementItem(null);
    }
  }

  async function handleSettlement() {
    const parsedDate = parseDate(settlementForm.date);
    const nextErrors = {};

    if (!parsedDate) {
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
        date: parsedDate,
        payment_method: settlementForm.paymentMethod,
      };

      if (settlementItem.type === "payable") {
        await settlePayable(settlementItem.id, payload);
      } else {
        await settleReceivable(settlementItem.id, payload);
      }

      setSettlementItem(null);
      await loadCommitments();
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
      await loadCommitments();
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
              await loadCommitments();
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

  const selectedConfig = actionConfig(selectedAction);
  const confirmationRows = creationValidation
    ? [
        { label: "Tipo", value: selectedConfig?.title },
        { label: "Descrição", value: form.description.trim() },
        { label: "Valor", value: formatCurrency(creationValidation.amount) },
        {
          label: isRealizedMovement(selectedAction) ? "Data" : "1º vencimento",
          value: form.date,
        },
        {
          label: "Categoria",
          value: optionLabel(categoriesFor(selectedAction), form.category),
        },
        {
          label: ["revenue", "receivable"].includes(selectedAction)
            ? "Cliente"
            : "Fornecedor",
          value: form.counterpartyId
            ? optionLabel(
                (["revenue", "receivable"].includes(selectedAction)
                  ? customers
                  : suppliers
                ).map((item) => ({ value: item.id, label: item.name })),
                form.counterpartyId,
              )
            : "Outros (sem vínculo)",
        },
        ...(isRealizedMovement(selectedAction)
          ? [
              {
                label: "Pagamento",
                value: optionLabel(PAYMENT_METHODS, form.paymentMethod),
              },
            ]
          : [
              {
                label: "Periodicidade",
                value: optionLabel(RECURRENCE_OPTIONS, form.recurrence),
              },
              ...(form.recurrence !== "none"
                ? [
                    {
                      label: "Ocorrências",
                      value: form.recurrenceIndefinite
                        ? "Sem data final"
                        : `${creationValidation.occurrences} lançamentos`,
                    },
                    ...(!form.recurrenceIndefinite
                      ? [
                          {
                            label: "Total da série",
                            value: formatCurrency(
                              Number(creationValidation.amount) *
                                Number(creationValidation.occurrences),
                            ),
                          },
                        ]
                      : []),
                  ]
                : []),
            ]),
        ...(form.notes.trim()
          ? [{ label: "Observações", value: form.notes.trim() }]
          : []),
      ]
    : [];
  const overdueAmount = overdueCommitments.reduce(
    (total, item) => total + Number(item.amount),
    0,
  );
  const usesCustomer = ["revenue", "receivable"].includes(selectedAction);
  const counterpartyLabel = usesCustomer ? "Cliente" : "Fornecedor";
  const counterpartyOptions = [
    {
      value: "",
      label: `Sem ${counterpartyLabel.toLocaleLowerCase("pt-BR")} (Outros)`,
    },
    ...(usesCustomer ? customers : suppliers).map((item) => ({
      value: item.id,
      label: item.name,
    })),
  ];
  const managerIsCustomer = contactManagerType === "customer";
  const managedContacts = managerIsCustomer ? customers : suppliers;
  const normalizedContactSearch = contactSearch
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
  const filteredManagedContacts = managedContacts.filter((contact) => {
    if (!normalizedContactSearch) {
      return true;
    }

    return [contact.name, contact.document, contact.email, contact.phone]
      .filter(Boolean)
      .some((value) =>
        String(value)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLocaleLowerCase("pt-BR")
          .includes(normalizedContactSearch),
      );
  });

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView
        contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshCommitments}
          />
        }
      >
        <View className="w-[90%] self-center pt-5 gap-6">
          <View>
            <Text className="font-poppins-semibold text-2xl text-texto-primario">
              Movimentar finanças
            </Text>
            <Text className="font-poppins-regular text-texto-terciario mt-1">
              Registre o que aconteceu hoje ou organize os próximos compromissos.
            </Text>
          </View>

          <View className="flex-row flex-wrap justify-between gap-y-3">
            {ACTIONS.map((action) => {
              const Icon = action.icon;

              return (
                <Card
                  key={action.type}
                  className="w-[48%] min-h-36"
                  onPress={() => openCreateModal(action.type)}
                >
                  <View
                    className="w-11 h-11 rounded-2xl items-center justify-center mb-4"
                    style={{ backgroundColor: action.background }}
                  >
                    <Icon size={22} color={action.color} />
                  </View>
                  <Text className="font-poppins-semibold text-texto-primario">
                    {action.title}
                  </Text>
                  <Text className="font-poppins-regular text-xs text-texto-terciario mt-1">
                    {action.subtitle}
                  </Text>
                </Card>
              );
            })}
          </View>

          <View className="gap-3">
            <View>
              <Text className="font-poppins-semibold text-xl text-texto-primario">
                Clientes e fornecedores
              </Text>
              <Text className="font-poppins-regular text-sm text-texto-terciario">
                Organize os contatos usados nos seus lançamentos.
              </Text>
            </View>
            <View className="flex-row gap-4">
              <Card
                className="flex-1 min-h-28 justify-between"
                onPress={() => openContactManager("customer")}
              >
                <View className="w-10 h-10 rounded-2xl bg-blue-50 items-center justify-center">
                  <Users size={20} color="#1d4ed8" />
                </View>
                <View className="mt-3">
                  <Text className="font-poppins-semibold text-texto-primario">
                    Clientes
                  </Text>
                  <Text className="font-poppins-regular text-xs text-texto-terciario">
                    {customers.length} {customers.length === 1 ? "cadastro" : "cadastros"}
                  </Text>
                </View>
              </Card>
              <Card
                className="flex-1 min-h-28 justify-between"
                onPress={() => openContactManager("supplier")}
              >
                <View className="w-10 h-10 rounded-2xl bg-orange-50 items-center justify-center">
                  <Truck size={20} color="#c2410c" />
                </View>
                <View className="mt-3">
                  <Text className="font-poppins-semibold text-texto-primario">
                    Fornecedores
                  </Text>
                  <Text className="font-poppins-regular text-xs text-texto-terciario">
                    {suppliers.length} {suppliers.length === 1 ? "cadastro" : "cadastros"}
                  </Text>
                </View>
              </Card>
            </View>
          </View>

          <View className="gap-4">
            <View>
              <Text className="font-poppins-semibold text-xl text-texto-primario">
                Compromissos
              </Text>
              <Text className="font-poppins-regular text-sm text-texto-terciario">
                Contas a pagar e receber organizadas por situação.
              </Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {STATUS_FILTERS.map((filter) => {
                  const isSelected = statusFilter === filter.value;

                  return (
                    <Pressable
                      key={filter.value}
                      className={`px-4 py-2 rounded-full border ${
                        isSelected
                          ? "bg-azul-primario border-azul-primario"
                          : "bg-white border-gray-200"
                      }`}
                      onPress={() => setStatusFilter(filter.value)}
                    >
                      <Text
                        className={`font-poppins-medium ${
                          isSelected ? "text-white" : "text-texto-terciario"
                        }`}
                      >
                        {filter.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {overdueCommitments.length > 0 && statusFilter !== "overdue" ? (
              <Pressable
                className="rounded-2xl bg-red-50 border border-red-100 p-4 flex-row items-center gap-3"
                onPress={() => setStatusFilter("overdue")}
              >
                <TriangleAlert size={24} color="#b91c1c" />
                <View className="flex-1">
                  <Text className="font-poppins-semibold text-red-700">
                    {overdueCommitments.length} compromisso(s) vencido(s)
                  </Text>
                  <Text className="font-poppins-regular text-red-600 text-sm">
                    Total de {formatCurrency(overdueAmount)} · Toque para visualizar
                  </Text>
                </View>
              </Pressable>
            ) : null}

            {isLoading && commitments.length === 0 ? (
              <View className="py-10 items-center">
                <ActivityIndicator color="#0063f5" />
              </View>
            ) : null}

            {loadError ? (
              <Pressable
                className="rounded-2xl bg-red-50 p-4"
                onPress={loadCommitments}
              >
                <Text className="font-poppins-medium text-red-700">
                  {loadError}
                </Text>
                <Text className="font-poppins-regular text-red-600 text-sm mt-1">
                  Toque para tentar novamente.
                </Text>
              </Pressable>
            ) : null}

            {!isLoading && !loadError && commitments.length === 0 ? (
              <Card className="p-8 items-center">
                <Inbox size={34} color="#9ca3af" />
                <Text className="font-poppins-semibold text-texto-primario mt-3">
                  Nenhum compromisso aqui
                </Text>
                <Text className="font-poppins-regular text-texto-terciario text-center text-sm mt-1">
                  Use uma das opções acima para começar a organizar suas contas.
                </Text>
              </Card>
            ) : null}

            {commitments.map((item) => {
              const isPayable = item.type === "payable";
              const isOverdue = item.effective_status === "overdue";
              const isCompleted = ["paid", "received"].includes(item.status);
              const StatusIcon = isCompleted
                ? CheckCircle2
                : isOverdue
                  ? TriangleAlert
                  : Clock3;
              const statusColor = isCompleted
                ? "#15803d"
                : isOverdue
                  ? "#b91c1c"
                  : "#a16207";

              return (
                <Card key={`${item.type}-${item.id}`}>
                  <View className="flex-row justify-between gap-3">
                    <View className="flex-row flex-1 gap-3">
                      <CategoryIcon category={item.category} withBackground />
                      <View className="flex-1">
                        <Text className="font-poppins-medium text-xs text-texto-terciario uppercase">
                          {isPayable ? "A pagar" : "A receber"}
                        </Text>
                        <Text className="font-poppins-semibold text-texto-primario text-lg mt-1">
                          {item.description}
                        </Text>
                        <Text className="font-poppins-regular text-texto-terciario text-sm">
                          {item.category_label} · {formatApiDate(item.due_date)}
                        </Text>
                        <Text className="font-poppins-regular text-xs text-texto-terciario mt-0.5">
                          {isPayable ? "Fornecedor" : "Cliente"}: {isPayable
                            ? item.supplier_name || "Outros"
                            : item.customer_name || "Outros"}
                        </Text>
                        {item.recurrence !== "none" ? (
                          <Text className="font-poppins-medium text-azul-primario text-xs mt-1">
                            {item.recurrence_indefinite
                              ? `${item.recurrence_label} · Sem data final`
                              : `${item.recurrence_label} · ${item.recurrence_sequence} de ${item.recurrence_total}`}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <Text
                      className="font-poppins-semibold text-lg"
                      style={{ color: isPayable ? "#dc2626" : "#16a34a" }}
                    >
                      {formatCurrency(item.amount)}
                    </Text>
                  </View>

                  <View className="flex-row items-center justify-between mt-4 pt-3 border-t border-gray-100">
                    <View className="flex-row items-center gap-2">
                      <StatusIcon size={16} color={statusColor} />
                      <Text className="font-poppins-medium text-sm" style={{ color: statusColor }}>
                        {item.effective_status_label}
                      </Text>
                    </View>
                    {!isCompleted && item.status === "pending" ? (
                      <View className="flex-row items-center gap-2">
                        <Pressable
                          className="flex-row items-center gap-1.5 border border-azul-primario px-3 py-2 rounded-xl active:bg-blue-50"
                          onPress={() => setEditingCommitment(item)}
                        >
                          <Pencil size={14} color="#0063f5" />
                          <Text className="font-poppins-semibold text-azul-primario text-xs">
                            Editar
                          </Text>
                        </Pressable>
                        <Pressable
                          className="bg-azul-primario px-4 py-2 rounded-xl active:opacity-70"
                          onPress={() => openSettlement(item)}
                        >
                          <Text className="font-poppins-semibold text-white text-sm">
                            {isPayable ? "Pagar" : "Receber"}
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                </Card>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={Boolean(selectedAction) && !creationValidation}
        animationType="slide"
        transparent
        onRequestClose={closeCreateModal}
      >
        <KeyboardAvoidingView
          className="flex-1 justify-end bg-black/40"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View className="bg-white rounded-t-3xl max-h-[92%]">
            <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
              <View className="flex-1 pr-4">
                <Text className="font-poppins-semibold text-xl text-texto-primario">
                  {selectedConfig?.title}
                </Text>
                <Text className="font-poppins-regular text-texto-terciario text-sm">
                  {selectedConfig?.subtitle}
                </Text>
              </View>
              <Pressable hitSlop={10} onPress={closeCreateModal}>
                <X size={24} color="#6b7280" />
              </Pressable>
            </View>

            <ScrollView
              className="px-5"
              contentContainerStyle={{ paddingBottom: 36, gap: 18 }}
              keyboardShouldPersistTaps="handled"
            >
              <InputText
                label="Descrição"
                placeholder="Ex: Conta de energia"
                value={form.description}
                onChangeText={(value) => updateForm("description", value)}
                error={formErrors.description}
                required
              />
              <InputText
                label="Valor"
                placeholder="0,00"
                value={form.amount}
                onChangeText={(value) => updateForm("amount", value)}
                keyboardType="decimal-pad"
                error={formErrors.amount}
                required
              />
              <DateField
                label={isRealizedMovement(selectedAction) ? "Data" : "Vencimento"}
                placeholder="DD/MM/AAAA"
                value={form.date}
                onChangeText={(value) => updateForm("date", formatDateInput(value))}
                error={formErrors.date}
                maximumDate={
                  isRealizedMovement(selectedAction)
                    ? parseDate(todayInputValue())
                    : undefined
                }
                required
              />
              <SelectField
                label="Categoria"
                options={categoriesFor(selectedAction)}
                value={form.category}
                onChange={(value) => updateForm("category", value)}
                placeholder="Selecione uma categoria"
                error={formErrors.category}
                required
              />
              <View className="gap-2">
                <SearchableSelectField
                  label={`${counterpartyLabel}`}
                  options={counterpartyOptions}
                  value={form.counterpartyId}
                  onChange={(value) => updateForm("counterpartyId", value)}
                  placeholder={`Digite para buscar ${counterpartyLabel.toLocaleLowerCase("pt-BR")}`}
                  emptyMessage={`Nenhum ${counterpartyLabel.toLocaleLowerCase("pt-BR")} encontrado.`}
                />
                <Pressable
                  className="self-start px-1 py-1 active:opacity-70"
                  onPress={() => {
                    setIsCreatingCounterparty((current) => !current);
                    setCounterpartyErrors({});
                  }}
                >
                  <Text className="font-poppins-semibold text-sm text-azul-primario">
                    {isCreatingCounterparty
                      ? "Cancelar novo cadastro"
                      : `+ Cadastrar ${counterpartyLabel.toLocaleLowerCase("pt-BR")}`}
                  </Text>
                </Pressable>

                {isCreatingCounterparty ? (
                  <View className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 gap-3">
                    <View>
                      <Text className="font-poppins-semibold text-texto-primario">
                        Novo {counterpartyLabel.toLocaleLowerCase("pt-BR")}
                      </Text>
                      <Text className="font-poppins-regular text-xs text-texto-terciario">
                        Só o nome é obrigatório. O cadastro ficará disponível nos próximos lançamentos.
                      </Text>
                    </View>
                    <InputText
                      label="Nome"
                      placeholder={usesCustomer ? "Nome do cliente" : "Nome do fornecedor"}
                      value={counterpartyForm.name}
                      onChangeText={(value) => updateCounterpartyForm("name", value)}
                      error={counterpartyErrors.name}
                      required
                    />
                    <InputText
                      label="CPF ou CNPJ"
                      placeholder="Opcional"
                      value={counterpartyForm.document}
                      onChangeText={(value) =>
                        updateCounterpartyForm("document", value)
                      }
                      keyboardType="number-pad"
                    />
                    <InputText
                      label="E-mail"
                      placeholder="Opcional"
                      value={counterpartyForm.email}
                      onChangeText={(value) => updateCounterpartyForm("email", value)}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <InputText
                      label="Telefone"
                      placeholder="Opcional"
                      value={counterpartyForm.phone}
                      onChangeText={(value) => updateCounterpartyForm("phone", value)}
                      keyboardType="phone-pad"
                    />
                    <Pressable
                      className="rounded-xl bg-azul-primario p-3 items-center active:opacity-80"
                      onPress={handleCreateCounterparty}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text className="font-poppins-semibold text-white">
                          Salvar e selecionar
                        </Text>
                      )}
                    </Pressable>
                  </View>
                ) : null}
              </View>
              {isRealizedMovement(selectedAction) ? (
                <SelectField
                  label="Forma de pagamento"
                  options={PAYMENT_METHODS}
                  value={form.paymentMethod}
                  onChange={(value) => updateForm("paymentMethod", value)}
                  placeholder="Selecione uma forma"
                  error={formErrors.paymentMethod}
                  required
                />
              ) : null}
              {!isRealizedMovement(selectedAction) ? (
                <>
                  <SelectField
                    label="Periodicidade"
                    options={RECURRENCE_OPTIONS}
                    value={form.recurrence}
                    onChange={(value) => {
                      setForm((current) => ({
                        ...current,
                        recurrence: value,
                        recurrenceIndefinite:
                          value === "none" ? false : current.recurrenceIndefinite,
                      }));
                      setFormErrors((current) => ({
                        ...current,
                        recurrence: "",
                        occurrences: "",
                      }));
                    }}
                    placeholder="Selecione a periodicidade"
                    required
                  />
                  {form.recurrence !== "none" ? (
                    <>
                      <View className="bg-gray-50 rounded-xl p-4 flex-row items-center justify-between gap-4">
                        <View className="flex-1">
                          <Text className="font-poppins-medium text-texto-secundario">
                            Quantidade indeterminada
                          </Text>
                          <Text className="font-poppins-regular text-xs text-texto-terciario mt-1">
                            Mantém a recorrência ativa, sem data final.
                          </Text>
                        </View>
                        <Switch
                          value={form.recurrenceIndefinite}
                          onValueChange={(value) => {
                            Keyboard.dismiss();
                            updateForm("recurrenceIndefinite", value);
                          }}
                          trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
                          thumbColor={
                            form.recurrenceIndefinite ? "#0063f5" : "#f9fafb"
                          }
                        />
                      </View>
                      {!form.recurrenceIndefinite ? (
                        <InputText
                          label="Quantidade de ocorrências"
                          placeholder="Ex: 6"
                          value={form.occurrences}
                          onChangeText={(value) =>
                            updateForm("occurrences", onlyDigits(value).slice(0, 2))
                          }
                          keyboardType="number-pad"
                          maxLength={2}
                          error={formErrors.occurrences}
                          required
                        />
                      ) : null}
                    </>
                  ) : null}
                </>
              ) : null}
              <InputText
                label="Observações"
                placeholder="Informações adicionais"
                value={form.notes}
                onChangeText={(value) => updateForm("notes", value)}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <Pressable
                className="bg-azul-primario rounded-xl p-4 items-center active:opacity-80"
                onPress={requestCreateConfirmation}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="font-poppins-semibold text-white text-lg">
                    Revisar e registrar
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <FinanceConfirmationModal
        visible={Boolean(creationValidation)}
        action={selectedConfig}
        rows={confirmationRows}
        isSubmitting={isSubmitting}
        onClose={() => setCreationValidation(null)}
        onConfirm={handleCreate}
      />

      <Modal
        visible={Boolean(contactManagerType)}
        animationType="slide"
        transparent
        onRequestClose={closeContactManager}
      >
        <KeyboardAvoidingView
          className="flex-1 justify-end bg-black/40"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View className="bg-gray-50 rounded-t-3xl max-h-[92%]">
            <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
              <View className="flex-1 pr-4">
                <Text className="font-poppins-semibold text-xl text-texto-primario">
                  {managerIsCustomer ? "Clientes" : "Fornecedores"}
                </Text>
                <Text className="font-poppins-regular text-xs text-texto-terciario">
                  Cadastros ativos disponíveis nos lançamentos financeiros.
                </Text>
              </View>
              <Pressable
                hitSlop={10}
                onPress={closeContactManager}
                disabled={isSubmitting}
              >
                <X size={24} color="#6b7280" />
              </Pressable>
            </View>

            <ScrollView
              className="px-5"
              contentContainerStyle={{ paddingBottom: 36, gap: 14 }}
              keyboardShouldPersistTaps="handled"
            >
              <Card className="gap-3">
                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-row items-center gap-2">
                    {editingManagedContact ? (
                      <Pencil size={19} color="#0063f5" />
                    ) : (
                      <Plus size={19} color="#0063f5" />
                    )}
                    <Text className="font-poppins-semibold text-texto-primario">
                      {editingManagedContact ? "Editar" : "Novo"} {managerIsCustomer ? "cliente" : "fornecedor"}
                    </Text>
                  </View>
                  {editingManagedContact ? (
                    <Pressable
                      hitSlop={8}
                      onPress={() => {
                        setEditingManagedContact(null);
                        setManagerForm(initialCounterpartyForm());
                        setManagerErrors({});
                      }}
                    >
                      <Text className="font-poppins-semibold text-xs text-texto-terciario">
                        Cancelar edição
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                <InputText
                  label="Nome"
                  placeholder="Nome ou razão social"
                  value={managerForm.name}
                  onChangeText={(value) => updateManagerForm("name", value)}
                  error={managerErrors.name}
                  required
                />
                <InputText
                  label="CPF ou CNPJ"
                  placeholder="Opcional"
                  value={managerForm.document}
                  onChangeText={(value) => updateManagerForm("document", value)}
                  keyboardType="number-pad"
                />
                <InputText
                  label="E-mail"
                  placeholder="Opcional"
                  value={managerForm.email}
                  onChangeText={(value) => updateManagerForm("email", value)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <InputText
                  label="Telefone"
                  placeholder="Opcional"
                  value={managerForm.phone}
                  onChangeText={(value) => updateManagerForm("phone", value)}
                  keyboardType="phone-pad"
                />
                <Pressable
                  className="rounded-xl bg-azul-primario p-3 items-center active:opacity-80"
                  onPress={handleCreateManagedContact}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text className="font-poppins-semibold text-white">
                      {editingManagedContact ? "Salvar alterações" : "Salvar cadastro"}
                    </Text>
                  )}
                </Pressable>
              </Card>

              <View className="gap-2">
                <Text className="font-poppins-semibold text-lg text-texto-primario">
                  Cadastros ativos
                </Text>
                <View className="h-12 rounded-xl border border-gray-200 bg-white px-3 flex-row items-center gap-2">
                  <Search size={18} color="#6b7280" />
                  <TextInput
                    className="flex-1 font-poppins-regular text-sm text-texto-primario"
                    placeholder={`Pesquisar ${managerIsCustomer ? "clientes" : "fornecedores"}`}
                    placeholderTextColor="#9ca3af"
                    value={contactSearch}
                    onChangeText={setContactSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                  />
                  {contactSearch ? (
                    <Pressable
                      hitSlop={8}
                      onPress={() => setContactSearch("")}
                      accessibilityRole="button"
                      accessibilityLabel="Limpar pesquisa"
                    >
                      <X size={17} color="#6b7280" />
                    </Pressable>
                  ) : null}
                </View>
                {filteredManagedContacts.length > 0 ? (
                  filteredManagedContacts.map((contact) => (
                    <Card
                      key={contact.id}
                      className="flex-row items-center gap-3"
                    >
                      <View
                        className={`w-10 h-10 rounded-2xl items-center justify-center ${
                          managerIsCustomer ? "bg-blue-50" : "bg-orange-50"
                        }`}
                      >
                        {managerIsCustomer ? (
                          <Users size={19} color="#1d4ed8" />
                        ) : (
                          <Truck size={19} color="#c2410c" />
                        )}
                      </View>
                      <View className="flex-1">
                        <Text className="font-poppins-semibold text-texto-primario">
                          {contact.name}
                        </Text>
                        <Text
                          className="font-poppins-regular text-xs text-texto-terciario"
                          numberOfLines={1}
                        >
                          {contact.document || contact.email || contact.phone || "Sem dados adicionais"}
                        </Text>
                      </View>
                      <View className="flex-row gap-2">
                        <Pressable
                          hitSlop={8}
                          className="w-9 h-9 rounded-xl bg-blue-50 items-center justify-center"
                          onPress={() => editManagedContact(contact)}
                          disabled={isSubmitting}
                        >
                          <Pencil size={16} color="#1d4ed8" />
                        </Pressable>
                        <Pressable
                          hitSlop={8}
                          className="w-9 h-9 rounded-xl bg-red-50 items-center justify-center"
                          onPress={() => confirmDeactivateContact(contact)}
                          disabled={isSubmitting}
                        >
                          <Trash2 size={17} color="#b91c1c" />
                        </Pressable>
                      </View>
                    </Card>
                  ))
                ) : (
                  <Card className="items-center py-7">
                    <Inbox size={29} color="#9ca3af" />
                    <Text className="font-poppins-medium text-texto-terciario mt-2">
                      Nenhum cadastro ativo
                      {managedContacts.length > 0 ? " encontrado" : ""}
                    </Text>
                  </Card>
                )}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <CommitmentEditModal
        item={editingCommitment}
        customers={customers}
        suppliers={suppliers}
        isSubmitting={isSubmitting}
        onClose={() => !isSubmitting && setEditingCommitment(null)}
        onSave={handleCommitmentUpdate}
        onDelete={confirmCommitmentDelete}
      />

      <Modal
        visible={Boolean(settlementItem)}
        animationType="fade"
        transparent
        onRequestClose={closeSettlement}
      >
        <KeyboardAvoidingView
          className="flex-1 justify-center bg-black/40 px-6"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View className="bg-white rounded-3xl p-5 gap-5">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-4">
                <Text className="font-poppins-semibold text-xl text-texto-primario">
                  {settlementItem?.type === "payable" ? "Registrar pagamento" : "Registrar recebimento"}
                </Text>
                <Text className="font-poppins-regular text-texto-terciario mt-1">
                  {settlementItem?.description} · {formatCurrency(settlementItem?.amount)}
                </Text>
              </View>
              <Pressable hitSlop={10} onPress={closeSettlement}>
                <X size={24} color="#6b7280" />
              </Pressable>
            </View>
            <DateField
              label="Data da baixa"
              placeholder="DD/MM/AAAA"
              value={settlementForm.date}
              onChangeText={(value) => {
                setSettlementForm((current) => ({
                  ...current,
                  date: formatDateInput(value),
                }));
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
                setSettlementForm((current) => ({
                  ...current,
                  paymentMethod: value,
                }));
                setSettlementErrors((current) => ({
                  ...current,
                  paymentMethod: "",
                }));
              }}
              placeholder="Selecione uma forma"
              error={settlementErrors.paymentMethod}
              required
            />
            <Pressable
              className="bg-azul-primario rounded-xl p-4 items-center active:opacity-80"
              onPress={handleSettlement}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="font-poppins-semibold text-white text-lg">
                  Confirmar baixa
                </Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
