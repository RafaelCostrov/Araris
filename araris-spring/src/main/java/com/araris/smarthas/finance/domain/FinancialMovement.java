package com.araris.smarthas.finance.domain;

import com.araris.smarthas.auth.domain.User;
import com.araris.smarthas.common.persistence.BaseEntity;
import com.araris.smarthas.finance.dto.MovementCreateRequest;
import com.araris.smarthas.finance.dto.MovementUpdateRequest;
import com.araris.smarthas.organization.domain.Organization;
import jakarta.persistence.Column;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MappedSuperclass;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@MappedSuperclass
public abstract class FinancialMovement extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @Column(nullable = false, length = 255)
    private String description;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(name = "occurred_on", nullable = false)
    private LocalDate occurredOn;

    @Column(nullable = false, length = 30)
    private String category;

    @Column(name = "payment_method", nullable = false, length = 30)
    private String paymentMethod = "";

    @Column(nullable = false, columnDefinition = "text")
    private String notes = "";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    private User createdBy;

    protected FinancialMovement() {
    }

    protected FinancialMovement(
            Organization organization,
            User createdBy,
            MovementCreateRequest request
    ) {
        this.organization = organization;
        this.createdBy = createdBy;
        description = request.description().trim();
        amount = request.amount();
        occurredOn = request.occurredOn();
        category = request.category().trim();
        paymentMethod = value(request.paymentMethod());
        notes = value(request.notes());
    }

    public void update(MovementUpdateRequest request) {
        if (request.description() != null) description = request.description().trim();
        if (request.amount() != null) amount = request.amount();
        if (request.occurredOn() != null) occurredOn = request.occurredOn();
        if (request.category() != null) category = request.category().trim();
        if (request.paymentMethod() != null) paymentMethod = value(request.paymentMethod());
        if (request.notes() != null) notes = value(request.notes());
    }

    private static String value(String value) {
        return value == null ? "" : value.trim();
    }

    public abstract MovementType getType();
    public abstract BusinessContact getContact();
    public abstract void setContact(BusinessContact contact);
    public abstract UUID getSourceCommitmentId();

    public Organization getOrganization() { return organization; }
    public String getDescription() { return description; }
    public BigDecimal getAmount() { return amount; }
    public LocalDate getOccurredOn() { return occurredOn; }
    public String getCategory() { return category; }
    public String getPaymentMethod() { return paymentMethod; }
    public String getNotes() { return notes; }
}
