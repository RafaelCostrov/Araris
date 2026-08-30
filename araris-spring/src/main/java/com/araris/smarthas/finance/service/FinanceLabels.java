package com.araris.smarthas.finance.service;

import com.araris.smarthas.finance.domain.MovementType;
import java.util.Map;

public final class FinanceLabels {

    private static final Map<String, String> REVENUE_CATEGORIES = Map.of(
            "sales", "Vendas",
            "services", "Serviços",
            "refund", "Reembolso",
            "investment", "Investimento",
            "other", "Outros"
    );

    private static final Map<String, String> EXPENSE_CATEGORIES = Map.of(
            "supplies", "Materiais e insumos",
            "rent", "Aluguel",
            "utilities", "Água, luz e internet",
            "transportation", "Transporte",
            "taxes", "Impostos e taxas",
            "marketing", "Marketing",
            "salaries", "Pessoal",
            "bank_fees", "Tarifas bancárias",
            "other", "Outros"
    );

    private static final Map<String, String> PAYMENT_METHODS = Map.of(
            "", "",
            "cash", "Dinheiro",
            "pix", "Pix",
            "debit_card", "Cartão de débito",
            "credit_card", "Cartão de crédito",
            "bank_transfer", "Transferência bancária",
            "boleto", "Boleto",
            "other", "Outro"
    );

    private FinanceLabels() {
    }

    public static boolean categoryExists(MovementType type, String category) {
        return categories(type).containsKey(category);
    }

    public static String category(MovementType type, String category) {
        return categories(type).getOrDefault(category, category);
    }

    public static boolean paymentMethodExists(String paymentMethod) {
        return PAYMENT_METHODS.containsKey(paymentMethod);
    }

    public static String paymentMethod(String paymentMethod) {
        return PAYMENT_METHODS.getOrDefault(paymentMethod, paymentMethod);
    }

    private static Map<String, String> categories(MovementType type) {
        return type == MovementType.REVENUE ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES;
    }
}
