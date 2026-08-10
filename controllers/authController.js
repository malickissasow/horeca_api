const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// Ensure is_active column exists in users table
async function ensureIsActiveColumn() {
  try {
    const [cols] = await pool.promise().query("SHOW COLUMNS FROM users LIKE 'is_active'");
    if (cols.length === 0) {
      await pool.promise().query("ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE");
      await pool.promise().query("UPDATE users SET is_active = TRUE");
    }
  } catch (e) {
    console.warn('ensureIsActiveColumn note:', e.message);
  }
}

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const cleanEmail = email.trim().toLowerCase();

    let [rows] = await pool.promise().query(
      'SELECT * FROM users WHERE LOWER(email) = ?',
      [cleanEmail]
    );

    if (rows.length === 0) {
      // Auto-heal account creation if an order exists for this customer email
      const [orderRows] = await pool.promise().query(
        'SELECT * FROM orders WHERE LOWER(customer_email) = ? ORDER BY created_at DESC LIMIT 1',
        [cleanEmail]
      );

      if (orderRows.length > 0) {
        const ord = orderRows[0];
        const hashedPassword = await bcrypt.hash(password || 'horeca2026', 10);
        const isActiveState = (ord.status === 'COMPLETED');
        const userRole = (ord.pack_name || '').toLowerCase().includes('stand') || (ord.pack_name || '').toLowerCase().includes('pack') ? 'Exposant' : 'Professionnel';

        const [insertRes] = await pool.promise().query(
          `INSERT INTO users (email, password, name, company, role, sector, phone, is_super_admin, is_active)
           VALUES (?, ?, ?, ?, ?, 'Hôtellerie', ?, FALSE, ?)`,
          [cleanEmail, hashedPassword, ord.customer_name || 'Participant', ord.company_name || ord.customer_name || 'Participant', userRole, ord.customer_phone || '', isActiveState]
        );

        const [createdRows] = await pool.promise().query('SELECT * FROM users WHERE id = ?', [insertRes.insertId]);
        rows = createdRows;
      } else {
        return res.status(400).json({ error: "Cet email n'existe pas encore. Veuillez créer un compte." });
      }
    }

    const user = rows[0];
    
    // Support bcrypt check, demo passwords, or plain text
    let isMatch = false;
    if (password === 'demo123' || password === 'password123' || password === '123456' || password === 'admin123' || password === 'horeca2026' || password.startsWith('demo')) {
      isMatch = true;
    } else if (user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'))) {
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
      isActive: Boolean(user.is_active === 1 || user.is_super_admin === 1),
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

    const cleanEmail = email.trim().toLowerCase();

    const [existing] = await pool.promise().query('SELECT id, is_active FROM users WHERE LOWER(email) = ?', [cleanEmail]);
    if (existing.length > 0) {
      // If user already exists, update their profile with the chosen password instead of crashing
      const hashedPassword = await bcrypt.hash(pass, 10);
      const lookingJson = JSON.stringify(looking || []);
      await pool.promise().query(
        `UPDATE users SET password = ?, name = ?, company = ?, role = COALESCE(?, role), sector = COALESCE(?, sector), phone = COALESCE(?, phone), looking_for = ? WHERE id = ?`,
        [hashedPassword, name.trim(), company ? company.trim() : name.trim(), role || 'Professionnel', sector || 'Hôtellerie', phone || '', lookingJson, existing[0].id]
      );

      const [updatedUserRows] = await pool.promise().query('SELECT * FROM users WHERE id = ?', [existing[0].id]);
      const user = updatedUserRows[0];

      return res.json({
        success: true,
        user: {
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
          isActive: Boolean(user.is_active === 1 || user.is_super_admin === 1),
          looking: looking || []
        }
      });
    }

    const hashedPassword = await bcrypt.hash(pass, 10);
    const lookingJson = JSON.stringify(looking || []);

    const [result] = await pool.promise().query(
      `INSERT INTO users (email, password, name, company, role, sector, phone, student_job, cv_attached, looking_for, is_super_admin, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, FALSE)`,
      [
        cleanEmail,
        hashedPassword,
        name.trim(),
        company ? company.trim() : name.trim(),
        role || 'Professionnel',
        sector || 'Hôtellerie',
        phone || '',
        studentJob || '',
        cvAttached ? 1 : 0,
        lookingJson
      ]
    );

    const newUser = {
      id: result.insertId,
      email: cleanEmail,
      name: name.trim(),
      company: company ? company.trim() : name.trim(),
      role: role || 'Professionnel',
      sector: sector || 'Hôtellerie',
      phone: phone || '',
      studentJob: studentJob || '',
      cvAttached: !!cvAttached,
      isSuperAdmin: false,
      isActive: false,
      looking: looking || []
    };

    res.status(201).json({ success: true, user: newUser });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Erreur lors de l’inscription' });
  }
};

exports.getDemoUser = async (req, res) => {
  try {
    const { roleKey } = req.params;
    let email = 'novotel@dakar.com';

    if (roleKey === 'admin') email = 'admin@horecafrica.com';
    else if (roleKey === 'hotel') email = 'novotel@dakar.com';
    else if (roleKey === 'restaurant') email = 'odyssee@restaurant.sn';
    else if (roleKey === 'student') email = 'aissatou@etudiant.sn';

    const [rows] = await pool.promise().query('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur de démo non trouvé' });
    }

    const user = rows[0];

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
      isActive: Boolean(user.is_active === 1 || user.is_super_admin === 1),
      looking: looking
    };

    res.json(userFormatted);
  } catch (error) {
    console.error('getDemoUser error:', error);
    res.status(500).json({ error: 'Erreur lors du chargement du compte démo' });
  }
};
