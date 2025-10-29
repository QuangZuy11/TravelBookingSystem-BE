const ChatSession = require('../models/chat-session.model');
const ChatMessage = require('../models/chat-message.model');
const { generateReply } = require('../services/llm.service');

exports.createSession = async (req, res) => {
  try {
    const session = await ChatSession.create({
      user: req.user?._id || null,
      metadata: req.body?.metadata || {},
    });
    return res.json({ success: true, sessionId: String(session._id) });
  } catch (err) {
    console.error('createSession error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi tạo phiên chat' });
  }
};

exports.postMessage = async (req, res) => {
  try {
    const { sessionId, message, context } = req.body;
    if (!sessionId || !message) {
      return res.status(400).json({ success: false, message: 'Thiếu sessionId hoặc message' });
    }
    const session = await ChatSession.findById(sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Session không tồn tại' });

    // Lưu tin nhắn user
    await ChatMessage.create({ session: session._id, role: 'user', content: message });

    // Tạo messages ngắn (N tin gần nhất)
    const history = await ChatMessage.find({ session: session._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const ordered = history.reverse().map((m) => ({ role: m.role, content: m.content }));

    // Suy ra intent đơn giản
    const lower = message.toLowerCase();
    let intent = undefined;
    if (/(tour|hành trình|đi)/i.test(lower)) intent = 'tour-suggest';
    if (/(khách sạn|hotel|phòng)/i.test(lower)) intent = 'hotel-suggest';

    const { reply, citations } = await generateReply({
      messages: ordered,
      context: { ...(context || {}), intent },
    });

    // Lưu phản hồi assistant
    await ChatMessage.create({
      session: session._id,
      role: 'assistant',
      content: reply,
      citations,
    });

    return res.json({ success: true, reply, citations });
  } catch (err) {
    console.error('postMessage error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi xử lý tin nhắn' });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const messages = await ChatMessage.find({ session: sessionId })
      .sort({ createdAt: 1 })
      .lean();

    return res.json({
      success: true,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        citations: m.citations || [],
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    console.error('getHistory error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi lấy lịch sử chat' });
  }
};