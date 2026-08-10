const pool = require('../config/db');
const bcrypt = require('bcryptjs');

exports.getAllUsers = async (req, res) => {
  try {
    const { role, sector, search } = req.query;
    let query = 'SELECT * FROM users WHERE 1=1';
    const params = [];

    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }
    if (sector) {
      query += ' AND sector = ?';
      params.push(sector);
    }
    if (search) {
      query += ' AND (LOWER(name) LIKE LOWER(?) OR LOWER(company) LIKE LOWER(?) OR LOWER(student_job) LIKE LOWER(?))';
      const searchParam = `%${search.trim()}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    query += ' ORDER BY id ASC';

    const [rows] = await pool.promise().query(query, params);

    const users = rows.map(user => {
      let looking = [];
      try {
        looking = typeof user.looking_for === 'string' ? JSON.parse(user.looking_for) : (user.looking_for || []);
      } catch (e) {
        looking = [];
      }
      return {
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
    });

    res.json(users);
  } catch (error) {
    console.error('getAllUsers error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des participants' });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.promise().query('SELECT * FROM users WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Utilisateur non trouvé' });

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
      cvUrl: user.cv_url,
      isSuperAdmin: !!user.is_super_admin,
      isActive: Boolean(user.is_active === 1 || user.is_super_admin === 1),
      looking: looking
    });
  } catch (error) {
    console.error('getUserById error:', error);
    res.status(500).json({ error: 'Erreur utilisateur' });
  }
};

exports.toggleUserActive = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.promise().query('SELECT * FROM users WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const user = rows[0];
    const newStatus = !user.is_active;

    await pool.promise().query('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, id]);

    res.json({
      success: true,
      isActive: newStatus,
      message: `Statut accès de ${user.name} mis à jour : ${newStatus ? 'ACTIF ✅' : 'EN ATTENTE ⏳'}`
    });
  } catch (error) {
    console.error('toggleUserActive error:', error);
    res.status(500).json({ error: 'Erreur modification statut utilisateur' });
  }
};

exports.submitContact = async (req, res) => {
  try {
    const { cntFirstName, cntLastName, cntEmail, cntPhone, cntCompany, cntMsg } = req.body;
    if (!cntFirstName || !cntEmail || !cntMsg) {
      return res.status(400).json({ error: 'Champs obligatoires manquants' });
    }

    await pool.promise().query(
      'INSERT INTO contacts (first_name, last_name, email, phone, company, message) VALUES (?, ?, ?, ?, ?, ?)',
      [cntFirstName, cntLastName || '', cntEmail, cntPhone || '', cntCompany || '', cntMsg]
    );

    res.json({ success: true, message: 'Message reçu avec succès.' });
  } catch (error) {
    console.error('submitContact error:', error);
    res.status(500).json({ error: 'Erreur lors de l’envoi du message' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, company, sector, phone, studentJob, looking, pass } = req.body;

    let updateFields = [];
    let params = [];

    if (name) { updateFields.push('name = ?'); params.push(name); }
    if (company) { updateFields.push('company = ?'); params.push(company); }
    if (sector) { updateFields.push('sector = ?'); params.push(sector); }
    if (phone !== undefined) { updateFields.push('phone = ?'); params.push(phone); }
    if (studentJob !== undefined) { updateFields.push('student_job = ?'); params.push(studentJob); }
    if (looking) { updateFields.push('looking_for = ?'); params.push(JSON.stringify(looking)); }
    if (pass) { 
      const hashed = await bcrypt.hash(pass, 10);
      updateFields.push('password = ?'); 
      params.push(hashed); 
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
    }

    params.push(id);
    await pool.promise().query(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`, params);

    const [rows] = await pool.promise().query('SELECT * FROM users WHERE id = ?', [id]);
    const user = rows[0];
    let lookingArr = [];
    try {
      lookingArr = typeof user.looking_for === 'string' ? JSON.parse(user.looking_for) : (user.looking_for || []);
    } catch (e) {
      lookingArr = [];
    }

    res.json({
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
        looking: lookingArr
      }
    });
  } catch (error) {
    console.error('updateProfile error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du profil' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.promise().query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true, message: 'Utilisateur supprimé avec succès' });
  } catch (error) {
    console.error('deleteUser error:', error);
    res.status(500).json({ error: 'Erreur suppression utilisateur' });
  }
};
