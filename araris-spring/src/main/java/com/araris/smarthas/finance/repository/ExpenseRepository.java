package com.araris.smarthas.finance.repository;

import com.araris.smarthas.finance.domain.Expense;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExpenseRepository extends JpaRepository<Expense, UUID> {

    List<Expense> findAllByOrganizationIdOrderByOccurredOnDescCreatedAtDesc(UUID organizationId);

    List<Expense> findAllByOrganizationIdAndOccurredOnGreaterThanEqualAndOccurredOnLessThanOrderByOccurredOnDescCreatedAtDesc(
            UUID organizationId,
            LocalDate start,
            LocalDate end
    );

    List<Expense> findAllByOrganizationIdAndOccurredOnLessThanOrderByOccurredOnDescCreatedAtDesc(
            UUID organizationId,
            LocalDate end
    );
}
