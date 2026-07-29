const pool = require('../config/db');

// Get all jobs with optional filters
exports.getAllJobs = async (req, res) => {
  try {
    const { sector, contractType, search } = req.query;
    let query = `
      SELECT j.*, u.name as company_name, u.email as company_email, u.phone as company_phone
      FROM jobs j
      JOIN users u ON j.company_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (sector) {
      query += ' AND j.sector = ?';
      params.push(sector);
    }
    if (contractType) {
      query += ' AND j.contract_type = ?';
      params.push(contractType);
    }
    if (search) {
      query += ' AND (j.title LIKE ? OR j.description LIKE ? OR u.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY j.created_at DESC';

    const [rows] = await pool.promise().query(query, params);
    const jobs = rows.map(r => ({
      id: r.id,
      companyId: r.company_id,
      companyName: r.company_name,
      companyEmail: r.company_email,
      title: r.title,
      contractType: r.contract_type,
      location: r.location,
      sector: r.sector,
      description: r.description,
      requirements: r.requirements,
      createdAt: r.created_at
    }));

    res.json(jobs);
  } catch (error) {
    console.error('getAllJobs error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des offres' });
  }
};

// Create a job posting
exports.createJob = async (req, res) => {
  try {
    const { companyId, title, contractType, location, sector, description, requirements } = req.body;
    if (!companyId || !title || !description) {
      return res.status(400).json({ error: 'Champs obligatoires manquants' });
    }

    const [result] = await pool.promise().query(
      `INSERT INTO jobs (company_id, title, contract_type, location, sector, description, requirements)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [companyId, title, contractType || 'CDI', location || 'Dakar, Sénégal', sector || 'Hôtellerie', description, requirements || '']
    );

    res.status(201).json({
      success: true,
      message: 'Offre créée avec succès',
      jobId: result.insertId
    });
  } catch (error) {
    console.error('createJob error:', error);
    res.status(500).json({ error: "Erreur lors de la création de l'offre" });
  }
};

// Apply to a job
exports.applyToJob = async (req, res) => {
  try {
    const { jobId, applicantId, message } = req.body;
    if (!jobId || !applicantId) {
      return res.status(400).json({ error: 'Job ID et Applicant ID requis' });
    }

    const [existing] = await pool.promise().query(
      'SELECT id FROM job_applications WHERE job_id = ? AND applicant_id = ?',
      [jobId, applicantId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Vous avez déjà postulé à cette offre' });
    }

    const [result] = await pool.promise().query(
      'INSERT INTO job_applications (job_id, applicant_id, message) VALUES (?, ?, ?)',
      [jobId, applicantId, message || '']
    );

    res.status(201).json({
      success: true,
      message: 'Candidature envoyée avec succès !',
      applicationId: result.insertId
    });
  } catch (error) {
    console.error('applyToJob error:', error);
    res.status(500).json({ error: "Erreur lors de l'envoi de la candidature" });
  }
};

// Get applications for a candidate or recruiter
exports.getJobApplications = async (req, res) => {
  try {
    const { applicantId, companyId } = req.query;
    let query = `
      SELECT ja.*, j.title as job_title, j.contract_type, u.name as applicant_name, u.email as applicant_email, u.student_job
      FROM job_applications ja
      JOIN jobs j ON ja.job_id = j.id
      JOIN users u ON ja.applicant_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (applicantId) {
      query += ' AND ja.applicant_id = ?';
      params.push(applicantId);
    }
    if (companyId) {
      query += ' AND j.company_id = ?';
      params.push(companyId);
    }

    query += ' ORDER BY ja.created_at DESC';

    const [rows] = await pool.promise().query(query, params);
    const applications = rows.map(r => ({
      id: r.id,
      jobId: r.job_id,
      jobTitle: r.job_title,
      contractType: r.contract_type,
      applicantId: r.applicant_id,
      applicantName: r.applicant_name,
      applicantEmail: r.applicant_email,
      studentJob: r.student_job,
      message: r.message,
      status: r.status,
      createdAt: r.created_at
    }));

    res.json(applications);
  } catch (error) {
    console.error('getJobApplications error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des candidatures' });
  }
};
