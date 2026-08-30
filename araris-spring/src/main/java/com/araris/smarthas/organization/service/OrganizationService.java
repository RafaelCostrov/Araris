package com.araris.smarthas.organization.service;

import com.araris.smarthas.auth.domain.User;
import com.araris.smarthas.common.api.ApiException;
import com.araris.smarthas.organization.domain.Membership;
import com.araris.smarthas.organization.domain.Organization;
import com.araris.smarthas.organization.dto.OrganizationRequest;
import com.araris.smarthas.organization.dto.OrganizationResponse;
import com.araris.smarthas.organization.dto.OrganizationUpdateRequest;
import com.araris.smarthas.organization.repository.MembershipRepository;
import com.araris.smarthas.organization.repository.OrganizationRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrganizationService {

    private final OrganizationRepository organizationRepository;
    private final MembershipRepository membershipRepository;

    public OrganizationService(
            OrganizationRepository organizationRepository,
            MembershipRepository membershipRepository
    ) {
        this.organizationRepository = organizationRepository;
        this.membershipRepository = membershipRepository;
    }

    @Transactional
    public CreatedOrganization create(User owner, OrganizationRequest request) {
        var cnpj = digits(request.cnpj());
        validateCnpj(cnpj);
        if (organizationRepository.existsByCnpj(cnpj)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Já existe uma empresa com este CNPJ.");
        }
        var postalCode = normalizePostalCode(request.postalCode());
        var organization = organizationRepository.save(new Organization(owner, request, cnpj, postalCode));
        var membership = membershipRepository.save(new Membership(organization, owner));
        return new CreatedOrganization(organization, membership);
    }

    @Transactional(readOnly = true)
    public List<Membership> getActiveMemberships(UUID userId) {
        return membershipRepository.findAllByUserIdAndStatusOrderByCreatedAt(userId, "active");
    }

    @Transactional(readOnly = true)
    public Organization getCurrent(UUID userId) {
        return getCurrentMembership(userId).getOrganization();
    }

    @Transactional(readOnly = true)
    public Organization requireOwned(UUID organizationId, UUID userId) {
        if (!membershipRepository.existsByOrganizationIdAndUserIdAndStatus(organizationId, userId, "active")) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Empresa não encontrada para este usuário.");
        }
        return organizationRepository.findByIdAndStatus(organizationId, "active")
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Empresa não encontrada para este usuário."));
    }

    @Transactional
    public OrganizationResponse updateCurrent(UUID userId, OrganizationUpdateRequest request) {
        var organization = getCurrent(userId);
        var postalCode = request.postalCode() == null
                ? organization.getPostalCode()
                : normalizePostalCode(request.postalCode());
        organization.update(request, postalCode);
        return OrganizationResponse.from(organization);
    }

    @Transactional(readOnly = true)
    public boolean isCnpjAvailable(String rawCnpj) {
        var cnpj = digits(rawCnpj);
        validateCnpj(cnpj);
        return !organizationRepository.existsByCnpj(cnpj);
    }

    private Membership getCurrentMembership(UUID userId) {
        return membershipRepository.findFirstByUserIdAndStatusOrderByCreatedAt(userId, "active")
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Usuário não possui empresa ativa."));
    }

    private void validateCnpj(String cnpj) {
        if (cnpj.length() != 14) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Informe um CNPJ com 14 dígitos.");
        }
    }

    private String normalizePostalCode(String rawPostalCode) {
        var postalCode = digits(rawPostalCode);
        if (!postalCode.isEmpty() && postalCode.length() != 8) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Informe um CEP com 8 dígitos.");
        }
        return postalCode;
    }

    private String digits(String value) {
        return value == null ? "" : value.replaceAll("\\D", "");
    }

    public record CreatedOrganization(Organization organization, Membership membership) {
    }
}
