package com.araris.smarthas.common.api;

import java.time.Instant;
import java.util.Map;

public record ApiErrorResponse(
        String detail,
        int status,
        String path,
        Instant timestamp,
        Map<String, String> errors
) {
}
