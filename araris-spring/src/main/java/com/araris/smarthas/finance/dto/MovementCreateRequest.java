package com.araris.smarthas.finance.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record MovementCreateRequest(
        @NotNull(message = "Informe a empresa.") UUID organizationId,
        @NotBlank(message = "Informe a descrição.") @Size(max = 255) String description,
        @NotNull(message = "Informe o valor.") @DecimalMin(value = "0.01", message = "O valor deve ser maior que zero.") BigDecimal amount,
        @NotNull(message = "Informe a data do lançamento.") LocalDate occurredOn,
        @NotBlank(message = "Informe a categoria.") @Size(max = 30) String category,
        UUID customerId,
        UUID supplierId,
        @Size(max = 30) String paymentMethod,
        String notes
) {
}
