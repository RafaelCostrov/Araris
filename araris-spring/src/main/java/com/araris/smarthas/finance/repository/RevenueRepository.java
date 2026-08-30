package com.araris.smarthas.finance.repository;

import com.araris.smarthas.finance.domain.Revenue;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RevenueRepository extends JpaRepository<Revenue, UUID> {

    List<Revenue> findAllByOrganizationIdOrderByOccurredOnDescCreatedAtDesc(UUID organizationId);

    List<Revenue> findAllByOrganizationIdAndOccurredOnGreaterThanEqualAndOccurredOnLessThanOrderByOccurredOnDescCreatedAtDesc(
            UUID organizationId,
            LocalDate start,
            LocalDate end
    );

    List<Revenue> findAllByOrganizationIdAndOccurredOnLessThanOrderByOccurredOnDescCreatedAtDesc(
            UUID organizationId,
            LocalDate end
    );
}
