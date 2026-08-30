package com.araris.smarthas.auth.dto;

import com.araris.smarthas.auth.domain.User;
import java.time.Instant;
import java.util.UUID;

public record UserResponse(
        UUID id,
        String name,
        String email,
        String phone,
        String authProvider,
        boolean lgpdConsentGiven,
        Instant lgpdConsentedAt,
        Instant dateJoined
) {
    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getPhone(),
                user.getAuthProvider(),
                user.isLgpdConsentGiven(),
                user.getLgpdConsentedAt(),
                user.getDateJoined()
        );
    }
}
