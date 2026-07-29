USE horeca_db;

-- Clear old seed data safely
DELETE FROM meetings;
DELETE FROM users;

-- Seed Users
INSERT INTO users (id, email, password, name, company, role, sector, phone, student_job, cv_attached, cv_url, is_super_admin, looking_for) VALUES
(999, 'admin@horecafrica.com', '$2b$10$yqgy7FY6AlmGVdNvD4x8eeypw0gtCN5gibpHkBNI3syJfJ/yhl2x2', 'Super Admin', 'HORECA AFRICA ORGANISATEUR', 'SuperAdmin', 'Institutions', '+221 77 542 82 35', NULL, FALSE, NULL, TRUE, '[]'),
(1, 'novotel@dakar.com', '$2b$10$TdzL1LoUrkQoeFboMrrkcObQNcDuDoFUcbkBlPBbewvNEhqELNPF2', 'Jean Dupont', 'NOVOTEL DAKAR', 'Professionnel', 'Hôtellerie', '+221 33 889 00 00', NULL, FALSE, NULL, FALSE, '["DMC", "Agences de voyages", "Équipementiers"]'),
(2, 'odyssee@restaurant.sn', '$2b$10$TdzL1LoUrkQoeFboMrrkcObQNcDuDoFUcbkBlPBbewvNEhqELNPF2', 'Awa Ndiaye', 'Restaurant Odyssée', 'Exposant', 'Restauration', '+221 77 123 45 67', NULL, FALSE, NULL, FALSE, '["Hôtels", "Banques"]'),
(3, 'orange@business.ci', '$2b$10$TdzL1LoUrkQoeFboMrrkcObQNcDuDoFUcbkBlPBbewvNEhqELNPF2', 'Marc Kouassi', 'Orange Business', 'Sponsor', 'Institutions', '+225 07 00 00 00', NULL, FALSE, NULL, FALSE, '["Hôtels", "Restaurants", "Investisseurs"]'),
(4, 'apix@gouv.sn', '$2b$10$TdzL1LoUrkQoeFboMrrkcObQNcDuDoFUcbkBlPBbewvNEhqELNPF2', 'Fatou Sow', 'APIX Sénégal', 'Hosted Buyer', 'Institutions', '+221 33 849 05 55', NULL, FALSE, NULL, FALSE, '["Investisseurs", "DMC"]'),
(5, 'aissatou@etudiant.sn', '$2b$10$TdzL1LoUrkQoeFboMrrkcObQNcDuDoFUcbkBlPBbewvNEhqELNPF2', 'Aïssatou Diallo', 'École Supérieure Hôtelière', 'Étudiant', 'Hôtellerie', '+221 77 987 65 43', 'Assistant Manager Restauration', TRUE, NULL, FALSE, '["Hôtels", "Restaurants"]'),
(6, 'moussa@candidat.sn', '$2b$10$TdzL1LoUrkQoeFboMrrkcObQNcDuDoFUcbkBlPBbewvNEhqELNPF2', 'Moussa Kane', 'Université Cheikh Anta Diop', 'Étudiant', 'Restauration', '+221 76 543 21 09', 'Chef de Rang / Sommelier', TRUE, NULL, FALSE, '["Restaurants", "Hôtels"]');

-- Seed Meetings
INSERT INTO meetings (id, from_user_id, to_user_id, day, time_slot, status, table_number, note) VALUES
(301, 1, 2, 'Mercredi 25 nov', '09h30', 'ACCEPTED', 5, 'Discussion partenariats B2B'),
(302, 5, 1, 'Mercredi 25 nov', '14h00', 'PENDING', 15, 'Candidature Stage/Emploi Assistant Manager');

-- Clear old jobs seed data
DELETE FROM job_applications;
DELETE FROM jobs;

-- Seed Jobs
INSERT INTO jobs (id, company_id, title, contract_type, location, sector, description, requirements) VALUES
(1, 1, 'Assistant Manager Restauration H/F', 'CDI', 'Novotel Dakar, Sénégal', 'Hôtellerie', 'Supervision des opérations quotidiennes du restaurant et bar de l’hôtel. Encadrement des équipes de salle et garantie des standards de service Accor.', 'Diplôme en Hôtellerie/Restauration, 2 ans d’expérience requis.'),
(2, 1, 'Chef de Rang / Sommelier', 'CDD', 'Novotel Dakar, Sénégal', 'Hôtellerie', 'Service à table haut de gamme et conseils en sommellerie pour la clientèle internationale.', 'Excellente présentation, maîtrise du français et de l’anglais.'),
(3, 2, 'Stagiaire Assistant Gestion Hôtelière', 'Stage', 'Dakar, Sénégal', 'Restauration', 'Appui à la gestion opérationnelle et au suivi des commandes fournisseurs.', 'Formation BAC+3 en cours, motivation et rigueur.');

-- Seed Job Applications
INSERT INTO job_applications (id, job_id, applicant_id, message, status) VALUES
(1, 1, 5, 'Trés intéressée par ce poste d’Assistant Manager Restauration au Novotel !', 'SHORTLISTED'),
(2, 2, 6, 'Fort de mon expérience en restauration, je souhaite vous apporter mes compétences de Chef de Rang.', 'PENDING');

