package com.araris.smarthas.finance.service;

import com.araris.smarthas.auth.service.AuthService;
import com.araris.smarthas.common.api.ApiException;
import com.araris.smarthas.finance.domain.BusinessContact;
import com.araris.smarthas.finance.domain.ContactType;
import com.araris.smarthas.finance.domain.Customer;
import com.araris.smarthas.finance.domain.Supplier;
import com.araris.smarthas.finance.dto.ContactCreateRequest;
import com.araris.smarthas.finance.dto.ContactResponse;
import com.araris.smarthas.finance.dto.ContactUpdateRequest;
import com.araris.smarthas.finance.repository.CustomerRepository;
import com.araris.smarthas.finance.repository.SupplierRepository;
import com.araris.smarthas.organization.service.OrganizationService;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BusinessContactService {

    private final CustomerRepository customerRepository;
    private final SupplierRepository supplierRepository;
    private final OrganizationService organizationService;
    private final AuthService authService;

    public BusinessContactService(
            CustomerRepository customerRepository,
            SupplierRepository supplierRepository,
            OrganizationService organizationService,
            AuthService authService
    ) {
        this.customerRepository = customerRepository;
        this.supplierRepository = supplierRepository;
        this.organizationService = organizationService;
        this.authService = authService;
    }

    @Transactional(readOnly = true)
    public List<ContactResponse> list(UUID userId, UUID organizationId, ContactType type) {
        organizationService.requireOwned(organizationId, userId);
        if (type == ContactType.CUSTOMER) {
            return customerRepository.findAllByOrganizationIdOrderByName(organizationId)
                    .stream().map(ContactResponse::from).toList();
        }
        return supplierRepository.findAllByOrganizationIdOrderByName(organizationId)
                .stream().map(ContactResponse::from).toList();
    }

    @Transactional
    public ContactResponse create(UUID userId, ContactType type, ContactCreateRequest request) {
        var organization = organizationService.requireOwned(request.organizationId(), userId);
        var user = authService.requireUser(userId);
        var document = normalizeDocument(request.document());
        ensureUniqueDocument(organization.getId(), type, document, null);
        var phone = normalizePhone(request.phone());
        BusinessContact contact = type == ContactType.CUSTOMER
                ? customerRepository.save(new Customer(organization, user, request, document, phone))
                : supplierRepository.save(new Supplier(organization, user, request, document, phone));
        return ContactResponse.from(contact);
    }

    @Transactional
    public ContactResponse update(UUID userId, UUID contactId, ContactType type, ContactUpdateRequest request) {
        var contact = requireOwned(userId, contactId, type);
        var document = request.document() == null
                ? contact.getDocument()
                : normalizeDocument(request.document());
        ensureUniqueDocument(contact.getOrganization().getId(), type, document, contact.getId());
        var phone = request.phone() == null ? contact.getPhone() : normalizePhone(request.phone());
        contact.update(request, document, phone);
        return ContactResponse.from(contact);
    }

    @Transactional
    public void deactivate(UUID userId, UUID contactId, ContactType type) {
        requireOwned(userId, contactId, type).deactivate();
    }

    @Transactional(readOnly = true)
    public BusinessContact requireActive(
            UUID userId,
            UUID organizationId,
            UUID contactId,
            ContactType type
    ) {
        if (contactId == null) return null;
        var contact = requireOwned(userId, contactId, type);
        if (!contact.isActive() || !contact.getOrganization().getId().equals(organizationId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Contato não encontrado para esta empresa.");
        }
        return contact;
    }

    private BusinessContact requireOwned(UUID userId, UUID contactId, ContactType type) {
        BusinessContact contact = type == ContactType.CUSTOMER
                ? customerRepository.findById(contactId).orElseThrow(this::notFound)
                : supplierRepository.findById(contactId).orElseThrow(this::notFound);
        organizationService.requireOwned(contact.getOrganization().getId(), userId);
        return contact;
    }

    private ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "Contato não encontrado.");
    }

    private void ensureUniqueDocument(UUID organizationId, ContactType type, String document, UUID ignoredId) {
        if (document.isEmpty()) return;
        boolean exists;
        if (type == ContactType.CUSTOMER) {
            exists = ignoredId == null
                    ? customerRepository.existsByOrganizationIdAndDocument(organizationId, document)
                    : customerRepository.existsByOrganizationIdAndDocumentAndIdNot(organizationId, document, ignoredId);
        } else {
            exists = ignoredId == null
                    ? supplierRepository.existsByOrganizationIdAndDocument(organizationId, document)
                    : supplierRepository.existsByOrganizationIdAndDocumentAndIdNot(organizationId, document, ignoredId);
        }
        if (exists) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Já existe um cadastro com este CPF ou CNPJ.");
        }
    }

    private String normalizeDocument(String rawDocument) {
        var document = digits(rawDocument);
        if (!document.isEmpty() && document.length() != 11 && document.length() != 14) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Informe um CPF ou CNPJ válido.");
        }
        return document;
    }

    private String normalizePhone(String rawPhone) {
        var phone = digits(rawPhone);
        if (!phone.isEmpty() && phone.length() != 10 && phone.length() != 11) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Informe um telefone com DDD válido.");
        }
        return phone;
    }

    private String digits(String value) {
        return value == null ? "" : value.replaceAll("\\D", "");
    }
}
