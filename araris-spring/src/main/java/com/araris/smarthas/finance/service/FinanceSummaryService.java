package com.araris.smarthas.finance.service;

import com.araris.smarthas.finance.domain.FinancialMovement;
import com.araris.smarthas.finance.domain.MovementType;
import com.araris.smarthas.finance.dto.FinanceSummaryResponse;
import com.araris.smarthas.finance.dto.FinanceSummaryResponse.Counts;
import com.araris.smarthas.finance.dto.FinanceSummaryResponse.RecentActivity;
import com.araris.smarthas.finance.dto.FinanceSummaryResponse.Totals;
import com.araris.smarthas.organization.service.OrganizationService;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FinanceSummaryService {

    private static final BigDecimal ZERO = new BigDecimal("0.00");

    private final FinancialMovementService movementService;
    private final OrganizationService organizationService;

    public FinanceSummaryService(
            FinancialMovementService movementService,
            OrganizationService organizationService
    ) {
        this.movementService = movementService;
        this.organizationService = organizationService;
    }

    @Transactional(readOnly = true)
    public FinanceSummaryResponse summarize(UUID userId, UUID organizationId, String rawMonth) {
        var organization = organizationService.requireOwned(organizationId, userId);
        YearMonth month = movementService.parseMonth(rawMonth);
        var start = month.atDay(1);
        var end = month.plusMonths(1).atDay(1);
        var movements = movementService.allBefore(userId, organizationId, end);

        var previousMovements = movements.stream().filter(item -> item.getOccurredOn().isBefore(start)).toList();
        var monthMovements = movements.stream().filter(item -> !item.getOccurredOn().isBefore(start)).toList();

        var previousRevenue = sum(previousMovements, MovementType.REVENUE);
        var previousExpense = sum(previousMovements, MovementType.EXPENSE);
        var monthRevenue = sum(monthMovements, MovementType.REVENUE);
        var monthExpense = sum(monthMovements, MovementType.EXPENSE);
        var openingBalance = organization.getInitialBalance().add(previousRevenue).subtract(previousExpense);
        var closingBalance = openingBalance.add(monthRevenue).subtract(monthExpense);

        var totals = new Totals(
                monthRevenue,
                monthExpense,
                monthRevenue.subtract(monthExpense),
                openingBalance,
                closingBalance,
                closingBalance,
                ZERO, ZERO, ZERO, ZERO, ZERO, ZERO
        );
        var counts = new Counts(0, 0, 0, 0, 0, 0);
        var recentActivity = monthMovements.stream()
                .sorted(Comparator.comparing(FinancialMovement::getOccurredOn)
                        .thenComparing(FinancialMovement::getCreatedAt)
                        .reversed())
                .limit(8)
                .map(this::toRecentActivity)
                .toList();

        return new FinanceSummaryResponse(start, totals, counts, recentActivity);
    }

    private BigDecimal sum(List<FinancialMovement> movements, MovementType type) {
        return movements.stream()
                .filter(item -> item.getType() == type)
                .map(FinancialMovement::getAmount)
                .reduce(ZERO, BigDecimal::add);
    }

    private RecentActivity toRecentActivity(FinancialMovement movement) {
        var customer = movement.getType() == MovementType.REVENUE ? movement.getContact() : null;
        var supplier = movement.getType() == MovementType.EXPENSE ? movement.getContact() : null;
        return new RecentActivity(
                movement.getId(),
                movement.getType() == MovementType.REVENUE ? "revenue" : "expense",
                movement.getDescription(),
                movement.getAmount(),
                movement.getOccurredOn(),
                movement.getCategory(),
                FinanceLabels.category(movement.getType(), movement.getCategory()),
                customer == null ? null : customer.getId(),
                customer == null ? null : customer.getName(),
                supplier == null ? null : supplier.getId(),
                supplier == null ? null : supplier.getName(),
                movement.getPaymentMethod(),
                FinanceLabels.paymentMethod(movement.getPaymentMethod()),
                false,
                "none",
                "Lançamento simples",
                movement.getSourceCommitmentId(),
                movement.getNotes(),
                movement.getCreatedAt()
        );
    }
}
