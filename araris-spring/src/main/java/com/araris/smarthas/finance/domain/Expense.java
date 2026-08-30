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
@Table(name = "finance_expense")
public class Expense extends FinancialMovement {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id")
    private Supplier supplier;

    @Column(name = "source_payable_id")
    private UUID sourcePayableId;

    protected Expense() {
    }

    public Expense(
            Organization organization,
            User createdBy,
            Supplier supplier,
            MovementCreateRequest request
    ) {
        super(organization, createdBy, request);
        this.supplier = supplier;
    }

    @Override
    public MovementType getType() { return MovementType.EXPENSE; }

    @Override
    public BusinessContact getContact() { return supplier; }

    @Override
    public void setContact(BusinessContact contact) { supplier = (Supplier) contact; }

    @Override
    public UUID getSourceCommitmentId() { return sourcePayableId; }
}
