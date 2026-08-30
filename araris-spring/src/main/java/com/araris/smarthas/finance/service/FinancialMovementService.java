package com.araris.smarthas.finance.service;

import com.araris.smarthas.auth.service.AuthService;
import com.araris.smarthas.common.api.ApiException;
import com.araris.smarthas.finance.domain.BusinessContact;
import com.araris.smarthas.finance.domain.ContactType;
import com.araris.smarthas.finance.domain.Customer;
import com.araris.smarthas.finance.domain.Expense;
import com.araris.smarthas.finance.domain.FinancialMovement;
import com.araris.smarthas.finance.domain.MovementType;
import com.araris.smarthas.finance.domain.Revenue;
import com.araris.smarthas.finance.domain.Supplier;
import com.araris.smarthas.finance.dto.MovementCreateRequest;
import com.araris.smarthas.finance.dto.MovementResponse;
import com.araris.smarthas.finance.dto.MovementUpdateRequest;
import com.araris.smarthas.finance.repository.ExpenseRepository;
import com.araris.smarthas.finance.repository.RevenueRepository;
import com.araris.smarthas.organization.service.OrganizationService;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FinancialMovementService {

    private final RevenueRepository revenueRepository;
    private final ExpenseRepository expenseRepository;
    private final OrganizationService organizationService;
    private final AuthService authService;
    private final BusinessContactService contactService;

    public FinancialMovementService(
            RevenueRepository revenueRepository,
            ExpenseRepository expenseRepository,
            OrganizationService organizationService,
            AuthService authService,
            BusinessContactService contactService
    ) {
        this.revenueRepository = revenueRepository;
        this.expenseRepository = expenseRepository;
        this.organizationService = organizationService;
        this.authService = authService;
        this.contactService = contactService;
    }

    @Transactional(readOnly = true)
    public List<MovementResponse> list(UUID userId, UUID organizationId, MovementType type, String month) {
        organizationService.requireOwned(organizationId, userId);
        List<? extends FinancialMovement> movements;
        if (month == null || month.isBlank()) {
            movements = type == MovementType.REVENUE
                    ? revenueRepository.findAllByOrganizationIdOrderByOccurredOnDescCreatedAtDesc(organizationId)
                    : expenseRepository.findAllByOrganizationIdOrderByOccurredOnDescCreatedAtDesc(organizationId);
        } else {
            movements = findForMonth(organizationId, type, parseMonth(month));
        }
        return movements.stream().map(MovementResponse::from).toList();
    }

    @Transactional
    public MovementResponse create(UUID userId, MovementType type, MovementCreateRequest request) {
        validate(type, request.occurredOn(), request.category(), request.paymentMethod());
        var organization = organizationService.requireOwned(request.organizationId(), userId);
        var user = authService.requireUser(userId);
        var contact = resolveContact(
                userId,
                request.organizationId(),
                type,
                request.customerId(),
                request.supplierId()
        );
        FinancialMovement movement;
        if (type == MovementType.REVENUE) {
            movement = revenueRepository.save(new Revenue(organization, user, (Customer) contact, request));
        } else {
            movement = expenseRepository.save(new Expense(organization, user, (Supplier) contact, request));
        }
        return MovementResponse.from(movement);
    }

    @Transactional
    public MovementResponse update(UUID userId, UUID movementId, MovementType type, MovementUpdateRequest request) {
        var movement = requireOwned(userId, movementId, type);
        var occurredOn = request.occurredOn() == null ? movement.getOccurredOn() : request.occurredOn();
        var category = request.category() == null ? movement.getCategory() : request.category();
        var paymentMethod = request.paymentMethod() == null ? movement.getPaymentMethod() : request.paymentMethod();
        validate(type, occurredOn, category, paymentMethod);
        if (request.customerId() != null || request.supplierId() != null) {
            var contact = resolveContact(
                    userId,
                    movement.getOrganization().getId(),
                    type,
                    request.customerId(),
                    request.supplierId()
            );
            movement.setContact(contact);
        }
        movement.update(request);
        return MovementResponse.from(movement);
    }

    @Transactional
    public void delete(UUID userId, UUID movementId, MovementType type) {
        var movement = requireOwned(userId, movementId, type);
        if (type == MovementType.REVENUE) {
            revenueRepository.delete((Revenue) movement);
        } else {
            expenseRepository.delete((Expense) movement);
        }
    }

    @Transactional(readOnly = true)
    public List<FinancialMovement> allBefore(UUID userId, UUID organizationId, LocalDate end) {
        organizationService.requireOwned(organizationId, userId);
        var movements = new ArrayList<FinancialMovement>();
        movements.addAll(revenueRepository
                .findAllByOrganizationIdAndOccurredOnLessThanOrderByOccurredOnDescCreatedAtDesc(organizationId, end));
        movements.addAll(expenseRepository
                .findAllByOrganizationIdAndOccurredOnLessThanOrderByOccurredOnDescCreatedAtDesc(organizationId, end));
        return movements;
    }

    public YearMonth parseMonth(String month) {
        try {
            return month == null || month.isBlank() ? YearMonth.now() : YearMonth.parse(month);
        } catch (DateTimeParseException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Mês inválido. Use o formato AAAA-MM.");
        }
    }

    private List<? extends FinancialMovement> findForMonth(UUID organizationId, MovementType type, YearMonth month) {
        var start = month.atDay(1);
        var end = month.plusMonths(1).atDay(1);
        return type == MovementType.REVENUE
                ? revenueRepository
                        .findAllByOrganizationIdAndOccurredOnGreaterThanEqualAndOccurredOnLessThanOrderByOccurredOnDescCreatedAtDesc(
                                organizationId, start, end)
                : expenseRepository
                        .findAllByOrganizationIdAndOccurredOnGreaterThanEqualAndOccurredOnLessThanOrderByOccurredOnDescCreatedAtDesc(
                                organizationId, start, end);
    }

    private FinancialMovement requireOwned(UUID userId, UUID movementId, MovementType type) {
        FinancialMovement movement = type == MovementType.REVENUE
                ? revenueRepository.findById(movementId).orElseThrow(this::movementNotFound)
                : expenseRepository.findById(movementId).orElseThrow(this::movementNotFound);
        organizationService.requireOwned(movement.getOrganization().getId(), userId);
        return movement;
    }

    private ApiException movementNotFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "Lançamento financeiro não encontrado.");
    }

    private BusinessContact resolveContact(
            UUID userId,
            UUID organizationId,
            MovementType type,
            UUID customerId,
            UUID supplierId
    ) {
        if (type == MovementType.REVENUE) {
            if (supplierId != null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Uma entrada só pode ser vinculada a um cliente.");
            }
            return contactService.requireActive(userId, organizationId, customerId, ContactType.CUSTOMER);
        }
        if (customerId != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Uma saída só pode ser vinculada a um fornecedor.");
        }
        return contactService.requireActive(userId, organizationId, supplierId, ContactType.SUPPLIER);
    }

    private void validate(MovementType type, LocalDate occurredOn, String category, String rawPaymentMethod) {
        if (occurredOn.isAfter(LocalDate.now())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "A data do lançamento não pode estar no futuro.");
        }
        var normalizedCategory = category.trim();
        if (!FinanceLabels.categoryExists(type, normalizedCategory)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Categoria inválida para este tipo de lançamento.");
        }
        var paymentMethod = rawPaymentMethod == null ? "" : rawPaymentMethod.trim();
        if (!FinanceLabels.paymentMethodExists(paymentMethod)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Forma de pagamento inválida.");
        }
    }
}
