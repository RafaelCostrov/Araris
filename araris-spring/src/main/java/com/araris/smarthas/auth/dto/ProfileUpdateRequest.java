package com.araris.smarthas.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ProfileUpdateRequest(
        @NotBlank(message = "Informe seu nome.") @Size(max = 255) String name,
        @Size(max = 20) String phone
) {
}
