package com.araris.smarthas.auth.controller;

import com.araris.smarthas.auth.dto.LoginRequest;
import com.araris.smarthas.auth.dto.MeResponse;
import com.araris.smarthas.auth.dto.ProfileResponse;
import com.araris.smarthas.auth.dto.ProfileUpdateRequest;
import com.araris.smarthas.auth.dto.RefreshRequest;
import com.araris.smarthas.auth.dto.RegisterRequest;
import com.araris.smarthas.auth.dto.RegisterResponse;
import com.araris.smarthas.auth.dto.TokenPairResponse;
import com.araris.smarthas.auth.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/accounts")
@Tag(name = "Contas", description = "Cadastro, login, renovação de sessão e perfil")
public class AccountController {

    private final AuthService authService;

    public AccountController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register/")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Cadastra usuário e sua empresa")
    RegisterResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/login/")
    @Operation(summary = "Autentica com e-mail e senha")
    TokenPairResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @GetMapping("/check-email/")
    @Operation(summary = "Verifica se um e-mail está disponível")
    Map<String, Boolean> checkEmail(@RequestParam String email) {
        return authService.isEmailAvailable(email);
    }

    @PostMapping("/token/refresh/")
    @Operation(summary = "Rotaciona o refresh token e emite novo access token")
    TokenPairResponse refresh(@Valid @RequestBody RefreshRequest request) {
        return authService.refresh(request.refresh());
    }

    @GetMapping("/me/")
    @Operation(summary = "Retorna usuário e empresa da sessão")
    MeResponse me(@AuthenticationPrincipal Jwt jwt) {
        return authService.me(UUID.fromString(jwt.getSubject()));
    }

    @PatchMapping("/me/")
    @Operation(summary = "Atualiza nome e telefone do usuário")
    ProfileResponse updateMe(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody ProfileUpdateRequest request
    ) {
        return authService.updateProfile(UUID.fromString(jwt.getSubject()), request);
    }
}
