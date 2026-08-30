package com.araris.smarthas.auth.service;

import com.araris.smarthas.auth.domain.RefreshToken;
import com.araris.smarthas.auth.domain.User;
import com.araris.smarthas.auth.dto.TokenPairResponse;
import com.araris.smarthas.auth.repository.RefreshTokenRepository;
import com.araris.smarthas.config.JwtProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    private final JwtEncoder jwtEncoder;
    private final JwtProperties properties;
    private final RefreshTokenRepository refreshTokenRepository;
    private final SecureRandom secureRandom = new SecureRandom();

    public JwtService(
            JwtEncoder jwtEncoder,
            JwtProperties properties,
            RefreshTokenRepository refreshTokenRepository
    ) {
        this.jwtEncoder = jwtEncoder;
        this.properties = properties;
        this.refreshTokenRepository = refreshTokenRepository;
    }

    public TokenPairResponse issuePair(User user) {
        var now = Instant.now();
        var expiresAt = now.plus(properties.accessTokenMinutes(), ChronoUnit.MINUTES);
        var claims = JwtClaimsSet.builder()
                .issuer(properties.issuer())
                .issuedAt(now)
                .expiresAt(expiresAt)
                .subject(user.getId().toString())
                .claim("email", user.getEmail())
                .claim("roles", List.of(user.getRole().name()))
                .claim("type", "access")
                .build();
        var header = JwsHeader.with(MacAlgorithm.HS256).type("JWT").build();
        var access = jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();

        var rawRefreshToken = generateRefreshToken();
        refreshTokenRepository.save(new RefreshToken(
                user,
                hash(rawRefreshToken),
                now.plus(properties.refreshTokenDays(), ChronoUnit.DAYS)
        ));
        return new TokenPairResponse(rawRefreshToken, access);
    }

    public String hash(String rawToken) {
        try {
            var digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(rawToken.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 indisponível.", exception);
        }
    }

    private String generateRefreshToken() {
        var bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
