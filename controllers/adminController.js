const pool = require('../config/db');

exports.getAdminStats = async (req, res) => {
  try {
    const [[{ totalUsers }]] = await pool.promise().query('SELECT COUNT(*) AS totalUsers FROM users WHERE is_super_admin = FALSE');
    const [[{ totalStudents }]] = await pool.promise().query("SELECT COUNT(*) AS totalStudents FROM users WHERE role = 'Étudiant'");
    const [[{ confirmedMeetings }]] = await pool.promise().query("SELECT COUNT(*) AS confirmedMeetings FROM meetings WHERE status = 'ACCEPTED'");
    const [[{ totalMeetings }]] = await pool.promise().query('SELECT COUNT(*) AS totalMeetings FROM meetings');

    res.json({
      totalUsers,
      totalStudents,
      confirmedMeetings,
      totalMeetings
    });
  } catch (error) {
    console.error('getAdminStats error:', error);
    res.status(500).json({ error: 'Erreur statistiques admin' });
  }
};

exports.getAllMeetingsMaster = async (req, res) => {
  try {
    const [rows] = await pool.promise().query(
      `SELECT m.*, 
              uFrom.name AS fromName, uFrom.company AS fromCompany, uFrom.role AS fromRole,
              uTo.name AS toName, uTo.company AS toCompany, uTo.role AS toRole
       FROM meetings m
       JOIN users uFrom ON m.from_user_id = uFrom.id
       JOIN users uTo ON m.to_user_id = uTo.id
       ORDER BY m.id DESC`
    );

    const masterMeetings = rows.map(m => ({
      id: m.id,
      fromId: m.from_user_id,
      toId: m.to_user_id,
      fromName: m.fromName,
      fromCompany: m.fromCompany,
      fromRole: m.fromRole,
      toName: m.toName,
      toCompany: m.toCompany,
      toRole: m.toRole,
      day: m.day,
      time: m.time_slot,
      status: m.status,
      table: m.table_number,
      note: m.note,
      createdAt: m.created_at
    }));

    res.json(masterMeetings);
  } catch (error) {
    console.error('getAllMeetingsMaster error:', error);
    res.status(500).json({ error: 'Erreur liste globale des rendez-vous' });
  }
};

exports.getContacts = async (req, res) => {
  try {
    const [rows] = await pool.promise().query('SELECT * FROM contacts ORDER BY id DESC');
    res.json(rows.map(r => ({
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      email: r.email,
      phone: r.phone,
      company: r.company,
      message: r.message,
      createdAt: r.created_at
    })));
  } catch (error) {
    console.error('getContacts error:', error);
    res.status(500).json({ error: 'Erreur chargement messages de contact' });
  }
};
exports.submitContact = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, company, message } = req.body;
    if (!firstName || !email || !message) {
      return res.status(400).json({ error: 'Prénom, email et message requis' });
    }

    await pool.promise().query(
      'INSERT INTO contacts (first_name, last_name, email, phone, company, message) VALUES (?, ?, ?, ?, ?, ?)',
      [firstName, lastName || '', email.trim(), phone || '', company || '', message]
    );

    res.status(201).json({ success: true, message: 'Message enregistré avec succès' });
  } catch (error) {
    console.error('submitContact error:', error);
    res.status(500).json({ error: 'Erreur enregistrement message de contact' });
  }
};

