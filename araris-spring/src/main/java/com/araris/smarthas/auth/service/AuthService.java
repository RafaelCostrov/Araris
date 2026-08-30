package com.araris.smarthas.auth.service;

import com.araris.smarthas.auth.domain.User;
import com.araris.smarthas.auth.dto.LoginRequest;
import com.araris.smarthas.auth.dto.MeResponse;
import com.araris.smarthas.auth.dto.MembershipResponse;
import com.araris.smarthas.auth.dto.ProfileResponse;
import com.araris.smarthas.auth.dto.ProfileUpdateRequest;
import com.araris.smarthas.auth.dto.RegisterRequest;
import com.araris.smarthas.auth.dto.RegisterResponse;
import com.araris.smarthas.auth.dto.TokenPairResponse;
import com.araris.smarthas.auth.dto.UserResponse;
import com.araris.smarthas.auth.repository.RefreshTokenRepository;
import com.araris.smarthas.auth.repository.UserRepository;
import com.araris.smarthas.common.api.ApiException;
import com.araris.smarthas.organization.dto.OrganizationResponse;
import com.araris.smarthas.organization.service.OrganizationService;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final OrganizationService organizationService;

    public AuthService(
            UserRepository userRepository,
            RefreshTokenRepository refreshTokenRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            OrganizationService organizationService
    ) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.organizationService = organizationService;
    }

    @Transactional
    public RegisterResponse register(RegisterRequest request) {
        var email = request.email().trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Já existe um usuário com este e-mail.");
        }
        if (!request.password().equals(request.passwordConfirm())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "As senhas não conferem.");
        }

        var user = userRepository.save(new User(
                normalizeName(request.name()),
                email,
                passwordEncoder.encode(request.password()),
                normalizePhone(request.phone()),
                request.lgpdConsentGiven()
        ));
        var created = organizationService.create(user, request.organization());
        var tokens = jwtService.issuePair(user);

        return new RegisterResponse(
                UserResponse.from(user),
                OrganizationResponse.from(created.organization()),
                MembershipResponse.from(created.membership()),
                tokens.refresh(),
                tokens.access()
        );
    }

    @Transactional
    public TokenPairResponse login(LoginRequest request) {
        var user = userRepository.findByEmailIgnoreCase(request.email().trim())
                .filter(User::isActive)
                .orElseThrow(this::invalidCredentials);
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw invalidCredentials();
        }
        return jwtService.issuePair(user);
    }

    @Transactional(readOnly = true)
    public Map<String, Boolean> isEmailAvailable(String rawEmail) {
        var email = rawEmail == null ? "" : rawEmail.trim().toLowerCase();
        if (email.isBlank() || !email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Informe um e-mail válido.");
        }
        return Map.of("available", !userRepository.existsByEmailIgnoreCase(email));
    }

    @Transactional
    public TokenPairResponse refresh(String rawRefreshToken) {
        var storedToken = refreshTokenRepository.findByTokenHash(jwtService.hash(rawRefreshToken))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Refresh token inválido ou expirado."));
        if (!storedToken.isUsableAt(Instant.now())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Refresh token inválido ou expirado.");
        }
        storedToken.revoke();
        return jwtService.issuePair(storedToken.getUser());
    }

    @Transactional(readOnly = true)
    public MeResponse me(UUID userId) {
        var user = requireUser(userId);
        return new MeResponse(
                UserResponse.from(user),
                organizationService.getActiveMemberships(userId).stream()
                        .map(MembershipResponse::from)
                        .toList()
        );
    }

    @Transactional
    public ProfileResponse updateProfile(UUID userId, ProfileUpdateRequest request) {
        var user = requireUser(userId);
        user.updateProfile(normalizeName(request.name()), normalizePhone(request.phone()));
        return new ProfileResponse(UserResponse.from(user));
    }

    @Transactional(readOnly = true)
    public User requireUser(UUID userId) {
        return userRepository.findById(userId)
                .filter(User::isActive)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Usuário autenticado não encontrado."));
    }

    private ApiException invalidCredentials() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "E-mail ou senha inválidos.");
    }

    private String normalizeName(String rawName) {
        var name = rawName == null ? "" : rawName.trim().replaceAll("\\s+", " ");
        if (name.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Informe seu nome.");
        }
        return name;
    }

    private String normalizePhone(String rawPhone) {
        var phone = rawPhone == null ? "" : rawPhone.replaceAll("\\D", "");
        if (!phone.isEmpty() && phone.length() != 10 && phone.length() != 11) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Informe um telefone com DDD válido.");
        }
        return phone;
    }
}
