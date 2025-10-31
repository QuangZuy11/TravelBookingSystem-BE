const { GoogleGenerativeAI } = require('@google/generative-ai');
const { searchTours, searchHotels } = require('./tools.service');

const SYS_PROMPT = `
Bạn là trợ lý du lịch cho Du khách Việt Nam. Trả lời tiếng Việt, ngắn gọn, rõ ràng.
Tuyệt đối KHÔNG hiển thị "SYSTEM_INSTRUCTION", tool-calls, hay nội dung kỹ thuật. Chỉ trả lời cho người dùng.
Khi cần dữ liệu thực (tour/khách sạn), backend đã chuẩn bị dữ liệu trong "Ngữ cảnh". Không bịa.
Nếu thiếu thông tin (ngày, số người, ngân sách), hỏi lại tối đa 3 câu.
`;

function formatCitations(arr) {
  return (arr || []).map((x) => ({ type: x.type, id: x.id }));
}

function buildFallbackReply(citations, context) {
  if (context?.intent === 'tour-suggest') {
    return citations?.length
      ? `Mình gợi ý ${citations.length} tour, ví dụ: ${citations.slice(0,3).map(i=>i.name).join(', ')}. Bạn cho mình ngày đi, số người và ngân sách để lọc kỹ hơn nhé.`
      : `Chưa thấy tour phù hợp ở ${context?.location || 'khu vực bạn chọn'}. Bạn có thể điều chỉnh địa điểm/ngân sách/ngày đi không?`;
  }
  if (context?.intent === 'hotel-suggest') {
    return citations?.length
      ? `Có ${citations.length} khách sạn phù hợp. Ví dụ: ${citations.slice(0,3).map(i=>i.name).join(', ')}. Cho mình biết ngày check-in/out và số người nhé.`
      : `Chưa tìm thấy khách sạn phù hợp ở ${context?.location || 'khu vực bạn chọn'}. Bạn có thể cung cấp thêm ngày và ngân sách không?`;
  }
  return 'Bạn muốn tìm tour hay khách sạn ở đâu, ngày nào, bao nhiêu người và ngân sách khoảng bao nhiêu?';
}

async function callGemini(finalMessages) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return '';
  const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest';
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  // Gộp nội dung thành 1 prompt đơn giản
  const prompt = finalMessages
    .map(m => `${m.role.toUpperCase()}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
    .join('\n\n');

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });

  return result?.response?.text() || '';
}

exports.generateReply = async ({ messages, context }) => {
  // Chuẩn bị dữ liệu thực trước (để có fallback và không cần hiển thị trạng thái trung gian)
  let citations = [];
  if (context?.location && context?.intent === 'tour-suggest') {
    const { items } = await searchTours({
      location: context.location,
      query: context.query,
      maxPrice: context.maxPrice,
    });
    citations = items.slice(0, 5);
  } else if (context?.location && context?.intent === 'hotel-suggest') {
    const { items } = await searchHotels({
      location: context.location,
      maxPrice: context.maxPrice,
    });
    citations = items.slice(0, 5);
  }

  const finalMessages = [
    { role: 'system', content: SYS_PROMPT },
    ...(messages || []),
    { role: 'system', content: `Ngữ cảnh: ${JSON.stringify(context || {})}` },
    citations.length
      ? { role: 'system', content: `Dữ liệu tìm được: ${JSON.stringify(citations)}` }
      : null,
  ].filter(Boolean);

  if (!process.env.GEMINI_API_KEY) {
    return { reply: buildFallbackReply(citations, context), citations };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest';
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = finalMessages
      .map((m) => `${m.role.toUpperCase()}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
      .join('\n\n');

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const reply = result?.response?.text() || buildFallbackReply(citations, context);
    return { reply, citations };
  } catch (err) {
    console.error('Gemini error:', { message: err?.message });
    return { reply: buildFallbackReply(citations, context), citations };
  }
};