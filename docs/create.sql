SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='TRADITIONAL,ALLOW_INVALID_DATES';

DROP SCHEMA IF EXISTS `picc_db` ;
CREATE SCHEMA IF NOT EXISTS `picc_db` DEFAULT CHARACTER SET latin1 COLLATE latin1_swedish_ci ;
USE `picc_db` ;

-- -----------------------------------------------------
-- Table `offenders`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `offenders` ;

CREATE  TABLE IF NOT EXISTS `offenders` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `name` VARCHAR(100) NOT NULL ,
  `bio` TEXT NULL ,
  PRIMARY KEY (`id`) )
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `agencies`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `agencies` ;

CREATE  TABLE IF NOT EXISTS `agencies` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `name` VARCHAR(200) NOT NULL ,
  `acronym` VARCHAR(45) NOT NULL ,
  `description` TEXT NULL ,
  `website` VARCHAR(100) NULL ,
  `email` VARCHAR(100) NULL ,
  `phone` BIGINT UNSIGNED NULL ,
  `address` VARCHAR(200) NULL ,
  `logo` VARCHAR(100) NULL ,
  PRIMARY KEY (`id`) ,
  UNIQUE INDEX `acronym_UNIQUE` (`acronym` ASC) )
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `courts`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `courts` ;

CREATE  TABLE IF NOT EXISTS `courts` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `type` VARCHAR(100) NOT NULL ,
  `location` VARCHAR(100) NULL ,
  `state` VARCHAR(45) NOT NULL ,
  `address` VARCHAR(45) NULL ,
  `geocoordinates` VARCHAR(45) NULL ,
  PRIMARY KEY (`id`) )
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `judges`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `judges` ;

CREATE  TABLE IF NOT EXISTS `judges` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `name` VARCHAR(45) NOT NULL ,
  `bio` TEXT NULL ,
  PRIMARY KEY (`id`) )
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `cases`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `cases` ;

CREATE  TABLE IF NOT EXISTS `cases` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `title` VARCHAR(500) NULL ,
  `description` TEXT NULL ,
  `charges` TEXT NOT NULL ,
  `monetary_valuation` BIGINT UNSIGNED NULL ,
  `year` YEAR NOT NULL ,
  `status` TEXT NULL ,
  `tags` VARCHAR(500) NULL ,
  `offender_id` INT UNSIGNED NOT NULL ,
  `agency_id` INT UNSIGNED NOT NULL ,
  `court_id` INT UNSIGNED NOT NULL ,
  `judge_id` INT UNSIGNED NOT NULL ,
  `verdict` TEXT NULL ,
  `amount_recovered` BIGINT UNSIGNED NULL ,
  `charge_number` VARCHAR(45) NOT NULL ,
  `charge_date` DATE NOT NULL ,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ,
  PRIMARY KEY (`id`) ,
  INDEX `fk_cases_offenders_idx` (`offender_id` ASC) ,
  INDEX `fk_cases_agencies1_idx` (`agency_id` ASC) ,
  INDEX `fk_cases_courts1_idx` (`court_id` ASC) ,
  INDEX `fk_cases_judges1_idx` (`judge_id` ASC) ,
  UNIQUE INDEX `charge_number_UNIQUE` (`charge_number` ASC) ,
  CONSTRAINT `fk_cases_offenders`
    FOREIGN KEY (`offender_id` )
    REFERENCES `offenders` (`id` )
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_cases_agencies1`
    FOREIGN KEY (`agency_id` )
    REFERENCES `agencies` (`id` )
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_cases_courts1`
    FOREIGN KEY (`court_id` )
    REFERENCES `courts` (`id` )
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_cases_judges1`
    FOREIGN KEY (`judge_id` )
    REFERENCES `judges` (`id` )
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `trials`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `trials` ;

CREATE  TABLE IF NOT EXISTS `trials` (
  `id` INT UNSIGNED NOT NULL ,
  `case_id` INT UNSIGNED NOT NULL ,
  `trial_date` DATE NOT NULL ,
  `arguments` TEXT NULL ,
  `next_trial_date` DATE NULL ,
  PRIMARY KEY (`id`) ,
  INDEX `fk_trials_cases1_idx` (`case_id` ASC) ,
  CONSTRAINT `fk_trials_cases1`
    FOREIGN KEY (`case_id` )
    REFERENCES `cases` (`id` )
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `recovered_assets`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `recovered_assets` ;

CREATE  TABLE IF NOT EXISTS `recovered_assets` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `case_id` INT UNSIGNED NOT NULL ,
  `name` VARCHAR(45) NULL ,
  `type` VARCHAR(45) NULL ,
  `description` VARCHAR(45) NULL ,
  `valuation` BIGINT NULL ,
  PRIMARY KEY (`id`) ,
  INDEX `fk_recovered_assets_cases1_idx` (`case_id` ASC) ,
  CONSTRAINT `fk_recovered_assets_cases1`
    FOREIGN KEY (`case_id` )
    REFERENCES `cases` (`id` )
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `subscribers`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `subscribers` ;

CREATE  TABLE IF NOT EXISTS `subscribers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `email` VARCHAR(60) NOT NULL ,
  `name` VARCHAR(60) NULL ,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ,
  PRIMARY KEY (`id`) ,
  UNIQUE INDEX `email_UNIQUE` (`email` ASC) )
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `subscriptions`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `subscriptions` ;

CREATE  TABLE IF NOT EXISTS `subscriptions` (
  `id` INT NOT NULL ,
  `case_id` INT UNSIGNED NOT NULL ,
  `subscriber_id` INT UNSIGNED NOT NULL ,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ,
  PRIMARY KEY (`id`) ,
  INDEX `fk_subscriptions_cases1_idx` (`case_id` ASC) ,
  INDEX `fk_subscriptions_subscribers1_idx` (`subscriber_id` ASC) ,
  CONSTRAINT `fk_subscriptions_cases1`
    FOREIGN KEY (`case_id` )
    REFERENCES `cases` (`id` )
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_subscriptions_subscribers1`
    FOREIGN KEY (`subscriber_id` )
    REFERENCES `subscribers` (`id` )
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `users`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `users` ;

CREATE  TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `name` VARCHAR(45) NOT NULL ,
  `email` VARCHAR(45) NOT NULL ,
  `password_hash` VARCHAR(120) NOT NULL ,
  `salt` VARCHAR(120) NOT NULL ,
  `level` TINYINT NOT NULL DEFAULT 0 ,
  `code` BIGINT UNSIGNED NULL ,
  `reset_code` BIGINT UNSIGNED NULL ,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ,
  PRIMARY KEY (`id`) ,
  UNIQUE INDEX `email_UNIQUE` (`email` ASC) )
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `csos`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `csos` ;

CREATE  TABLE IF NOT EXISTS `csos` (
  `id` INT NOT NULL ,
  `name` VARCHAR(60) NOT NULL ,
  `location` VARCHAR(60) NOT NULL ,
  `description` VARCHAR(200) NULL ,
  `email` VARCHAR(45) NULL ,
  `website` VARCHAR(45) NULL ,
  `phone` BIGINT UNSIGNED NULL ,
  PRIMARY KEY (`id`) )
ENGINE = InnoDB;



SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
