const pool = require('../config/db');

exports.getMessages = async (req, res) => {
  try {
    const { user1, user2 } = req.params;
    const [rows] = await pool.promise().query(
      `SELECT * FROM messages 
       WHERE (from_user_id = ? AND to_user_id = ?) 
          OR (from_user_id = ? AND to_user_id = ?)
       ORDER BY created_at ASC`,
      [user1, user2, user2, user1]
    );

    const messages = rows.map(m => ({
      id: m.id,
      fromId: m.from_user_id,
      toId: m.to_user_id,
      content: m.content,
      createdAt: m.created_at
    }));

    res.json(messages);
  } catch (error) {
    console.error('getMessages error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des messages' });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { fromId, toId, content } = req.body;
    if (!fromId || !toId || !content) {
      return res.status(400).json({ error: 'Paramètres manquants' });
    }

    const [result] = await pool.promise().query(
      'INSERT INTO messages (from_user_id, to_user_id, content) VALUES (?, ?, ?)',
      [fromId, toId, content]
    );

    const message = {
      id: result.insertId,
      fromId,
      toId,
      content,
      createdAt: new Date().toISOString()
    };

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${toId}`).emit('chat_message', message);
    }

    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error('sendMessage error:', error);
    res.status(500).json({ error: 'Erreur lors de l’envoi du message' });
  }
};
