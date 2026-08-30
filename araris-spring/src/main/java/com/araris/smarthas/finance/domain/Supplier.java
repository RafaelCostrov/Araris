package com.araris.smarthas.finance.domain;

import com.araris.smarthas.auth.domain.User;
import com.araris.smarthas.finance.dto.ContactCreateRequest;
import com.araris.smarthas.organization.domain.Organization;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "finance_supplier")
public class Supplier extends BusinessContact {

    protected Supplier() {
    }

    public Supplier(
            Organization organization,
            User createdBy,
            ContactCreateRequest request,
            String document,
            String phone
    ) {
        super(organization, createdBy, request, document, phone);
    }

    @Override
    public ContactType getType() {
        return ContactType.SUPPLIER;
    }
}
