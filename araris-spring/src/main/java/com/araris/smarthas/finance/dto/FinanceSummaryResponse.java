package com.araris.smarthas.finance.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record FinanceSummaryResponse(
        LocalDate period,
        Totals totals,
        Counts counts,
        List<RecentActivity> recentActivity
) {
    public record Totals(
            BigDecimal revenue,
            BigDecimal expense,
            BigDecimal monthlyBalance,
            BigDecimal openingBalance,
            BigDecimal closingBalance,
            BigDecimal balance,
            BigDecimal payablesDueInPeriod,
            BigDecimal receivablesDueInPeriod,
            BigDecimal overduePayables,
            BigDecimal overdueReceivables,
            BigDecimal dueTodayPayables,
            BigDecimal dueTodayReceivables
    ) {
    }

    public record Counts(
            long pendingPayables,
            long pendingReceivables,
            long overduePayables,
            long overdueReceivables,
            long dueTodayPayables,
            long dueTodayReceivables
    ) {
    }

    public record RecentActivity(
            UUID id,
            String type,
            String description,
            BigDecimal amount,
            LocalDate date,
            String category,
            String categoryLabel,
            UUID customerId,
            String customerName,
            UUID supplierId,
            String supplierName,
            String paymentMethod,
            String paymentMethodLabel,
            boolean isRecurring,
            String recurrence,
            String recurrenceLabel,
            UUID sourceCommitmentId,
            String notes,
            Instant createdAt
    ) {
    }
}
