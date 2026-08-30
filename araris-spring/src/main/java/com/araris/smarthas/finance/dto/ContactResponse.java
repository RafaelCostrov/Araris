package com.araris.smarthas.finance.dto;

import com.araris.smarthas.finance.domain.BusinessContact;
import java.time.Instant;
import java.util.UUID;

public record ContactResponse(
        UUID id,
        UUID organizationId,
        String name,
        String document,
        String email,
        String phone,
        String notes,
        boolean isActive,
        Instant createdAt,
        Instant updatedAt
) {
    public static ContactResponse from(BusinessContact contact) {
        return new ContactResponse(
                contact.getId(),
                contact.getOrganization().getId(),
                contact.getName(),
                contact.getDocument(),
                contact.getEmail(),
                contact.getPhone(),
                contact.getNotes(),
                contact.isActive(),
                contact.getCreatedAt(),
                contact.getUpdatedAt()
        );
    }
}
