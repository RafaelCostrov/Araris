package com.araris.smarthas.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @NotBlank(message = "Informe seu e-mail.") @Email(message = "Informe um e-mail válido.") String email,
        @NotBlank(message = "Informe sua senha.") String password
) {
}
