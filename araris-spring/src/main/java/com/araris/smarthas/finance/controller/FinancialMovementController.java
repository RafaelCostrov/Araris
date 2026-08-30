package com.araris.smarthas.finance.controller;

import com.araris.smarthas.finance.domain.MovementType;
import com.araris.smarthas.finance.dto.FinanceSummaryResponse;
import com.araris.smarthas.finance.dto.MovementCreateRequest;
import com.araris.smarthas.finance.dto.MovementResponse;
import com.araris.smarthas.finance.dto.MovementUpdateRequest;
import com.araris.smarthas.finance.service.FinanceSummaryService;
import com.araris.smarthas.finance.service.FinancialMovementService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/finance")
@Tag(name = "Financeiro", description = "CRUD de entradas e saídas e resumo mensal")
public class FinancialMovementController {

    private final FinancialMovementService movementService;
    private final FinanceSummaryService summaryService;

    public FinancialMovementController(
            FinancialMovementService movementService,
            FinanceSummaryService summaryService
    ) {
        this.movementService = movementService;
        this.summaryService = summaryService;
    }

    @GetMapping("/revenues/")
    @Operation(summary = "Lista entradas da empresa")
    List<MovementResponse> revenues(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam("organization_id") UUID organizationId,
            @RequestParam(required = false) String month
    ) {
        return movementService.list(userId(jwt), organizationId, MovementType.REVENUE, month);
    }

    @PostMapping("/revenues/")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Cria uma entrada")
    MovementResponse createRevenue(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody MovementCreateRequest request) {
        return movementService.create(userId(jwt), MovementType.REVENUE, request);
    }

    @PatchMapping("/revenues/{id}/")
    @Operation(summary = "Atualiza uma entrada")
    MovementResponse updateRevenue(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody MovementUpdateRequest request
    ) {
        return movementService.update(userId(jwt), id, MovementType.REVENUE, request);
    }

    @DeleteMapping("/revenues/{id}/")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Remove uma entrada")
    void deleteRevenue(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        movementService.delete(userId(jwt), id, MovementType.REVENUE);
    }

    @GetMapping("/expenses/")
    @Operation(summary = "Lista saídas da empresa")
    List<MovementResponse> expenses(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam("organization_id") UUID organizationId,
            @RequestParam(required = false) String month
    ) {
        return movementService.list(userId(jwt), organizationId, MovementType.EXPENSE, month);
    }

    @PostMapping("/expenses/")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Cria uma saída")
    MovementResponse createExpense(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody MovementCreateRequest request) {
        return movementService.create(userId(jwt), MovementType.EXPENSE, request);
    }

    @PatchMapping("/expenses/{id}/")
    @Operation(summary = "Atualiza uma saída")
    MovementResponse updateExpense(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody MovementUpdateRequest request
    ) {
        return movementService.update(userId(jwt), id, MovementType.EXPENSE, request);
    }

    @DeleteMapping("/expenses/{id}/")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Remove uma saída")
    void deleteExpense(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        movementService.delete(userId(jwt), id, MovementType.EXPENSE);
    }

    @GetMapping("/summary/")
    @Operation(summary = "Calcula o resumo financeiro mensal")
    FinanceSummaryResponse summary(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam("organization_id") UUID organizationId,
            @RequestParam(required = false) String month
    ) {
        return summaryService.summarize(userId(jwt), organizationId, month);
    }

    private UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
