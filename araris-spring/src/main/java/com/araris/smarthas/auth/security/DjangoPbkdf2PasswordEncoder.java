package com.araris.smarthas.auth.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.security.spec.InvalidKeySpecException;
import java.util.Base64;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import org.springframework.security.crypto.password.PasswordEncoder;

public class DjangoPbkdf2PasswordEncoder implements PasswordEncoder {

    static final String ALGORITHM = "pbkdf2_sha256";
    static final int DEFAULT_ITERATIONS = 1_000_000;
    private static final int KEY_LENGTH_BITS = 256;
    private static final int SALT_LENGTH = 22;
    private static final String SALT_CHARACTERS =
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    private final SecureRandom secureRandom = new SecureRandom();

    @Override
    public String encode(CharSequence rawPassword) {
        var salt = generateSalt();
        return encode(rawPassword, salt, DEFAULT_ITERATIONS);
    }

    @Override
    public boolean matches(CharSequence rawPassword, String encodedPassword) {
        if (encodedPassword == null || encodedPassword.startsWith("!")) {
            return false;
        }
        var parts = encodedPassword.split("\\$", -1);
        if (parts.length != 4 || !ALGORITHM.equals(parts[0])) {
            return false;
        }
        try {
            var iterations = Integer.parseInt(parts[1]);
            var candidate = encode(rawPassword, parts[2], iterations);
            return MessageDigest.isEqual(
                    candidate.getBytes(StandardCharsets.UTF_8),
                    encodedPassword.getBytes(StandardCharsets.UTF_8)
            );
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    @Override
    public boolean upgradeEncoding(String encodedPassword) {
        if (encodedPassword == null || !encodedPassword.startsWith(ALGORITHM + "$")) {
            return false;
        }
        try {
            return Integer.parseInt(encodedPassword.split("\\$", -1)[1]) < DEFAULT_ITERATIONS;
        } catch (RuntimeException exception) {
            return false;
        }
    }

    private String encode(CharSequence rawPassword, String salt, int iterations) {
        try {
            var specification = new PBEKeySpec(
                    rawPassword.toString().toCharArray(),
                    salt.getBytes(StandardCharsets.UTF_8),
                    iterations,
                    KEY_LENGTH_BITS
            );
            var encoded = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                    .generateSecret(specification)
                    .getEncoded();
            return ALGORITHM + "$" + iterations + "$" + salt + "$"
                    + Base64.getEncoder().encodeToString(encoded);
        } catch (NoSuchAlgorithmException | InvalidKeySpecException exception) {
            throw new IllegalStateException("Não foi possível calcular a senha PBKDF2.", exception);
        }
    }

    private String generateSalt() {
        var salt = new StringBuilder(SALT_LENGTH);
        for (var index = 0; index < SALT_LENGTH; index++) {
            salt.append(SALT_CHARACTERS.charAt(secureRandom.nextInt(SALT_CHARACTERS.length())));
        }
        return salt.toString();
    }
}
