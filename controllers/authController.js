const pool = require('../config/db');
const bcrypt = require('bcryptjs');

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const [rows] = await pool.promise().query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER(?)',
      [email.trim()]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Cet email n'existe pas encore.", code: 'USER_NOT_FOUND' });
    }

    const user = rows[0];
    
    // Support bcrypt check or legacy plain text matching for old seed users
    let isMatch = false;
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      isMatch = (user.password === password);
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Mot de passe incorrect.' });
    }

    // Parse looking_for if JSON
    let looking = [];
    try {
      looking = typeof user.looking_for === 'string' ? JSON.parse(user.looking_for) : (user.looking_for || []);
    } catch (e) {
      looking = [];
    }

    const userFormatted = {
      id: user.id,
      email: user.email,
      name: user.name,
      company: user.company,
      role: user.role,
      sector: user.sector,
      phone: user.phone,
      studentJob: user.student_job,
      cvAttached: !!user.cv_attached,
      cvUrl: user.cv_url,
      isSuperAdmin: !!user.is_super_admin,
      looking: looking
    };

    res.json({ success: true, user: userFormatted });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
};

exports.register = async (req, res) => {
  try {
    const { email, pass, name, company, role, sector, phone, studentJob, cvAttached, looking } = req.body;
    if (!email || !pass || !name) {
      return res.status(400).json({ error: 'Veuillez remplir tous les champs obligatoires' });
    }

    const [existing] = await pool.promise().query('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Un compte existe déjà avec cet email.' });
    }

    const hashedPassword = await bcrypt.hash(pass, 10);
    const lookingJson = JSON.stringify(looking || []);

    const [result] = await pool.promise().query(
      `INSERT INTO users (email, password, name, company, role, sector, phone, student_job, cv_attached, cv_url, is_super_admin, looking_for)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, FALSE, ?)`,
      [
        email.trim(),
        hashedPassword,
        name,
        company || name,
        role || 'Professionnel',
        sector || 'Hôtellerie',
        phone || '',
        studentJob || '',
        role === 'Étudiant' || !!cvAttached,
        lookingJson
      ]
    );

    const newUser = {
      id: result.insertId,
      email,
      name,
      company: company || name,
      role: role || 'Professionnel',
      sector: sector || 'Hôtellerie',
      phone,
      studentJob,
      cvAttached: role === 'Étudiant' || !!cvAttached,
      cvUrl: null,
      isSuperAdmin: false,
      looking: looking || []
    };

    res.status(201).json({ success: true, user: newUser });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: "Erreur lors de la création de compte" });
  }
};

exports.getDemoUser = async (req, res) => {
  try {
    const { key } = req.params;
    let query = '';
    let param = [];

    if (key === 'superadmin') {
      query = 'SELECT * FROM users WHERE is_super_admin = TRUE LIMIT 1';
    } else if (key === 'novotel') {
      query = 'SELECT * FROM users WHERE id = 1 LIMIT 1';
    } else if (key === 'odyssee') {
      query = 'SELECT * FROM users WHERE id = 2 LIMIT 1';
    } else if (key === 'orange') {
      query = 'SELECT * FROM users WHERE id = 3 LIMIT 1';
    } else if (key === 'apix') {
      query = 'SELECT * FROM users WHERE id = 4 LIMIT 1';
    } else if (key === 'student') {
      query = 'SELECT * FROM users WHERE id = 5 LIMIT 1';
    } else {
      return res.status(404).json({ error: 'Rôle démo inconnu' });
    }

    const [rows] = await pool.promise().query(query, param);
    if (rows.length === 0) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const user = rows[0];
    let looking = [];
    try {
      looking = typeof user.looking_for === 'string' ? JSON.parse(user.looking_for) : (user.looking_for || []);
    } catch (e) {
      looking = [];
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      company: user.company,
      role: user.role,
      sector: user.sector,
      phone: user.phone,
      studentJob: user.student_job,
      cvAttached: !!user.cv_attached,
      isSuperAdmin: !!user.is_super_admin,
      looking: looking
    });
  } catch (error) {
    console.error('getDemoUser error:', error);
    res.status(500).json({ error: 'Erreur démo user' });
  }
};
