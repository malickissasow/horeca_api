const pool = require('../config/db');

exports.getMeetingsForUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const [rows] = await pool.promise().query(
      `SELECT m.*, 
              uFrom.name AS fromName, uFrom.company AS fromCompany, uFrom.role AS fromRole,
              uTo.name AS toName, uTo.company AS toCompany, uTo.role AS toRole
       FROM meetings m
       JOIN users uFrom ON m.from_user_id = uFrom.id
       JOIN users uTo ON m.to_user_id = uTo.id
       WHERE m.from_user_id = ? OR m.to_user_id = ?
       ORDER BY m.id DESC`,
      [userId, userId]
    );

    const meetings = rows.map(m => ({
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

    res.json(meetings);
  } catch (error) {
    console.error('getMeetingsForUser error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des rendez-vous' });
  }
};

exports.createMeeting = async (req, res) => {
  try {
    const { fromId, toId, day, time, note } = req.body;
    if (!fromId || !toId || !day || !time) {
      return res.status(400).json({ error: 'Paramètres manquants pour le rendez-vous' });
    }

    const tableNumber = Math.floor(Math.random() * 25) + 1;

    const [result] = await pool.promise().query(
      `INSERT INTO meetings (from_user_id, to_user_id, day, time_slot, status, table_number, note)
       VALUES (?, ?, ?, ?, 'PENDING', ?, ?)`,
      [fromId, toId, day, time, tableNumber, note || '']
    );

    const [userFrom] = await pool.promise().query('SELECT name, company FROM users WHERE id = ?', [fromId]);
    const fromCompany = userFrom[0]?.company || userFrom[0]?.name || 'Un participant';

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${toId}`).emit('meeting_created', {
        id: result.insertId,
        fromCompany,
        day,
        time
      });
    }

    res.status(201).json({
      success: true,
      meeting: {
        id: result.insertId,
        fromId,
        toId,
        day,
        time,
        status: 'PENDING',
        table: tableNumber,
        note
      }
    });
  } catch (error) {
    console.error('createMeeting error:', error);
    res.status(500).json({ error: 'Erreur lors de la création du rendez-vous' });
  }
};

exports.updateMeetingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['ACCEPTED', 'REFUSED', 'PENDING', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }

    await pool.promise().query('UPDATE meetings SET status = ? WHERE id = ?', [status, id]);

    const [rows] = await pool.promise().query('SELECT from_user_id, to_user_id FROM meetings WHERE id = ?', [id]);
    if (rows.length > 0) {
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${rows[0].from_user_id}`).emit('meeting_status_changed', {
          id: parseInt(id),
          status
        });
      }
    }

    res.json({ success: true, id: parseInt(id), status });
  } catch (error) {
    console.error('updateMeetingStatus error:', error);
    res.status(500).json({ error: 'Erreur mise à jour rendez-vous' });
  }
};

exports.savePrivateNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { privateNote, rating } = req.body;

    await pool.promise().query(
      'UPDATE meetings SET private_note = ?, rating = ? WHERE id = ?',
      [privateNote || '', rating || 0, id]
    );

    res.json({ success: true, id: parseInt(id), privateNote, rating });
  } catch (error) {
    console.error('savePrivateNote error:', error);
    res.status(500).json({ error: 'Erreur sauvegarde note privée' });
  }
};
