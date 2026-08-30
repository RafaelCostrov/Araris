package com.araris.smarthas.organization.domain;

import com.araris.smarthas.auth.domain.User;
import com.araris.smarthas.common.persistence.BaseEntity;
import com.araris.smarthas.organization.dto.OrganizationRequest;
import com.araris.smarthas.organization.dto.OrganizationUpdateRequest;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;

@Entity
@Table(name = "organizations_organization")
public class Organization extends BaseEntity {

    @Column(name = "business_name", nullable = false, length = 255)
    private String businessName;

    @Column(name = "trade_name", nullable = false, length = 255)
    private String tradeName = "";

    @Column(nullable = false, unique = true, length = 14)
    private String cnpj;

    @Column(name = "business_category", nullable = false, length = 30)
    private String businessCategory = "";

    @Column(name = "postal_code", nullable = false, length = 8)
    private String postalCode = "";

    @Column(nullable = false, length = 255)
    private String street = "";

    @Column(nullable = false, length = 30)
    private String number = "";

    @Column(name = "address_complement", nullable = false, length = 120)
    private String addressComplement = "";

    @Column(nullable = false, length = 120)
    private String neighborhood = "";

    @Column(nullable = false, length = 120)
    private String city = "";

    @Column(nullable = false, length = 2)
    private String state = "";

    @Column(name = "ibge_code", nullable = false, length = 20)
    private String ibgeCode = "";

    @Column(name = "cnae_code", nullable = false, length = 20)
    private String cnaeCode = "";

    @Column(name = "cnae_description", nullable = false, length = 255)
    private String cnaeDescription = "";

    @Column(name = "mei_opt_in")
    private Boolean meiOptIn;

    @Column(name = "registration_status", nullable = false, length = 40)
    private String registrationStatus = "";

    @Column(name = "initial_balance", nullable = false, precision = 12, scale = 2)
    private BigDecimal initialBalance = BigDecimal.ZERO;

    @Column(nullable = false, length = 20)
    private String status = "active";

    @Column(nullable = false, length = 64)
    private String timezone = "America/Sao_Paulo";

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by_id", nullable = false)
    private User owner;

    protected Organization() {
    }

    public Organization(User owner, OrganizationRequest request, String cnpj, String postalCode) {
        this.owner = owner;
        this.cnpj = cnpj;
        apply(request, postalCode);
    }

    private void apply(OrganizationRequest request, String normalizedPostalCode) {
        businessName = request.businessName().trim();
        tradeName = value(request.tradeName());
        businessCategory = value(request.businessCategory());
        postalCode = normalizedPostalCode;
        street = value(request.street());
        number = value(request.number());
        addressComplement = value(request.addressComplement());
        neighborhood = value(request.neighborhood());
        city = value(request.city());
        state = value(request.state()).toUpperCase();
        ibgeCode = value(request.ibgeCode());
        cnaeCode = value(request.cnaeCode());
        cnaeDescription = value(request.cnaeDescription());
        meiOptIn = request.meiOptIn();
        registrationStatus = value(request.registrationStatus());
        initialBalance = request.initialBalance() == null ? BigDecimal.ZERO : request.initialBalance();
        timezone = request.timezone() == null || request.timezone().isBlank()
                ? "America/Sao_Paulo"
                : request.timezone().trim();
    }

    public void update(OrganizationUpdateRequest request, String normalizedPostalCode) {
        if (request.businessName() != null) businessName = request.businessName().trim();
        if (request.tradeName() != null) tradeName = value(request.tradeName());
        if (request.businessCategory() != null) businessCategory = value(request.businessCategory());
        if (request.postalCode() != null) postalCode = normalizedPostalCode;
        if (request.street() != null) street = value(request.street());
        if (request.number() != null) number = value(request.number());
        if (request.addressComplement() != null) addressComplement = value(request.addressComplement());
        if (request.neighborhood() != null) neighborhood = value(request.neighborhood());
        if (request.city() != null) city = value(request.city());
        if (request.state() != null) state = value(request.state()).toUpperCase();
        if (request.ibgeCode() != null) ibgeCode = value(request.ibgeCode());
        if (request.cnaeCode() != null) cnaeCode = value(request.cnaeCode());
        if (request.cnaeDescription() != null) cnaeDescription = value(request.cnaeDescription());
        if (request.meiOptIn() != null) meiOptIn = request.meiOptIn();
        if (request.registrationStatus() != null) registrationStatus = value(request.registrationStatus());
        if (request.initialBalance() != null) initialBalance = request.initialBalance();
        if (request.timezone() != null && !request.timezone().isBlank()) timezone = request.timezone().trim();
    }

    private static String value(String value) {
        return value == null ? "" : value.trim();
    }

    public String getBusinessName() { return businessName; }
    public String getTradeName() { return tradeName; }
    public String getCnpj() { return cnpj; }
    public String getBusinessCategory() { return businessCategory; }
    public String getPostalCode() { return postalCode; }
    public String getStreet() { return street; }
    public String getNumber() { return number; }
    public String getAddressComplement() { return addressComplement; }
    public String getNeighborhood() { return neighborhood; }
    public String getCity() { return city; }
    public String getState() { return state; }
    public String getIbgeCode() { return ibgeCode; }
    public String getCnaeCode() { return cnaeCode; }
    public String getCnaeDescription() { return cnaeDescription; }
    public Boolean getMeiOptIn() { return meiOptIn; }
    public String getRegistrationStatus() { return registrationStatus; }
    public BigDecimal getInitialBalance() { return initialBalance; }
    public String getStatus() { return status; }
    public String getTimezone() { return timezone; }
    public User getOwner() { return owner; }
}
