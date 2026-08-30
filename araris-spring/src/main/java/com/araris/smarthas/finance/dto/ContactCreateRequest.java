package com.araris.smarthas.finance.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record ContactCreateRequest(
        @NotNull(message = "Informe a empresa.") UUID organizationId,
        @NotBlank(message = "Informe um nome.") @Size(max = 255) String name,
        @Size(max = 18) String document,
        @Email(message = "Informe um e-mail válido.") @Size(max = 320) String email,
        @Size(max = 20) String phone,
        String notes
) {
}
