package com.araris.smarthas.auth.dto;

import com.araris.smarthas.organization.domain.Membership;
import com.araris.smarthas.organization.dto.OrganizationResponse;
import java.time.Instant;
import java.util.UUID;

public record MembershipResponse(
        UUID id,
        OrganizationResponse organization,
        String role,
        String status,
        String inviteEmail,
        Instant acceptedAt,
        Instant lastAccessAt,
        Instant createdAt
) {
    public static MembershipResponse from(Membership membership) {
        return new MembershipResponse(
                membership.getId(),
                OrganizationResponse.from(membership.getOrganization()),
                membership.getRole(),
                membership.getStatus(),
                membership.getInviteEmail(),
                membership.getAcceptedAt(),
                membership.getLastAccessAt(),
                membership.getCreatedAt()
        );
    }
}
