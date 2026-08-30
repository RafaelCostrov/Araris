package com.araris.smarthas.auth.dto;

import com.araris.smarthas.organization.dto.OrganizationRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank(message = "Informe seu nome.") @Size(max = 255) String name,
        @NotBlank(message = "Informe seu e-mail.") @Email(message = "Informe um e-mail válido.") String email,
        @NotBlank(message = "Informe uma senha.") @Size(min = 8, message = "A senha deve ter ao menos 8 caracteres.") String password,
        @NotBlank(message = "Confirme sua senha.") String passwordConfirm,
        @Size(max = 20) String phone,
        boolean lgpdConsentGiven,
        @NotNull(message = "Informe os dados da empresa.") @Valid OrganizationRequest organization
) {
}
