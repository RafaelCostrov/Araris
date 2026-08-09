import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const FinancePeriodContext = createContext(null);

function currentMonthValue() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  return `${today.getFullYear()}-${month}`;
}

export function FinancePeriodProvider({ children }) {
  const [selectedMonth, setSelectedMonth] = useState(currentMonthValue);
  const [isMonthTransitioning, setIsMonthTransitioning] = useState(false);
  const selectedMonthRef = useRef(selectedMonth);
  const transitionTimer = useRef(null);

  const changeSelectedMonth = useCallback((nextValue) => {
    const currentValue = selectedMonthRef.current;
    const resolvedValue =
      typeof nextValue === "function" ? nextValue(currentValue) : nextValue;
    if (resolvedValue === currentValue) {
      return;
    }

    selectedMonthRef.current = resolvedValue;
    setSelectedMonth(resolvedValue);
    if (transitionTimer.current) {
      clearTimeout(transitionTimer.current);
    }
    setIsMonthTransitioning(true);
    transitionTimer.current = setTimeout(() => {
      setIsMonthTransitioning(false);
      transitionTimer.current = null;
    }, 300);
  }, []);

  useEffect(
    () => () => {
      if (transitionTimer.current) {
        clearTimeout(transitionTimer.current);
      }
    },
    [],
  );

  const value = useMemo(
    () => ({
      selectedMonth,
      setSelectedMonth: changeSelectedMonth,
      isMonthTransitioning,
    }),
    [changeSelectedMonth, isMonthTransitioning, selectedMonth],
  );

  return (
    <FinancePeriodContext.Provider value={value}>
      {children}
    </FinancePeriodContext.Provider>
  );
}

export function useFinancePeriod() {
  const context = useContext(FinancePeriodContext);

  if (!context) {
    throw new Error(
      "useFinancePeriod deve ser usado dentro de FinancePeriodProvider.",
    );
  }

  return context;
}
