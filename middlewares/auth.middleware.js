const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  // 1) Lấy Authorization header (hỗ trợ cả chữ thường và hoa)
  const rawHeader =
    req.headers["authorization"] || req.headers["Authorization"];

  if (!rawHeader) {
    return res
      .status(401)
      .json({ success: false, message: "Thiếu Authorization header" });
  }

  // 2) Hỗ trợ cả 2 định dạng: "Bearer <token>" hoặc chỉ "<token>"
  const parts = rawHeader.split(" ");
  const token =
    parts.length === 2 && /^Bearer$/i.test(parts[0]) ? parts[1] : rawHeader;

  try {
    // 3) Xác thực token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4) Chuẩn hóa req.user để luôn có _id
    // Trường hợp 1: payload dạng { user: { id, role } }
    if (decoded && decoded.user) {
      const u = decoded.user;
      req.user = {
        _id: u._id || u.id || u.userId || u.user_id,
        id: u.id || u._id || u.userId || u.user_id,
        role: u.role,
        service_provider_id: u.service_provider_id || u.serviceProviderId,
        ...u,
      };
    } else {
      // Trường hợp 2: payload để trực tiếp trên root { id/_id, email, role, ... }
      req.user = {
        _id: decoded._id || decoded.id || decoded.userId || decoded.user_id,
        id: decoded.id || decoded._id || decoded.userId || decoded.user_id,
        role: decoded.role,
        service_provider_id:
          decoded.service_provider_id || decoded.serviceProviderId,
        ...decoded,
      };
    }

    if (!req.user || !req.user._id) {
      return res
        .status(401)
        .json({
          success: false,
          message: "Token không chứa thông tin người dùng hợp lệ",
        });
    }

    return next();
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, message: "Token không hợp lệ hoặc đã hết hạn" });
  }
}

// Export with multiple names for compatibility
module.exports = requireAuth;
module.exports.requireAuth = requireAuth;
module.exports.authenticateUser = requireAuth; // Alias for new code
