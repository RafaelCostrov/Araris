package com.araris.smarthas.finance.domain;

import com.araris.smarthas.auth.domain.User;
import com.araris.smarthas.common.persistence.BaseEntity;
import com.araris.smarthas.finance.dto.ContactCreateRequest;
import com.araris.smarthas.finance.dto.ContactUpdateRequest;
import com.araris.smarthas.organization.domain.Organization;
import jakarta.persistence.Column;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MappedSuperclass;

@MappedSuperclass
public abstract class BusinessContact extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false, length = 14)
    private String document = "";

    @Column(nullable = false, length = 254)
    private String email = "";

    @Column(nullable = false, length = 20)
    private String phone = "";

    @Column(nullable = false, columnDefinition = "text")
    private String notes = "";

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    private User createdBy;

    protected BusinessContact() {
    }

    protected BusinessContact(
            Organization organization,
            User createdBy,
            ContactCreateRequest request,
            String document,
            String phone
    ) {
        this.organization = organization;
        this.createdBy = createdBy;
        this.name = request.name().trim();
        this.document = document;
        this.email = value(request.email()).toLowerCase();
        this.phone = phone;
        this.notes = value(request.notes());
    }

    public void update(ContactUpdateRequest request, String normalizedDocument, String normalizedPhone) {
        if (request.name() != null) name = request.name().trim();
        if (request.document() != null) document = normalizedDocument;
        if (request.email() != null) email = value(request.email()).toLowerCase();
        if (request.phone() != null) phone = normalizedPhone;
        if (request.notes() != null) notes = value(request.notes());
        if (request.isActive() != null) active = request.isActive();
    }

    public void deactivate() {
        active = false;
    }

    private static String value(String value) {
        return value == null ? "" : value.trim();
    }

    public abstract ContactType getType();

    public Organization getOrganization() { return organization; }
    public String getName() { return name; }
    public String getDocument() { return document; }
    public String getEmail() { return email; }
    public String getPhone() { return phone; }
    public String getNotes() { return notes; }
    public boolean isActive() { return active; }
}
