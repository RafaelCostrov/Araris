package com.araris.smarthas.finance.dto;

import com.araris.smarthas.finance.domain.FinancialMovement;
import com.araris.smarthas.finance.domain.MovementType;
import com.araris.smarthas.finance.service.FinanceLabels;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record MovementResponse(
        UUID id,
        UUID organizationId,
        String description,
        BigDecimal amount,
        LocalDate occurredOn,
        String category,
        String categoryLabel,
        UUID customerId,
        String customerName,
        UUID supplierId,
        String supplierName,
        String paymentMethod,
        String paymentMethodLabel,
        String notes,
        UUID sourceReceivableId,
        UUID sourcePayableId,
        boolean isRecurring,
        String recurrenceLabel,
        Instant createdAt,
        Instant updatedAt
) {
    public static MovementResponse from(FinancialMovement movement) {
        var customer = movement.getType() == MovementType.REVENUE ? movement.getContact() : null;
        var supplier = movement.getType() == MovementType.EXPENSE ? movement.getContact() : null;
        return new MovementResponse(
                movement.getId(),
                movement.getOrganization().getId(),
                movement.getDescription(),
                movement.getAmount(),
                movement.getOccurredOn(),
                movement.getCategory(),
                FinanceLabels.category(movement.getType(), movement.getCategory()),
                customer == null ? null : customer.getId(),
                customer == null ? null : customer.getName(),
                supplier == null ? null : supplier.getId(),
                supplier == null ? null : supplier.getName(),
                movement.getPaymentMethod(),
                FinanceLabels.paymentMethod(movement.getPaymentMethod()),
                movement.getNotes(),
                movement.getType() == MovementType.REVENUE ? movement.getSourceCommitmentId() : null,
                movement.getType() == MovementType.EXPENSE ? movement.getSourceCommitmentId() : null,
                false,
                "Lançamento simples",
                movement.getCreatedAt(),
                movement.getUpdatedAt()
        );
    }
}
