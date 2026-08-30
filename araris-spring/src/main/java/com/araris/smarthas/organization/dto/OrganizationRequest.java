package com.araris.smarthas.organization.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record OrganizationRequest(
        @NotBlank(message = "Informe a razão social.") @Size(max = 255) String businessName,
        @Size(max = 255) String tradeName,
        @NotBlank(message = "Informe o CNPJ.") @Size(max = 18) String cnpj,
        @Size(max = 30) String businessCategory,
        @Size(max = 10) String postalCode,
        @Size(max = 255) String street,
        @Size(max = 30) String number,
        @Size(max = 120) String addressComplement,
        @Size(max = 120) String neighborhood,
        @Size(max = 120) String city,
        @Size(max = 2) String state,
        @Size(max = 20) String ibgeCode,
        @Size(max = 20) String cnaeCode,
        @Size(max = 255) String cnaeDescription,
        Boolean meiOptIn,
        @Size(max = 40) String registrationStatus,
        @DecimalMin(value = "0.00", message = "O saldo inicial não pode ser negativo.") BigDecimal initialBalance,
        @Size(max = 64) String timezone
) {
}
