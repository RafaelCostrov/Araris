package com.araris.smarthas.organization.repository;

import com.araris.smarthas.organization.domain.Membership;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MembershipRepository extends JpaRepository<Membership, UUID> {

    Optional<Membership> findFirstByUserIdAndStatusOrderByCreatedAt(UUID userId, String status);

    List<Membership> findAllByUserIdAndStatusOrderByCreatedAt(UUID userId, String status);

    boolean existsByOrganizationIdAndUserIdAndStatus(UUID organizationId, UUID userId, String status);
}
