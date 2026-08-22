-- CreateTable
CREATE TABLE `Company` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `code` CHAR(2) NOT NULL,
    `logoUrl` VARCHAR(255) NULL,
    `pfRateEmployee` DECIMAL(5, 2) NOT NULL DEFAULT 12.00,
    `pfRateEmployer` DECIMAL(5, 2) NOT NULL DEFAULT 12.00,
    `professionalTax` DECIMAL(10, 2) NOT NULL DEFAULT 200.00,
    `workingDaysPerWeek` INTEGER NOT NULL DEFAULT 5,
    `standardDayMinutes` INTEGER NOT NULL DEFAULT 480,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Company_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LoginIdSequence` (
    `companyId` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `lastSerial` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`companyId`, `year`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `loginId` VARCHAR(20) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `role` ENUM('ADMIN', 'EMPLOYEE') NOT NULL DEFAULT 'EMPLOYEE',
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT true,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `firstName` VARCHAR(80) NOT NULL,
    `lastName` VARCHAR(80) NOT NULL,
    `mobile` VARCHAR(20) NULL,
    `avatarUrl` VARCHAR(255) NULL,
    `jobPosition` VARCHAR(100) NULL,
    `department` VARCHAR(100) NULL,
    `location` VARCHAR(100) NULL,
    `managerId` INTEGER NULL,
    `dateOfJoining` DATE NOT NULL,
    `joiningYear` INTEGER NOT NULL,
    `joiningSerial` INTEGER NOT NULL,
    `dateOfBirth` DATE NULL,
    `nationality` VARCHAR(60) NULL,
    `gender` ENUM('MALE', 'FEMALE', 'OTHER') NULL,
    `maritalStatus` ENUM('SINGLE', 'MARRIED', 'OTHER') NULL,
    `personalEmail` VARCHAR(150) NULL,
    `residingAddress` TEXT NULL,
    `accountNumber` VARCHAR(50) NULL,
    `bankName` VARCHAR(100) NULL,
    `ifscCode` VARCHAR(20) NULL,
    `panNo` VARCHAR(20) NULL,
    `uanNo` VARCHAR(30) NULL,
    `empCode` VARCHAR(30) NULL,
    `about` TEXT NULL,
    `whatILoveAboutJob` TEXT NULL,
    `interestsAndHobbies` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_loginId_key`(`loginId`),
    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_companyId_idx`(`companyId`),
    INDEX `User_companyId_role_idx`(`companyId`, `role`),
    INDEX `User_managerId_idx`(`managerId`),
    UNIQUE INDEX `User_companyId_joiningYear_joiningSerial_key`(`companyId`, `joiningYear`, `joiningSerial`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Skill` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `name` VARCHAR(80) NOT NULL,

    INDEX `Skill_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Certification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `issuer` VARCHAR(120) NULL,
    `year` INTEGER NULL,

    INDEX `Certification_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SalaryStructure` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `wageType` ENUM('FIXED') NOT NULL DEFAULT 'FIXED',
    `monthlyWage` DECIMAL(12, 2) NOT NULL,
    `workingDaysPerWeek` INTEGER NOT NULL DEFAULT 5,
    `breakMinutes` INTEGER NOT NULL DEFAULT 60,
    `effectiveFrom` DATE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SalaryStructure_userId_key`(`userId`),
    INDEX `SalaryStructure_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SalaryComponent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `salaryStructureId` INTEGER NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `computationType` ENUM('PERCENT', 'FIXED', 'REMAINDER') NOT NULL,
    `basis` ENUM('WAGE', 'BASIC') NULL,
    `value` DECIMAL(12, 4) NOT NULL DEFAULT 0,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `SalaryComponent_salaryStructureId_idx`(`salaryStructureId`),
    UNIQUE INDEX `SalaryComponent_salaryStructureId_name_key`(`salaryStructureId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Attendance` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `checkIn` DATETIME(3) NULL,
    `checkOut` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Attendance_userId_date_idx`(`userId`, `date`),
    INDEX `Attendance_date_idx`(`date`),
    UNIQUE INDEX `Attendance_userId_date_key`(`userId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeaveType` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `name` VARCHAR(60) NOT NULL,
    `isPaid` BOOLEAN NOT NULL DEFAULT true,
    `requiresAttachment` BOOLEAN NOT NULL DEFAULT false,

    INDEX `LeaveType_companyId_idx`(`companyId`),
    UNIQUE INDEX `LeaveType_companyId_name_key`(`companyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeaveAllocation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `leaveTypeId` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `allocatedDays` DECIMAL(5, 2) NOT NULL,

    INDEX `LeaveAllocation_userId_idx`(`userId`),
    INDEX `LeaveAllocation_leaveTypeId_idx`(`leaveTypeId`),
    UNIQUE INDEX `LeaveAllocation_userId_leaveTypeId_year_key`(`userId`, `leaveTypeId`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeaveRequest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `leaveTypeId` INTEGER NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `days` DECIMAL(5, 2) NOT NULL,
    `remarks` TEXT NULL,
    `attachmentUrl` VARCHAR(255) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `reviewedById` INTEGER NULL,
    `reviewComment` TEXT NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LeaveRequest_userId_status_idx`(`userId`, `status`),
    INDEX `LeaveRequest_leaveTypeId_idx`(`leaveTypeId`),
    INDEX `LeaveRequest_startDate_endDate_idx`(`startDate`, `endDate`),
    INDEX `LeaveRequest_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LoginIdSequence` ADD CONSTRAINT `LoginIdSequence_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_managerId_fkey` FOREIGN KEY (`managerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Skill` ADD CONSTRAINT `Skill_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Certification` ADD CONSTRAINT `Certification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalaryStructure` ADD CONSTRAINT `SalaryStructure_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalaryComponent` ADD CONSTRAINT `SalaryComponent_salaryStructureId_fkey` FOREIGN KEY (`salaryStructureId`) REFERENCES `SalaryStructure`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attendance` ADD CONSTRAINT `Attendance_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaveType` ADD CONSTRAINT `LeaveType_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaveAllocation` ADD CONSTRAINT `LeaveAllocation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaveAllocation` ADD CONSTRAINT `LeaveAllocation_leaveTypeId_fkey` FOREIGN KEY (`leaveTypeId`) REFERENCES `LeaveType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaveRequest` ADD CONSTRAINT `LeaveRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaveRequest` ADD CONSTRAINT `LeaveRequest_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaveRequest` ADD CONSTRAINT `LeaveRequest_leaveTypeId_fkey` FOREIGN KEY (`leaveTypeId`) REFERENCES `LeaveType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
