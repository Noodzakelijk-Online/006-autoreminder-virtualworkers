CREATE TABLE `ares_configurations` (
  `id` varchar(64) NOT NULL,
  `userId` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `strictnessLevel` enum('lenient', 'moderate', 'strict') NOT NULL DEFAULT 'moderate',
  `confidenceThreshold` int NOT NULL DEFAULT 40,
  `enableVaguenessCheck` boolean NOT NULL DEFAULT true,
  `enableMeasurabilityCheck` boolean NOT NULL DEFAULT true,
  `enableTimelineCheck` boolean NOT NULL DEFAULT true,
  `enableResourceCheck` boolean NOT NULL DEFAULT false,
  `enableDependencyCheck` boolean NOT NULL DEFAULT false,
  `isDefault` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

CREATE TABLE `ares_validation_rules` (
  `id` varchar(64) NOT NULL,
  `configId` varchar(64) NOT NULL,
  `ruleType` enum('vagueness', 'measurability', 'timeline', 'resources', 'dependencies', 'clarity', 'specificity', 'actionability') NOT NULL,
  `ruleName` varchar(255) NOT NULL,
  `description` text,
  `severity` enum('info', 'warning', 'error') NOT NULL DEFAULT 'warning',
  `enabled` boolean NOT NULL DEFAULT true,
  `threshold` int DEFAULT 50,
  `customLogic` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`configId`) REFERENCES `ares_configurations`(`id`)
);

CREATE TABLE `ares_validation_history` (
  `id` varchar(64) NOT NULL,
  `configId` varchar(64) NOT NULL,
  `cardId` varchar(64) NOT NULL,
  `cardName` text NOT NULL,
  `goalDefinition` text,
  `confidenceScore` int NOT NULL,
  `passed` boolean NOT NULL,
  `failedRules` text,
  `warnings` text,
  `validationDetails` text,
  `validatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `validatedBy` int NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`configId`) REFERENCES `ares_configurations`(`id`)
);
