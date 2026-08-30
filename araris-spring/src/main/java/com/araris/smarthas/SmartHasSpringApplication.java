package com.araris.smarthas;

import com.araris.smarthas.config.CorsProperties;
import com.araris.smarthas.config.JwtProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties({CorsProperties.class, JwtProperties.class})
public class SmartHasSpringApplication {

    public static void main(String[] args) {
        SpringApplication.run(SmartHasSpringApplication.class, args);
    }
}
