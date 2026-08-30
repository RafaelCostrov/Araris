package com.araris.smarthas.finance.domain;

import com.araris.smarthas.auth.domain.User;
import com.araris.smarthas.finance.dto.MovementCreateRequest;
import com.araris.smarthas.organization.domain.Organization;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "finance_revenue")
public class Revenue extends FinancialMovement {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    @Column(name = "source_receivable_id")
    private UUID sourceReceivableId;

    protected Revenue() {
    }

    public Revenue(
            Organization organization,
            User createdBy,
            Customer customer,
            MovementCreateRequest request
    ) {
        super(organization, createdBy, request);
        this.customer = customer;
    }

    @Override
    public MovementType getType() { return MovementType.REVENUE; }

    @Override
    public BusinessContact getContact() { return customer; }

    @Override
    public void setContact(BusinessContact contact) { customer = (Customer) contact; }

    @Override
    public UUID getSourceCommitmentId() { return sourceReceivableId; }
}
