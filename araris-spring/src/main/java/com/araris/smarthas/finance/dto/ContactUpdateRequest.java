package com.araris.smarthas.finance.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

public record ContactUpdateRequest(
        @Size(min = 1, max = 255) String name,
        @Size(max = 18) String document,
        @Email(message = "Informe um e-mail válido.") @Size(max = 320) String email,
        @Size(max = 20) String phone,
        String notes,
        Boolean isActive
) {
}
