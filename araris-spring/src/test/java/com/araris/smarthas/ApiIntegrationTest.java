package com.araris.smarthas;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ApiIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void protectedEndpointRejectsAnonymousRequest() throws Exception {
        mockMvc.perform(get("/api/accounts/me/"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Autenticação necessária ou token inválido."));
    }

    @Test
    void thymeleafLandingPageAndOpenApiArePublic() throws Exception {
        mockMvc.perform(get("/"))
                .andExpect(status().isOk());

        MvcResult openApi = mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.info.title").value("Araris Smart HAS — API Spring Boot"))
                .andExpect(jsonPath("$.paths['/api/accounts/login/'].post").exists())
                .andReturn();

        Map<String, Object> paths = JsonPath.read(openApi.getResponse().getContentAsString(), "$.paths");
        paths.keySet().stream()
                .filter(path -> path.startsWith("/api/") && path.endsWith("/"))
                .forEach(path -> assertThat(paths).doesNotContainKey(path.substring(0, path.length() - 1)));
    }

    @Test
    void registerLoginRefreshAndProfileFlowWorks() throws Exception {
        Session session = register("owner@araris.local", "12345678000195", "250.00");

        mockMvc.perform(get("/api/accounts/me/")
                        .header("Authorization", bearer(session.access())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.email").value("owner@araris.local"))
                .andExpect(jsonPath("$.memberships[0].role").value("owner"))
                .andExpect(jsonPath("$.memberships[0].organization.id").value(session.organizationId()));

        mockMvc.perform(patch("/api/accounts/me/")
                        .header("Authorization", bearer(session.access()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"  Rafael   Costrov  ","phone":"(11) 98888-7777"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.name").value("Rafael Costrov"))
                .andExpect(jsonPath("$.user.phone").value("11988887777"));

        MvcResult refreshed = mockMvc.perform(post("/api/accounts/token/refresh/")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refresh\":\"%s\"}".formatted(session.refresh())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.access").isNotEmpty())
                .andExpect(jsonPath("$.refresh").isNotEmpty())
                .andReturn();

        String rotatedRefresh = JsonPath.read(refreshed.getResponse().getContentAsString(), "$.refresh");
        mockMvc.perform(post("/api/accounts/token/refresh/")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refresh\":\"%s\"}".formatted(session.refresh())))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/accounts/token/refresh/")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refresh\":\"%s\"}".formatted(rotatedRefresh)))
                .andExpect(status().isOk());
    }

    @Test
    void duplicateEmailAndPasswordMismatchAreValidated() throws Exception {
        register("duplicate@araris.local", "22345678000190", "0.00");

        mockMvc.perform(post("/api/accounts/register/")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registrationJson("duplicate@araris.local", "32345678000194", "0.00")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Já existe um usuário com este e-mail."));

        String mismatch = registrationJson("new@araris.local", "42345678000199", "0.00")
                .replace("\"password_confirm\":\"Senha@123\"", "\"password_confirm\":\"OutraSenha@123\"");
        mockMvc.perform(post("/api/accounts/register/")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mismatch))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("As senhas não conferem."));
    }

    @Test
    void authenticatedUserCanPerformFinancialCrudAndReadSummary() throws Exception {
        Session session = register("finance@araris.local", "52345678000193", "250.00");
        String today = LocalDate.now().toString();
        String month = YearMonth.now().toString();

        MvcResult revenue = mockMvc.perform(post("/api/finance/revenues/")
                        .header("Authorization", bearer(session.access()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(movementJson(session.organizationId(), "Venda à vista", "100.00", today, "sales", "pix")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.category_label").value("Vendas"))
                .andReturn();
        String revenueId = JsonPath.read(revenue.getResponse().getContentAsString(), "$.id");

        MvcResult expense = mockMvc.perform(post("/api/finance/expenses/")
                        .header("Authorization", bearer(session.access()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(movementJson(session.organizationId(), "Compra de material", "40.00", today, "supplies", "pix")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.category_label").value("Materiais e insumos"))
                .andReturn();
        String expenseId = JsonPath.read(expense.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(get("/api/finance/summary/")
                        .header("Authorization", bearer(session.access()))
                        .param("organization_id", session.organizationId())
                        .param("month", month))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totals.revenue").value(100.0))
                .andExpect(jsonPath("$.totals.expense").value(40.0))
                .andExpect(jsonPath("$.totals.closing_balance").value(310.0))
                .andExpect(jsonPath("$.recent_activity.length()").value(2));

        mockMvc.perform(patch("/api/finance/revenues/{id}/", revenueId)
                        .header("Authorization", bearer(session.access()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":\"120.00\",\"notes\":\"Valor corrigido\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amount").value(120.0));

        mockMvc.perform(get("/api/finance/revenues/")
                        .header("Authorization", bearer(session.access()))
                        .param("organization_id", session.organizationId())
                        .param("month", month))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(revenueId));

        mockMvc.perform(delete("/api/finance/expenses/{id}/", expenseId)
                        .header("Authorization", bearer(session.access())))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/finance/summary/")
                        .header("Authorization", bearer(session.access()))
                        .param("organization_id", session.organizationId())
                        .param("month", month))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totals.revenue").value(120.0))
                .andExpect(jsonPath("$.totals.expense").value(0.0))
                .andExpect(jsonPath("$.totals.closing_balance").value(370.0));
    }

    @Test
    void customerCrudCanBeUsedByRevenueFlow() throws Exception {
        Session session = register("contacts@araris.local", "82345678000197", "0.00");

        MvcResult created = mockMvc.perform(post("/api/finance/customers/")
                        .header("Authorization", bearer(session.access()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "organization_id":"%s",
                                  "name":"Cliente Exemplo",
                                  "document":"123.456.789-01",
                                  "email":"cliente@example.com",
                                  "phone":"11999998888"
                                }
                                """.formatted(session.organizationId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.document").value("12345678901"))
                .andReturn();
        String customerId = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(patch("/api/finance/customers/{id}/", customerId)
                        .header("Authorization", bearer(session.access()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Cliente Atualizado\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Cliente Atualizado"));

        String revenue = movementJson(
                session.organizationId(),
                "Serviço prestado",
                "150.00",
                LocalDate.now().toString(),
                "services",
                "pix"
        ).replace("\"notes\":\"Lançamento de teste\"", "\"customer_id\":\"%s\",\"notes\":\"Lançamento de teste\"".formatted(customerId));
        mockMvc.perform(post("/api/finance/revenues/")
                        .header("Authorization", bearer(session.access()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(revenue))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.customer_id").value(customerId))
                .andExpect(jsonPath("$.customer_name").value("Cliente Atualizado"));

        mockMvc.perform(delete("/api/finance/customers/{id}/", customerId)
                        .header("Authorization", bearer(session.access())))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/finance/customers/")
                        .header("Authorization", bearer(session.access()))
                        .param("organization_id", session.organizationId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].is_active").value(false));
    }

    @Test
    void dataFromAnotherOrganizationIsNotExposed() throws Exception {
        Session first = register("first@araris.local", "62345678000198", "0.00");
        Session second = register("second@araris.local", "72345678000192", "0.00");

        mockMvc.perform(get("/api/finance/summary/")
                        .header("Authorization", bearer(second.access()))
                        .param("organization_id", first.organizationId()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Empresa não encontrada para este usuário."));
    }

    private Session register(String email, String cnpj, String initialBalance) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/accounts/register/")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registrationJson(email, cnpj, initialBalance)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.access").isNotEmpty())
                .andExpect(jsonPath("$.refresh").isNotEmpty())
                .andReturn();
        String body = result.getResponse().getContentAsString();
        return new Session(
                JsonPath.read(body, "$.access"),
                JsonPath.read(body, "$.refresh"),
                JsonPath.read(body, "$.organization.id")
        );
    }

    private String registrationJson(String email, String cnpj, String initialBalance) {
        return """
                {
                  "name":"Rafael Costrov",
                  "email":"%s",
                  "password":"Senha@123",
                  "password_confirm":"Senha@123",
                  "phone":"11999999999",
                  "lgpd_consent_given":true,
                  "organization":{
                    "business_name":"Araris Serviços Ltda",
                    "trade_name":"Araris",
                    "cnpj":"%s",
                    "business_category":"service",
                    "postal_code":"01310100",
                    "street":"Avenida Paulista",
                    "number":"1000",
                    "neighborhood":"Bela Vista",
                    "city":"São Paulo",
                    "state":"SP",
                    "initial_balance":"%s"
                  }
                }
                """.formatted(email, cnpj, initialBalance);
    }

    private String movementJson(
            String organizationId,
            String description,
            String amount,
            String occurredOn,
            String category,
            String paymentMethod
    ) {
        return """
                {
                  "organization_id":"%s",
                  "description":"%s",
                  "amount":"%s",
                  "occurred_on":"%s",
                  "category":"%s",
                  "payment_method":"%s",
                  "notes":"Lançamento de teste"
                }
                """.formatted(organizationId, description, amount, occurredOn, category, paymentMethod);
    }

    private String bearer(String access) {
        return "Bearer " + access;
    }

    private record Session(String access, String refresh, String organizationId) {
    }
}
