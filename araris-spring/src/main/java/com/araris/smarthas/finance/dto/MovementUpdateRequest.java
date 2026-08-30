package com.araris.smarthas.finance.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record MovementUpdateRequest(
        @Size(min = 1, max = 255) String description,
        @DecimalMin(value = "0.01", message = "O valor deve ser maior que zero.") BigDecimal amount,
        LocalDate occurredOn,
        @Size(min = 1, max = 30) String category,
        UUID customerId,
        UUID supplierId,
        @Size(max = 30) String paymentMethod,
        String notes
) {
}
