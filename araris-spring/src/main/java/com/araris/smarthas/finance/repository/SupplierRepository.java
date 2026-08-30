package com.araris.smarthas.finance.repository;

import com.araris.smarthas.finance.domain.Supplier;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SupplierRepository extends JpaRepository<Supplier, UUID> {

    List<Supplier> findAllByOrganizationIdOrderByName(UUID organizationId);

    boolean existsByOrganizationIdAndDocument(UUID organizationId, String document);

    boolean existsByOrganizationIdAndDocumentAndIdNot(UUID organizationId, String document, UUID id);
}
