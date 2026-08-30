package com.araris.smarthas.auth.dto;

import java.util.List;

public record MeResponse(UserResponse user, List<MembershipResponse> memberships) {
}
