package com.araris.smarthas.auth.dto;

import com.araris.smarthas.organization.dto.OrganizationResponse;

public record RegisterResponse(
        UserResponse user,
        OrganizationResponse organization,
        MembershipResponse membership,
        String refresh,
        String access
) {
}
