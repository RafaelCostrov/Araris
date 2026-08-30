package com.araris.smarthas.organization.domain;

import com.araris.smarthas.auth.domain.User;
import com.araris.smarthas.common.persistence.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "organizations_membership")
public class Membership extends BaseEntity {

    @Column(name = "invite_email", nullable = false, length = 254)
    private String inviteEmail;

    @Column(nullable = false, length = 20)
    private String role;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "invite_token", unique = true, length = 255)
    private String inviteToken;

    @Column(name = "invited_at", nullable = false)
    private Instant invitedAt;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "accepted_at")
    private Instant acceptedAt;

    @Column(name = "deactivated_at")
    private Instant deactivatedAt;

    @Column(name = "last_access_at")
    private Instant lastAccessAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invited_by_id")
    private User invitedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    protected Membership() {
    }

    public Membership(Organization organization, User user) {
        this.organization = organization;
        this.user = user;
        this.invitedBy = user;
        this.inviteEmail = user.getEmail();
        this.role = "owner";
        this.status = "active";
    }

    @PrePersist
    void setInvitationTime() {
        if (invitedAt == null) {
            invitedAt = Instant.now();
        }
    }

    public String getInviteEmail() { return inviteEmail; }
    public String getRole() { return role; }
    public String getStatus() { return status; }
    public Instant getAcceptedAt() { return acceptedAt; }
    public Instant getLastAccessAt() { return lastAccessAt; }
    public User getUser() { return user; }
    public Organization getOrganization() { return organization; }
}
