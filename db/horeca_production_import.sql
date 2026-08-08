-- HORECA AFRICA 2026 Database Import File for Hostinger Production
-- Target Database: u208608546_apphoreca

USE u208608546_apphoreca;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(191) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(191) NOT NULL,
  company VARCHAR(191) NOT NULL,
  role ENUM('SuperAdmin', 'Professionnel', 'Exposant', 'Sponsor', 'Hosted Buyer', 'Étudiant') NOT NULL DEFAULT 'Professionnel',
  sector VARCHAR(100) NOT NULL DEFAULT 'Hôtellerie',
  phone VARCHAR(50) DEFAULT NULL,
  student_job VARCHAR(191) DEFAULT NULL,
  cv_attached BOOLEAN DEFAULT FALSE,
  cv_url VARCHAR(255) DEFAULT NULL,
  is_super_admin BOOLEAN DEFAULT FALSE,
  looking_for TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Meetings Table
CREATE TABLE IF NOT EXISTS meetings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  from_user_id INT NOT NULL,
  to_user_id INT NOT NULL,
  day VARCHAR(50) NOT NULL DEFAULT 'Mercredi 25 nov',
  time_slot VARCHAR(50) NOT NULL DEFAULT '09h30',
  status ENUM('PENDING', 'ACCEPTED', 'REFUSED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  table_number INT NOT NULL DEFAULT 1,
  note TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Contacts Table
CREATE TABLE IF NOT EXISTS contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(191) NOT NULL,
  phone VARCHAR(50) DEFAULT NULL,
  company VARCHAR(191) DEFAULT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Jobs Table
CREATE TABLE IF NOT EXISTS jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  title VARCHAR(191) NOT NULL,
  contract_type VARCHAR(50) NOT NULL DEFAULT 'CDI',
  location VARCHAR(191) NOT NULL DEFAULT 'Dakar, Sénégal',
  sector VARCHAR(100) NOT NULL DEFAULT 'Hôtellerie',
  description TEXT NOT NULL,
  requirements TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Job Applications Table
CREATE TABLE IF NOT EXISTS job_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_id INT NOT NULL,
  applicant_id INT NOT NULL,
  message TEXT DEFAULT NULL,
  status ENUM('PENDING', 'SHORTLISTED', 'REJECTED', 'HIRED') NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (applicant_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Messages Table (1-to-1 B2B Chat)
CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  from_user_id INT NOT NULL,
  to_user_id INT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SEED INITIAL DATA
INSERT IGNORE INTO users (id, email, password, name, company, role, sector, phone, student_job, cv_attached, cv_url, is_super_admin, looking_for) VALUES
(999, 'admin@horecafrica.com', '$2b$10$yqgy7FY6AlmGVdNvD4x8eeypw0gtCN5gibpHkBNI3syJfJ/yhl2x2', 'Super Admin', 'HORECA AFRICA ORGANISATEUR', 'SuperAdmin', 'Institutions', '+221 77 542 82 35', NULL, FALSE, NULL, TRUE, '[]'),
(1, 'novotel@dakar.com', '$2b$10$TdzL1LoUrkQoeFboMrrkcObQNcDuDoFUcbkBlPBbewvNEhqELNPF2', 'Jean Dupont', 'NOVOTEL DAKAR', 'Professionnel', 'Hôtellerie', '+221 33 889 00 00', NULL, FALSE, NULL, FALSE, '["DMC", "Agences de voyages", "Équipementiers"]'),
(2, 'odyssee@restaurant.sn', '$2b$10$TdzL1LoUrkQoeFboMrrkcObQNcDuDoFUcbkBlPBbewvNEhqELNPF2', 'Awa Ndiaye', 'Restaurant Odyssée', 'Exposant', 'Restauration', '+221 77 123 45 67', NULL, FALSE, NULL, FALSE, '["Hôtels", "Banques"]'),
(3, 'orange@business.ci', '$2b$10$TdzL1LoUrkQoeFboMrrkcObQNcDuDoFUcbkBlPBbewvNEhqELNPF2', 'Marc Kouassi', 'Orange Business', 'Sponsor', 'Institutions', '+225 07 00 00 00', NULL, FALSE, NULL, FALSE, '["Hôtels", "Restaurants", "Investisseurs"]'),
(4, 'apix@gouv.sn', '$2b$10$TdzL1LoUrkQoeFboMrrkcObQNcDuDoFUcbkBlPBbewvNEhqELNPF2', 'Fatou Sow', 'APIX Sénégal', 'Hosted Buyer', 'Institutions', '+221 33 849 05 55', NULL, FALSE, NULL, FALSE, '["Investisseurs", "DMC"]'),
(5, 'aissatou@etudiant.sn', '$2b$10$TdzL1LoUrkQoeFboMrrkcObQNcDuDoFUcbkBlPBbewvNEhqELNPF2', 'Aïssatou Diallo', 'École Supérieure Hôtelière', 'Étudiant', 'Hôtellerie', '+221 77 987 65 43', 'Assistant Manager Restauration', TRUE, NULL, FALSE, '["Hôtels", "Restaurants"]'),
(6, 'moussa@candidat.sn', '$2b$10$TdzL1LoUrkQoeFboMrrkcObQNcDuDoFUcbkBlPBbewvNEhqELNPF2', 'Moussa Kane', 'Université Cheikh Anta Diop', 'Étudiant', 'Restauration', '+221 76 543 21 09', 'Chef de Rang / Sommelier', TRUE, NULL, FALSE, '["Restaurants", "Hôtels"]');

INSERT IGNORE INTO meetings (id, from_user_id, to_user_id, day, time_slot, status, table_number, note) VALUES
(301, 1, 2, 'Mercredi 25 nov', '09h30', 'ACCEPTED', 5, 'Discussion partenariats B2B'),
(302, 5, 1, 'Mercredi 25 nov', '14h00', 'PENDING', 15, 'Candidature Stage/Emploi Assistant Manager');

INSERT IGNORE INTO jobs (id, company_id, title, contract_type, location, sector, description, requirements) VALUES
(1, 1, 'Assistant Manager Restauration H/F', 'CDI', 'Novotel Dakar, Sénégal', 'Hôtellerie', 'Supervision des opérations quotidiennes du restaurant et bar de l’hôtel. Encadrement des équipes de salle et garantie des standards de service Accor.', 'Diplôme en Hôtellerie/Restauration, 2 ans d’expérience requis.'),
(2, 1, 'Chef de Rang / Sommelier', 'CDD', 'Novotel Dakar, Sénégal', 'Hôtellerie', 'Service à table haut de gamme et conseils en sommellerie pour la clientèle internationale.', 'Excellente présentation, maîtrise du français et de l’anglais.'),
(3, 2, 'Stagiaire Assistant Gestion Hôtelière', 'Stage', 'Dakar, Sénégal', 'Restauration', 'Appui à la gestion opérationnelle et au suivi des commandes fournisseurs.', 'Formation BAC+3 en cours, motivation et rigueur.');

INSERT IGNORE INTO job_applications (id, job_id, applicant_id, message, status) VALUES
(1, 1, 5, 'Trés intéressée par ce poste d’Assistant Manager Restauration au Novotel !', 'SHORTLISTED'),
(2, 2, 6, 'Fort de mon expérience en restauration, je souhaite vous apporter mes compétences de Chef de Rang.', 'PENDING');
