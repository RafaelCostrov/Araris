package com.araris.smarthas.finance.controller;

import com.araris.smarthas.finance.domain.ContactType;
import com.araris.smarthas.finance.dto.ContactCreateRequest;
import com.araris.smarthas.finance.dto.ContactResponse;
import com.araris.smarthas.finance.dto.ContactUpdateRequest;
import com.araris.smarthas.finance.service.BusinessContactService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/finance")
public class BusinessContactController {

    private final BusinessContactService contactService;

    public BusinessContactController(BusinessContactService contactService) {
        this.contactService = contactService;
    }

    @GetMapping("/customers/")
    List<ContactResponse> customers(@AuthenticationPrincipal Jwt jwt, @RequestParam("organization_id") UUID organizationId) {
        return contactService.list(userId(jwt), organizationId, ContactType.CUSTOMER);
    }

    @PostMapping("/customers/")
    @ResponseStatus(HttpStatus.CREATED)
    ContactResponse createCustomer(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ContactCreateRequest request) {
        return contactService.create(userId(jwt), ContactType.CUSTOMER, request);
    }

    @PatchMapping("/customers/{id}/")
    ContactResponse updateCustomer(
            @AuthenticationPrincipal Jwt jwt,
            @org.springframework.web.bind.annotation.PathVariable UUID id,
            @Valid @RequestBody ContactUpdateRequest request
    ) {
        return contactService.update(userId(jwt), id, ContactType.CUSTOMER, request);
    }

    @DeleteMapping("/customers/{id}/")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deactivateCustomer(@AuthenticationPrincipal Jwt jwt, @org.springframework.web.bind.annotation.PathVariable UUID id) {
        contactService.deactivate(userId(jwt), id, ContactType.CUSTOMER);
    }

    @GetMapping("/suppliers/")
    List<ContactResponse> suppliers(@AuthenticationPrincipal Jwt jwt, @RequestParam("organization_id") UUID organizationId) {
        return contactService.list(userId(jwt), organizationId, ContactType.SUPPLIER);
    }

    @PostMapping("/suppliers/")
    @ResponseStatus(HttpStatus.CREATED)
    ContactResponse createSupplier(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ContactCreateRequest request) {
        return contactService.create(userId(jwt), ContactType.SUPPLIER, request);
    }

    @PatchMapping("/suppliers/{id}/")
    ContactResponse updateSupplier(
            @AuthenticationPrincipal Jwt jwt,
            @org.springframework.web.bind.annotation.PathVariable UUID id,
            @Valid @RequestBody ContactUpdateRequest request
    ) {
        return contactService.update(userId(jwt), id, ContactType.SUPPLIER, request);
    }

    @DeleteMapping("/suppliers/{id}/")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deactivateSupplier(@AuthenticationPrincipal Jwt jwt, @org.springframework.web.bind.annotation.PathVariable UUID id) {
        contactService.deactivate(userId(jwt), id, ContactType.SUPPLIER);
    }

    private UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
