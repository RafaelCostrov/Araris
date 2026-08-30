package com.araris.smarthas.organization.repository;

import com.araris.smarthas.organization.domain.Organization;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationRepository extends JpaRepository<Organization, UUID> {

    boolean existsByCnpj(String cnpj);

    Optional<Organization> findByIdAndStatus(UUID id, String status);
}
