CREATE DATABASE blockchain_db;
USE blockchain_db;

DROP TABLE IF EXISTS `event_data`;
CREATE TABLE IF NOT EXISTS `event_data` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `create_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` TIMESTAMP NOT NULL ON UPDATE CURRENT_TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `chain_id` INT UNSIGNED NOT NULL,
    `sender` VARCHAR(42) NOT NULL,
    `event_type` VARCHAR(45) NOT NULL,
    `address` VARCHAR(42) NOT NULL,
    `topic0` VARCHAR(66) NOT NULL,
    `topic1` VARCHAR(66) NOT NULL,
    `topic2` VARCHAR(66) NOT NULL,
    `topic3` VARCHAR(66) NOT NULL,
    `data` TEXT NOT NULL,
    `log_index` INT NOT NULL,
    `tx_hash` VARCHAR(66) NOT NULL,
    `block_number` INT UNSIGNED NOT NULL,
    `timestamp` INT UNSIGNED NOT NULL,
    `tx_index` INT NOT NULL,
    `version` INT NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    INDEX `index_chain_id` (`chain_id` ASC),
    INDEX `index_sender` (`sender` ASC),
    INDEX `index_event_type` (`event_type` ASC),
    INDEX `index_address` (`address` ASC),
    INDEX `index_topic0` (`topic0` ASC),
    INDEX `index_topic1` (`topic1` ASC),
    INDEX `index_topic2` (`topic2` ASC),
    INDEX `index_topic3` (`topic3` ASC),
    INDEX `index_block_number` (`block_number` ASC),
    INDEX `index_version` (`version` ASC),
    UNIQUE INDEX `unique_chain_id_log_index_tx_hash` (`chain_id` ASC, `log_index` ASC, `tx_hash` ASC)
) CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_general_ci;

DROP TABLE IF EXISTS `scan_tasks`;
CREATE TABLE IF NOT EXISTS `scan_tasks` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `create_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` TIMESTAMP NOT NULL ON UPDATE CURRENT_TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `event_type` VARCHAR(45) NOT NULL,
    `chain_id` INT UNSIGNED NOT NULL,
    `address` VARCHAR(42) NOT NULL,
    `from_block` INT UNSIGNED NOT NULL,
    `event_keccak` VARCHAR(200) NOT NULL,
    `proxy_event_type` VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'slice by _',
    `proxy_event_keccak` VARCHAR(500) NOT NULL DEFAULT '' COMMENT 'slice by _',
    `proxy_location` VARCHAR(200) NOT NULL DEFAULT '' COMMENT 'topic1;topic2;topic3;data01234...',
    PRIMARY KEY (`id`),
    INDEX `index_address` (`address` ASC),
    INDEX `index_event_type` (`event_type` ASC),
    INDEX `index_chain_id` (`chain_id` ASC),
    UNIQUE INDEX `uqx_chain_id_address_event_keccak` (`chain_id` asc, `address` asc, `event_keccak` asc)
) CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_general_ci;

INSERT INTO scan_tasks (chain_id, address, from_block, event_type, event_keccak)
VALUES (1, '0x98945BC69A554F8b129b09aC8AfDc2cc2431c48E', 11904517, 'Staked', 'Staked(address,uint256)'),
       (1, '0x98945BC69A554F8b129b09aC8AfDc2cc2431c48E', 11904517, 'UnStaked', 'UnStaked(address,uint256)');

DROP TABLE IF EXISTS `user`;
CREATE TABLE IF NOT EXISTS user (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `create_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` TIMESTAMP NOT NULL ON UPDATE CURRENT_TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `address` VARCHAR(42) NOT NULL,
    `total_staked` VARCHAR(255) NOT NULL DEFAULT '0',  
    `total_unstaked` VARCHAR(255) NOT NULL DEFAULT '0',  
    `current_staked` VARCHAR(255) NOT NULL DEFAULT '0',  
    PRIMARY KEY (`id`)
) CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_general_ci;