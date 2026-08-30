package com.araris.smarthas.finance.repository;

import com.araris.smarthas.finance.domain.Customer;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomerRepository extends JpaRepository<Customer, UUID> {

    List<Customer> findAllByOrganizationIdOrderByName(UUID organizationId);

    boolean existsByOrganizationIdAndDocument(UUID organizationId, String document);

    boolean existsByOrganizationIdAndDocumentAndIdNot(UUID organizationId, String document, UUID id);
}
