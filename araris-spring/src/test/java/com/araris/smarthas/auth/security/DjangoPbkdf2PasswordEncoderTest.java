package com.araris.smarthas.auth.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class DjangoPbkdf2PasswordEncoderTest {

    private static final String DJANGO_GENERATED_HASH =
            "pbkdf2_sha256$1000000$compatibilitytestsalt123$ArWd19ttung8C/1EMWkFKWbjKFDIIK8yvV5SpPCYiMA=";

    private final DjangoPbkdf2PasswordEncoder encoder = new DjangoPbkdf2PasswordEncoder();

    @Test
    void validatesAHashGeneratedByDjango() {
        assertThat(encoder.matches("Senha@123", DJANGO_GENERATED_HASH)).isTrue();
        assertThat(encoder.matches("senha-incorreta", DJANGO_GENERATED_HASH)).isFalse();
    }

    @Test
    void createsHashesThatFollowTheDjangoFormat() {
        var encoded = encoder.encode("Senha@123");

        assertThat(encoded).startsWith("pbkdf2_sha256$1000000$");
        assertThat(encoder.matches("Senha@123", encoded)).isTrue();
    }

    @Test
    void rejectsDjangoUnusablePasswords() {
        assertThat(encoder.matches("qualquer-senha", "!random-unusable-password")).isFalse();
    }
}
