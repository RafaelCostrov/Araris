package com.araris.smarthas.organization.dto;

import com.araris.smarthas.organization.domain.Organization;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record OrganizationResponse(
        UUID id,
        String businessName,
        String tradeName,
        String cnpj,
        String businessCategory,
        String postalCode,
        String street,
        String number,
        String addressComplement,
        String neighborhood,
        String city,
        String state,
        String ibgeCode,
        String cnaeCode,
        String cnaeDescription,
        Boolean meiOptIn,
        String registrationStatus,
        BigDecimal initialBalance,
        String status,
        String timezone,
        Instant createdAt,
        Instant updatedAt
) {
    public static OrganizationResponse from(Organization organization) {
        return new OrganizationResponse(
                organization.getId(),
                organization.getBusinessName(),
                organization.getTradeName(),
                organization.getCnpj(),
                organization.getBusinessCategory(),
                organization.getPostalCode(),
                organization.getStreet(),
                organization.getNumber(),
                organization.getAddressComplement(),
                organization.getNeighborhood(),
                organization.getCity(),
                organization.getState(),
                organization.getIbgeCode(),
                organization.getCnaeCode(),
                organization.getCnaeDescription(),
                organization.getMeiOptIn(),
                organization.getRegistrationStatus(),
                organization.getInitialBalance(),
                organization.getStatus(),
                organization.getTimezone(),
                organization.getCreatedAt(),
                organization.getUpdatedAt()
        );
    }
}
