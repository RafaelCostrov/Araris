package com.araris.smarthas.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "accounts_user")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "password", nullable = false, length = 128)
    private String passwordHash;

    @Column(name = "last_login")
    private Instant lastLogin;

    @Column(name = "is_superuser", nullable = false)
    private boolean superuser;

    @Column(nullable = false, unique = true, length = 150)
    private String username;

    @Column(name = "first_name", nullable = false, length = 150)
    private String firstName = "";

    @Column(name = "last_name", nullable = false, length = 150)
    private String lastName = "";

    @Column(name = "is_staff", nullable = false)
    private boolean staff;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "date_joined", nullable = false)
    private Instant dateJoined;

    @Column(nullable = false, unique = true, length = 254)
    private String email;

    @Column(nullable = false, length = 20)
    private String phone = "";

    @Column(name = "auth_provider", nullable = false, length = 20)
    private String authProvider = "local";

    @Column(name = "google_id", nullable = false, length = 255)
    private String googleId = "";

    @Column(name = "lgpd_consent_given", nullable = false)
    private boolean lgpdConsentGiven;

    @Column(name = "lgpd_consented_at")
    private Instant lgpdConsentedAt;

    protected User() {
    }

    public User(
            String name,
            String email,
            String passwordHash,
            String phone,
            boolean lgpdConsentGiven
    ) {
        updateName(name);
        this.email = email;
        this.username = email;
        this.passwordHash = passwordHash;
        this.phone = phone;
        this.lgpdConsentGiven = lgpdConsentGiven;
        this.lgpdConsentedAt = lgpdConsentGiven ? Instant.now() : null;
    }

    @PrePersist
    void onCreate() {
        if (dateJoined == null) {
            dateJoined = Instant.now();
        }
    }

    public void updateProfile(String name, String phone) {
        updateName(name);
        this.phone = phone;
    }

    private void updateName(String name) {
        var parts = name.trim().split("\\s+", 2);
        firstName = truncate(parts[0], 150);
        lastName = parts.length > 1 ? truncate(parts[1], 150) : "";
    }

    private String truncate(String value, int maxLength) {
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }

    public UUID getId() { return id; }
    public String getName() { return (firstName + " " + lastName).trim(); }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getPhone() { return phone; }
    public UserRole getRole() { return superuser || staff ? UserRole.ADMIN : UserRole.USER; }
    public boolean isActive() { return active; }
    public String getAuthProvider() { return authProvider; }
    public boolean isLgpdConsentGiven() { return lgpdConsentGiven; }
    public Instant getLgpdConsentedAt() { return lgpdConsentedAt; }
    public Instant getDateJoined() { return dateJoined; }
}
