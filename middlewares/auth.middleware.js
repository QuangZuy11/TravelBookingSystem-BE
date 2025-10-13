const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  // 1. Lấy token từ header
  const authHeader = req.header('Authorization');

  // 2. Kiểm tra xem header 'Authorization' có tồn tại và đúng định dạng không
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ msg: 'No token or invalid token format, authorization denied' });
  }

  try {
    // 3. Tách lấy giá trị token (bỏ "Bearer " ở đầu)
    const token = authHeader.split(' ')[1];

    // 4. Xác thực token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 5. Gắn payload đã giải mã vào request để các route sau có thể sử dụng
    req.user = decoded.user;
    next();
    
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};