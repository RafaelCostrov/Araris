package com.araris.smarthas.organization.controller;

import com.araris.smarthas.organization.dto.OrganizationResponse;
import com.araris.smarthas.organization.dto.OrganizationUpdateRequest;
import com.araris.smarthas.organization.service.OrganizationService;
import jakarta.validation.Valid;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/organizations")
public class OrganizationController {

    private final OrganizationService organizationService;

    public OrganizationController(OrganizationService organizationService) {
        this.organizationService = organizationService;
    }

    @GetMapping("/check-cnpj/")
    Map<String, Boolean> checkCnpj(@RequestParam String cnpj) {
        return Map.of("available", organizationService.isCnpjAvailable(cnpj));
    }

    @GetMapping("/current/")
    OrganizationResponse current(@AuthenticationPrincipal Jwt jwt) {
        return OrganizationResponse.from(organizationService.getCurrent(UUID.fromString(jwt.getSubject())));
    }

    @PatchMapping("/current/")
    OrganizationResponse updateCurrent(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody OrganizationUpdateRequest request
    ) {
        return organizationService.updateCurrent(UUID.fromString(jwt.getSubject()), request);
    }
}
