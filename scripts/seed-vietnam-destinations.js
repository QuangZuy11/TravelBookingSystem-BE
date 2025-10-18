const mongoose = require('mongoose');
require('dotenv').config();

const Destination = require('../models/destination.model');
const PointOfInterest = require('../models/point-of-interest.model');

async function seedVietnamDestinations() {
    try {
        console.log('🇻🇳 Bắt đầu seed dữ liệu các tỉnh thành Việt Nam...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Đã kết nối MongoDB\n');

        // Clear existing data
        console.log('🗑️  Xóa dữ liệu cũ...');
        await Destination.deleteMany({});
        await PointOfInterest.deleteMany({});
        console.log('✅ Đã xóa tất cả destinations và POIs\n');

        // ========== CÁC TỈNH THÀNH VIỆT NAM ==========
        console.log('📍 Tạo danh sách các tỉnh thành...\n');

        const destinations = [
            // Miền Bắc
            {
                name: 'Hà Nội',
                type: 'city',
                description: 'Thủ đô của Việt Nam với hơn 1000 năm lịch sử, nổi tiếng với Phố Cổ, đền chùa và kiến trúc thuộc địa Pháp',
                location: {
                    city: 'Hà Nội',
                    country: 'Vietnam',
                    coordinates: { latitude: 21.0285, longitude: 105.8542 }
                },
                languages: ['Vietnamese', 'English'],
                travelTips: [
                    'Thời điểm tốt nhất: Tháng 10 - Tháng 4',
                    'Thử cà phê trứng và bún chả',
                    'Thuê xe máy để khám phá'
                ]
            },
            {
                name: 'Hạ Long',
                type: 'city',
                description: 'Di sản thiên nhiên thế giới với vịnh biển đẹp nhất thế giới, hàng nghìn hòn đảo đá vôi',
                location: {
                    city: 'Hạ Long',
                    country: 'Vietnam',
                    coordinates: { latitude: 20.9599, longitude: 107.0431 }
                },
                languages: ['Vietnamese', 'English'],
                travelTips: [
                    'Đi du thuyền qua đêm để trải nghiệm tốt nhất',
                    'Thăm động Sửng Sốt và làng chài',
                    'Tháng 3-5 và 9-11 là thời tiết đẹp nhất'
                ]
            },
            {
                name: 'Sapa',
                type: 'city',
                description: 'Thị trấn miền núi với ruộng bậc thang tuyệt đẹp, văn hóa dân tộc thiểu số đa dạng',
                location: {
                    city: 'Sapa',
                    country: 'Vietnam',
                    coordinates: { latitude: 22.3364, longitude: 103.8438 }
                },
                languages: ['Vietnamese', 'English'],
                travelTips: [
                    'Trekking qua các bản làng dân tộc',
                    'Leo đỉnh Fansipan bằng cáp treo',
                    'Thời điểm đẹp nhất: Tháng 9-11 (mùa lúa chín)'
                ]
            },
            {
                name: 'Ninh Bình',
                type: 'city',
                description: 'Vịnh Hạ Long trên cạn với hang động, núi đá vôi và đền chùa cổ kính',
                location: {
                    city: 'Ninh Bình',
                    country: 'Vietnam',
                    coordinates: { latitude: 20.2506, longitude: 105.9745 }
                },
                languages: ['Vietnamese', 'English'],
                travelTips: [
                    'Đi thuyền Tràng An để ngắm cảnh',
                    'Thăm Tam Cốc - Bích Động',
                    'Leo Hang Múa để view toàn cảnh'
                ]
            },

            // Miền Trung
            {
                name: 'Huế',
                type: 'city',
                description: 'Cố đô Việt Nam với Đại Nội, lăng tẩm và ẩm thực hoàng tộc độc đáo',
                location: {
                    city: 'Huế',
                    country: 'Vietnam',
                    coordinates: { latitude: 16.4637, longitude: 107.5909 }
                },
                languages: ['Vietnamese', 'English'],
                travelTips: [
                    'Thăm Đại Nội và các lăng tẩm',
                    'Thử bún bò Huế và cơm hến',
                    'Đi thuyền trên sông Hương'
                ]
            },
            {
                name: 'Đà Nẵng',
                type: 'city',
                description: 'Thành phố biển hiện đại với bãi biển đẹp, cầu độc đáo và là cửa ngõ đến Hội An',
                location: {
                    city: 'Đà Nẵng',
                    country: 'Vietnam',
                    coordinates: { latitude: 16.0544, longitude: 108.2022 }
                },
                languages: ['Vietnamese', 'English'],
                travelTips: [
                    'Thăm Ngũ Hành Sơn',
                    'Đi bộ qua cầu Rồng vào buổi tối',
                    'Bãi biển đẹp nhất: Mỹ Khê, Non Nước'
                ]
            },
            {
                name: 'Hội An',
                type: 'city',
                description: 'Phố cổ di sản UNESCO với kiến trúc được bảo tồn tốt, đèn lồng lung linh và may đo',
                location: {
                    city: 'Hội An',
                    country: 'Vietnam',
                    coordinates: { latitude: 15.8801, longitude: 108.3380 }
                },
                languages: ['Vietnamese', 'English'],
                travelTips: [
                    'Ghé vào đêm rằm để xem lễ hội đèn lồng',
                    'May quần áo theo yêu cầu',
                    'Thuê xe đạp khám phá vùng nông thôn'
                ]
            },
            {
                name: 'Quy Nhơn',
                type: 'city',
                description: 'Thành phố biển yên bình với bãi biển hoang sơ, tháp Chàm cổ và ẩm thực phong phú',
                location: {
                    city: 'Quy Nhơn',
                    country: 'Vietnam',
                    coordinates: { latitude: 13.7830, longitude: 109.2196 }
                },
                languages: ['Vietnamese', 'English'],
                travelTips: [
                    'Thăm Eo Gió và Kỳ Co',
                    'Ghé tháp Đôi Chàm Pa',
                    'Thử bánh xèo và bánh ít lá gai'
                ]
            },

            // Duyên hải Nam Trung Bộ
            {
                name: 'Nha Trang',
                type: 'city',
                description: 'Thiên đường biển với nước trong xanh, tour tham quan đảo và cuộc sống về đêm sôi động',
                location: {
                    city: 'Nha Trang',
                    country: 'Vietnam',
                    coordinates: { latitude: 12.2388, longitude: 109.1967 }
                },
                languages: ['Vietnamese', 'English'],
                travelTips: [
                    'Tắm bùn khoáng ở Tháp Bà',
                    'Tham quan Vinpearl Land',
                    'Tour tham quan các đảo'
                ]
            },
            {
                name: 'Đà Lạt',
                type: 'city',
                description: 'Thành phố ngàn hoa với khí hậu mát mẻ quanh năm, thác nước và kiến trúc Pháp',
                location: {
                    city: 'Đà Lạt',
                    country: 'Vietnam',
                    coordinates: { latitude: 11.9404, longitude: 108.4583 }
                },
                languages: ['Vietnamese', 'English'],
                travelTips: [
                    'Ghé hồ Tuyền Lâm và thác Datanla',
                    'Thăm các làng hoa và vườn dâu',
                    'Thử bánh tráng nướng và sữa đậu nành'
                ]
            },
            {
                name: 'Phan Thiết',
                type: 'city',
                description: 'Thành phố biển nổi tiếng với đồi cát bay, mũi Né và hải sản tươi ngon',
                location: {
                    city: 'Phan Thiết',
                    country: 'Vietnam',
                    coordinates: { latitude: 10.9289, longitude: 108.1014 }
                },
                languages: ['Vietnamese', 'English'],
                travelTips: [
                    'Leo đồi cát bay và trượt ván cát',
                    'Ngắm bình minh ở Hòn Rơm',
                    'Thử bánh căn và bánh xèo'
                ]
            },

            // Miền Nam
            {
                name: 'TP. Hồ Chí Minh',
                type: 'city',
                description: 'Thành phố lớn nhất Việt Nam, trung tâm kinh tế với cuộc sống sôi động và di tích lịch sử',
                location: {
                    city: 'TP. Hồ Chí Minh',
                    country: 'Vietnam',
                    coordinates: { latitude: 10.8231, longitude: 106.6297 }
                },
                languages: ['Vietnamese', 'English'],
                travelTips: [
                    'Thăm Dinh Độc Lập và Nhà thờ Đức Bà',
                    'Ăn vặt ở Quận 1',
                    'Đặt tour địa đạo Củ Chi trước'
                ]
            },
            {
                name: 'Vũng Tàu',
                type: 'city',
                description: 'Thành phố biển gần Sài Gòn với bãi biển đẹp, tượng Chúa Kitô và hải sản tươi',
                location: {
                    city: 'Vũng Tàu',
                    country: 'Vietnam',
                    coordinates: { latitude: 10.3460, longitude: 107.0843 }
                },
                languages: ['Vietnamese', 'English'],
                travelTips: [
                    'Leo tượng Chúa Kitô để ngắm biển',
                    'Thăm bãi Sau và bãi Trước',
                    'Ăn hải sản tại chợ đêm'
                ]
            },
            {
                name: 'Cần Thơ',
                type: 'city',
                description: 'Thủ phủ miền Tây với chợ nổi Cái Răng, vườn trái cây và văn hóa sông nước',
                location: {
                    city: 'Cần Thơ',
                    country: 'Vietnam',
                    coordinates: { latitude: 10.0452, longitude: 105.7469 }
                },
                languages: ['Vietnamese', 'English'],
                travelTips: [
                    'Dậy sớm để đi chợ nổi Cái Răng',
                    'Thăm vườn trái cây miệt vườn',
                    'Thử bánh cống và hủ tiếu'
                ]
            },
            {
                name: 'Phú Quốc',
                type: 'city',
                description: 'Đảo Ngọc với bãi biển hoang sơ, rừng nhiệt đới và làng chài truyền thống',
                location: {
                    city: 'Phú Quốc',
                    country: 'Vietnam',
                    coordinates: { latitude: 10.2899, longitude: 103.9840 }
                },
                languages: ['Vietnamese', 'English'],
                travelTips: [
                    'Lặn biển ngắm san hô',
                    'Thăm nhà máy nước mắm và vườn tiêu',
                    'Bãi Sao và Bãi Dài là đẹp nhất'
                ]
            },
            {
                name: 'Côn Đảo',
                type: 'city',
                description: 'Quần đảo thiên đường với bãi biển hoang sơ, rừng nguyên sinh và di tích lịch sử',
                location: {
                    city: 'Côn Đảo',
                    country: 'Vietnam',
                    coordinates: { latitude: 8.6881, longitude: 106.6065 }
                },
                languages: ['Vietnamese', 'English'],
                travelTips: [
                    'Lặn ngắm rùa biển và san hô',
                    'Thăm nhà tù Côn Đảo',
                    'Trekking trong rừng quốc gia'
                ]
            }
        ];

        const createdDestinations = await Destination.insertMany(destinations);
        console.log(`✅ Đã tạo ${createdDestinations.length} tỉnh thành\n`);

        // ========== CÁC ĐIỂM THAM QUAN (POIs) ==========
        console.log('📍 Tạo các điểm tham quan...\n');

        const getDestId = (name) => createdDestinations.find(d => d.name === name)._id;

        const pois = [
            // ===== HÀ NỘI =====
            {
                destinationId: getDestId('Hà Nội'),
                name: 'Phố Cổ Hà Nội',
                description: 'Khám phá 36 phố phường cổ với cửa hàng truyền thống, ẩm thực đường phố và kiến trúc thuộc địa',
                type: 'cultural',
                location: { address: 'Quận Hoàn Kiếm, Hà Nội', coordinates: { latitude: 21.0341, longitude: 105.8516 } },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 3, minutes: 0 },
                ratings: { average: 4.5, count: 2500 },
                facilities: ['Đường đi bộ', 'Ẩm thực', 'Cửa hàng'],
                status: 'active'
            },
            {
                destinationId: getDestId('Hà Nội'),
                name: 'Hoàng Thành Thăng Long',
                description: 'Di sản thế giới UNESCO - pháo đài hoàng gia cổ với 1000 năm lịch sử',
                type: 'historical',
                location: { address: '9C Hoàng Diệu, Hà Nội', coordinates: { latitude: 21.0340, longitude: 105.8372 } },
                entryFee: { adult: 30000, child: 15000, currency: 'VND' },
                recommendedDuration: { hours: 2, minutes: 30 },
                ratings: { average: 4.7, count: 1200 },
                facilities: ['Bảo tàng', 'Hướng dẫn viên', 'Nhà vệ sinh'],
                status: 'active'
            },
            {
                destinationId: getDestId('Hà Nội'),
                name: 'Hồ Hoàn Kiếm',
                description: 'Hồ biểu tượng ở trung tâm Hà Nội với Tháp Rùa và đền Ngọc Sơn',
                type: 'natural',
                location: { address: 'Quận Hoàn Kiếm, Hà Nội', coordinates: { latitude: 21.0288, longitude: 105.8525 } },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 1, minutes: 0 },
                ratings: { average: 4.6, count: 3000 },
                facilities: ['Đường đi bộ', 'Điểm chụp ảnh', 'Quán café'],
                status: 'active'
            },
            {
                destinationId: getDestId('Hà Nội'),
                name: 'Bảo tàng Dân tộc học Việt Nam',
                description: 'Bảo tàng toàn diện về 54 dân tộc Việt Nam',
                type: 'cultural',
                location: { address: 'Nguyễn Văn Huyên, Cầu Giấy, Hà Nội', coordinates: { latitude: 21.0387, longitude: 105.7807 } },
                entryFee: { adult: 40000, child: 20000, currency: 'VND' },
                recommendedDuration: { hours: 2, minutes: 30 },
                ratings: { average: 4.8, count: 1500 },
                facilities: ['Bảo tàng', 'Triển lãm ngoài trời', 'Cửa hàng quà tặng'],
                status: 'active'
            },
            {
                destinationId: getDestId('Hà Nội'),
                name: 'Văn Miếu - Quốc Tử Giám',
                description: 'Trường đại học đầu tiên của Việt Nam được xây dựng năm 1070, dành cho Khổng Tử',
                type: 'historical',
                location: { address: '58 Quốc Tử Giám, Đống Đa, Hà Nội', coordinates: { latitude: 21.0279, longitude: 105.8352 } },
                entryFee: { adult: 30000, child: 15000, currency: 'VND' },
                recommendedDuration: { hours: 1, minutes: 30 },
                ratings: { average: 4.6, count: 2200 },
                facilities: ['Vườn', 'Hướng dẫn viên', 'Điểm chụp ảnh'],
                status: 'active'
            },
            {
                destinationId: getDestId('Hà Nội'),
                name: 'Lăng Chủ tịch Hồ Chí Minh',
                description: 'Nơi an nghỉ cuối cùng của Chủ tịch Hồ Chí Minh',
                type: 'historical',
                location: { address: 'Số 2 Hùng Vương, Ba Đình, Hà Nội', coordinates: { latitude: 21.0369, longitude: 105.8348 } },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 1, minutes: 30 },
                ratings: { average: 4.5, count: 3500 },
                facilities: ['Lăng', 'Bảo tàng', 'Vườn'],
                status: 'active'
            },
            {
                destinationId: getDestId('Hà Nội'),
                name: 'Nhà hát Múa rối Nước',
                description: 'Nghệ thuật truyền thống Việt Nam với múa rối trên mặt nước',
                type: 'entertainment',
                location: { address: '57B Đinh Tiên Hoàng, Hoàn Kiếm, Hà Nội', coordinates: { latitude: 21.0291, longitude: 105.8524 } },
                entryFee: { adult: 100000, child: 50000, currency: 'VND' },
                recommendedDuration: { hours: 1, minutes: 0 },
                ratings: { average: 4.3, count: 1800 },
                facilities: ['Nhà hát', 'Cửa hàng quà tặng', 'Điều hòa'],
                status: 'active'
            },
            {
                destinationId: getDestId('Hà Nội'),
                name: 'Chùa Trấn Quốc',
                description: 'Ngôi chùa Phật giáo cổ nhất Hà Nội, nằm trên một hòn đảo ở Hồ Tây',
                type: 'religious',
                location: { address: 'Thanh Niên, Tây Hồ, Hà Nội', coordinates: { latitude: 21.0465, longitude: 105.8361 } },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 0, minutes: 45 },
                ratings: { average: 4.4, count: 900 },
                facilities: ['Chùa', 'Vườn', 'View hồ'],
                status: 'active'
            },

            // ===== HẠ LONG =====
            {
                destinationId: getDestId('Hạ Long'),
                name: 'Vịnh Hạ Long',
                description: 'Di sản thiên nhiên thế giới với hàng nghìn hòn đảo đá vôi nổi trên biển xanh',
                type: 'natural',
                location: { address: 'Vịnh Hạ Long, Quảng Ninh', coordinates: { latitude: 20.9101, longitude: 107.1839 } },
                entryFee: { adult: 200000, currency: 'VND' },
                recommendedDuration: { hours: 8, minutes: 0 },
                ratings: { average: 4.9, count: 15000 },
                facilities: ['Du thuyền', 'Hướng dẫn viên', 'Nhà hàng'],
                status: 'active'
            },
            {
                destinationId: getDestId('Hạ Long'),
                name: 'Động Sửng Sốt',
                description: 'Hang động lớn với nhũ đá tuyệt đẹp và ánh sáng tự nhiên',
                type: 'natural',
                location: { address: 'Đảo Bồ Hòn, Hạ Long', coordinates: { latitude: 20.8092, longitude: 107.1429 } },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 1, minutes: 0 },
                ratings: { average: 4.7, count: 8000 },
                facilities: ['Hang động', 'Cầu thang', 'Ánh sáng'],
                status: 'active'
            },
            {
                destinationId: getDestId('Hạ Long'),
                name: 'Đảo Ti Tốp',
                description: 'Đảo nhỏ với bãi biển đẹp và đường leo núi ngắm toàn cảnh vịnh',
                type: 'natural',
                location: { address: 'Đảo Ti Tốp, Hạ Long', coordinates: { latitude: 20.8244, longitude: 107.1397 } },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 1, minutes: 30 },
                ratings: { average: 4.6, count: 6000 },
                facilities: ['Bãi biển', 'Leo núi', 'Điểm ngắm cảnh'],
                status: 'active'
            },

            // ===== SAPA =====
            {
                destinationId: getDestId('Sapa'),
                name: 'Ruộng Bậc Thang',
                description: 'Ruộng lúa bậc thang tuyệt đẹp của người dân tộc thiểu số',
                type: 'natural',
                location: { address: 'Sapa, Lào Cai', coordinates: { latitude: 22.3364, longitude: 103.8438 } },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 4, minutes: 0 },
                ratings: { average: 4.8, count: 5000 },
                facilities: ['Trekking', 'Hướng dẫn viên', 'Homestay'],
                status: 'active'
            },
            {
                destinationId: getDestId('Sapa'),
                name: 'Đỉnh Fansipan',
                description: 'Nóc nhà Đông Dương cao 3143m, đi bằng cáp treo hiện đại',
                type: 'natural',
                location: { address: 'Fansipan, Sapa', coordinates: { latitude: 22.3024, longitude: 103.7751 } },
                entryFee: { adult: 700000, child: 500000, currency: 'VND' },
                recommendedDuration: { hours: 4, minutes: 0 },
                ratings: { average: 4.7, count: 8000 },
                facilities: ['Cáp treo', 'Nhà hàng', 'Chùa'],
                status: 'active'
            },
            {
                destinationId: getDestId('Sapa'),
                name: 'Bản Cát Cát',
                description: 'Làng dân tộc H\'Mông với văn hóa truyền thống và thác nước',
                type: 'cultural',
                location: { address: 'Cát Cát, Sapa', coordinates: { latitude: 22.3189, longitude: 103.8297 } },
                entryFee: { adult: 70000, currency: 'VND' },
                recommendedDuration: { hours: 2, minutes: 0 },
                ratings: { average: 4.5, count: 3000 },
                facilities: ['Làng', 'Thác', 'Thủ công mỹ nghệ'],
                status: 'active'
            },

            // ===== TP. HỒ CHÍ MINH =====
            {
                destinationId: getDestId('TP. Hồ Chí Minh'),
                name: 'Bảo tàng Chứng tích Chiến tranh',
                description: 'Bảo tàng ghi lại chiến tranh Việt Nam với ảnh, thiết bị quân sự và hiện vật',
                type: 'historical',
                location: { address: '28 Võ Văn Tần, Quận 3, TP.HCM', coordinates: { latitude: 10.7797, longitude: 106.6918 } },
                entryFee: { adult: 40000, child: 20000, currency: 'VND' },
                recommendedDuration: { hours: 2, minutes: 0 },
                ratings: { average: 4.6, count: 5000 },
                facilities: ['Bảo tàng', 'Triển lãm ngoài trời', 'Cửa hàng quà tặng'],
                status: 'active'
            },
            {
                destinationId: getDestId('TP. Hồ Chí Minh'),
                name: 'Nhà thờ Đức Bà',
                description: 'Nhà thờ thuộc địa Pháp tuyệt đẹp được xây dựng năm 1880, biểu tượng của Sài Gòn',
                type: 'historical',
                location: { address: '01 Công xã Paris, Quận 1, TP.HCM', coordinates: { latitude: 10.7798, longitude: 106.6990 } },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 0, minutes: 30 },
                ratings: { average: 4.5, count: 4200 },
                facilities: ['Nhà thờ', 'Điểm chụp ảnh'],
                status: 'active'
            },
            {
                destinationId: getDestId('TP. Hồ Chí Minh'),
                name: 'Chợ Bến Thành',
                description: 'Chợ nổi tiếng với quà lưu niệm, quần áo và ẩm thực đường phố Việt Nam',
                type: 'shopping',
                location: { address: 'Lê Lợi, Quận 1, TP.HCM', coordinates: { latitude: 10.7722, longitude: 106.6980 } },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 2, minutes: 0 },
                ratings: { average: 4.2, count: 6000 },
                facilities: ['Chợ', 'Quán ăn', 'ATM'],
                status: 'active'
            },
            {
                destinationId: getDestId('TP. Hồ Chí Minh'),
                name: 'Địa đạo Củ Chi',
                description: 'Mạng lưới đường hầm lịch sử dưới lòng đất được sử dụng trong chiến tranh Việt Nam',
                type: 'historical',
                location: { address: 'Huyện Củ Chi, TP.HCM', coordinates: { latitude: 11.1610, longitude: 106.4601 } },
                entryFee: { adult: 110000, child: 55000, currency: 'VND' },
                recommendedDuration: { hours: 3, minutes: 30 },
                ratings: { average: 4.7, count: 8000 },
                facilities: ['Địa đạo', 'Bắn súng', 'Nhà hàng'],
                status: 'active'
            },
            {
                destinationId: getDestId('TP. Hồ Chí Minh'),
                name: 'Dinh Độc Lập',
                description: 'Cung điện lịch sử nơi chiến tranh Việt Nam kết thúc năm 1975',
                type: 'historical',
                location: { address: '135 Nam Kỳ Khởi Nghĩa, Quận 1, TP.HCM', coordinates: { latitude: 10.7770, longitude: 106.6958 } },
                entryFee: { adult: 65000, child: 30000, currency: 'VND' },
                recommendedDuration: { hours: 1, minutes: 30 },
                ratings: { average: 4.4, count: 3500 },
                facilities: ['Cung điện', 'Bảo tàng', 'Vườn'],
                status: 'active'
            },

            // ===== ĐÀ NẴNG =====
            {
                destinationId: getDestId('Đà Nẵng'),
                name: 'Ngũ Hành Sơn',
                description: 'Năm ngọn núi đá vôi với hang động, đường hầm và thánh địa Phật giáo',
                type: 'natural',
                location: { address: 'Hòa Hải, Ngũ Hành Sơn, Đà Nẵng', coordinates: { latitude: 16.0017, longitude: 108.2627 } },
                entryFee: { adult: 40000, currency: 'VND' },
                recommendedDuration: { hours: 2, minutes: 0 },
                ratings: { average: 4.6, count: 3200 },
                facilities: ['Thang máy', 'Hang động', 'Chùa'],
                status: 'active'
            },
            {
                destinationId: getDestId('Đà Nẵng'),
                name: 'Cầu Rồng',
                description: 'Cầu biểu tượng phun lửa và nước vào cuối tuần',
                type: 'entertainment',
                location: { address: 'Trần Hưng Đạo, Đà Nẵng', coordinates: { latitude: 16.0609, longitude: 108.2278 } },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 1, minutes: 0 },
                ratings: { average: 4.5, count: 2800 },
                facilities: ['Cầu', 'Điểm chụp ảnh', 'View sông'],
                status: 'active'
            },
            {
                destinationId: getDestId('Đà Nẵng'),
                name: 'Bãi biển Mỹ Khê',
                description: 'Bãi biển cát trắng đẹp, được bình chọn là một trong những bãi biển hấp dẫn nhất hành tinh',
                type: 'natural',
                location: { address: 'Phước Mỹ, Sơn Trà, Đà Nẵng', coordinates: { latitude: 16.0471, longitude: 108.2425 } },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 3, minutes: 0 },
                ratings: { average: 4.7, count: 4500 },
                facilities: ['Bãi biển', 'Nhà hàng', 'Thể thao nước'],
                status: 'active'
            },

            // ===== HỘI AN =====
            {
                destinationId: getDestId('Hội An'),
                name: 'Phố Cổ Hội An',
                description: 'Di sản UNESCO với các tòa nhà được bảo tồn tốt và đường phố thắp đèn lồng',
                type: 'historical',
                location: { address: 'Phố Cổ, Hội An', coordinates: { latitude: 15.8794, longitude: 108.3350 } },
                entryFee: { adult: 120000, currency: 'VND' },
                recommendedDuration: { hours: 3, minutes: 0 },
                ratings: { average: 4.8, count: 6000 },
                facilities: ['Tòa nhà cổ', 'Cửa hàng', 'Nhà hàng'],
                status: 'active'
            },
            {
                destinationId: getDestId('Hội An'),
                name: 'Chùa Cầu',
                description: 'Cây cầu 400 năm tuổi kết nối khu phố Nhật Bản và Trung Quốc',
                type: 'historical',
                location: { address: 'Nguyễn Thị Minh Khai, Hội An', coordinates: { latitude: 15.8788, longitude: 108.3279 } },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 0, minutes: 30 },
                ratings: { average: 4.6, count: 3800 },
                facilities: ['Cầu', 'Điểm chụp ảnh'],
                status: 'active'
            },
            {
                destinationId: getDestId('Hội An'),
                name: 'Bãi biển An Bàng',
                description: 'Bãi biển yên bình tránh xa đám đông, hoàn hảo để thư giãn',
                type: 'natural',
                location: { address: 'An Bàng, Cẩm An, Hội An', coordinates: { latitude: 15.9158, longitude: 108.3644 } },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 2, minutes: 30 },
                ratings: { average: 4.5, count: 2200 },
                facilities: ['Bãi biển', 'Quán bar', 'Ghế tắm nắng'],
                status: 'active'
            },

            // ===== NHA TRANG =====
            {
                destinationId: getDestId('Nha Trang'),
                name: 'Vinpearl Land',
                description: 'Công viên giải trí lớn trên đảo, đi bằng cáp treo hiện đại',
                type: 'entertainment',
                location: { address: 'Đảo Hòn Tre, Nha Trang', coordinates: { latitude: 12.2080, longitude: 109.2211 } },
                entryFee: { adult: 880000, child: 700000, currency: 'VND' },
                recommendedDuration: { hours: 5, minutes: 0 },
                ratings: { average: 4.5, count: 8000 },
                facilities: ['Công viên giải trí', 'Công viên nước', 'Cáp treo'],
                status: 'active'
            },
            {
                destinationId: getDestId('Nha Trang'),
                name: 'Tháp Bà Ponagar',
                description: 'Quần thể đền Hindu cổ từ thế kỷ 7-12',
                type: 'historical',
                location: { address: '2 Tháng 4, Nha Trang', coordinates: { latitude: 12.2652, longitude: 109.1953 } },
                entryFee: { adult: 22000, currency: 'VND' },
                recommendedDuration: { hours: 1, minutes: 0 },
                ratings: { average: 4.3, count: 1800 },
                facilities: ['Đền', 'Bảo tàng', 'View thành phố'],
                status: 'active'
            },
            {
                destinationId: getDestId('Nha Trang'),
                name: 'Bãi biển Nha Trang',
                description: 'Dải bãi biển 6km nguyên sơ với nước trong xanh',
                type: 'natural',
                location: { address: 'Trần Phú, Nha Trang', coordinates: { latitude: 12.2388, longitude: 109.1967 } },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 3, minutes: 0 },
                ratings: { average: 4.6, count: 5500 },
                facilities: ['Bãi biển', 'Thể thao nước', 'Nhà hàng'],
                status: 'active'
            },

            // ===== PHÚ QUỐC =====
            {
                destinationId: getDestId('Phú Quốc'),
                name: 'Bãi Sao',
                description: 'Bãi biển cát trắng tuyệt đẹp với nước biển trong xanh',
                type: 'natural',
                location: { address: 'An Thới, Phú Quốc', coordinates: { latitude: 10.1596, longitude: 103.9671 } },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 3, minutes: 0 },
                ratings: { average: 4.7, count: 6000 },
                facilities: ['Bãi biển', 'Nhà hàng hải sản', 'Thể thao nước'],
                status: 'active'
            },
            {
                destinationId: getDestId('Phú Quốc'),
                name: 'Vinpearl Safari',
                description: 'Công viên bảo tồn động vật hoang dã lớn nhất Việt Nam',
                type: 'entertainment',
                location: { address: 'Bãi Dài, Phú Quốc', coordinates: { latitude: 10.3761, longitude: 103.9682 } },
                entryFee: { adult: 600000, child: 450000, currency: 'VND' },
                recommendedDuration: { hours: 4, minutes: 0 },
                ratings: { average: 4.6, count: 4500 },
                facilities: ['Safari', 'Sở thú', 'Nhà hàng'],
                status: 'active'
            },
            {
                destinationId: getDestId('Phú Quốc'),
                name: 'Làng Chài Hàm Ninh',
                description: 'Làng chài truyền thống với hải sản tươi ngon và cầu gỗ đẹp',
                type: 'cultural',
                location: { address: 'Hàm Ninh, Phú Quốc', coordinates: { latitude: 10.3165, longitude: 104.0287 } },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 2, minutes: 0 },
                ratings: { average: 4.4, count: 2000 },
                facilities: ['Làng chài', 'Nhà hàng hải sản', 'Cầu gỗ'],
                status: 'active'
            },

            // ===== ĐÀ LẠT =====
            {
                destinationId: getDestId('Đà Lạt'),
                name: 'Hồ Xuân Hương',
                description: 'Hồ trung tâm thành phố với đường đi bộ và hoạt động vui chơi',
                type: 'natural',
                location: { address: 'Trung tâm Đà Lạt', coordinates: { latitude: 11.9297, longitude: 108.4375 } },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 1, minutes: 30 },
                ratings: { average: 4.5, count: 3500 },
                facilities: ['Hồ', 'Đạp vịt', 'Quán café'],
                status: 'active'
            },
            {
                destinationId: getDestId('Đà Lạt'),
                name: 'Thác Datanla',
                description: 'Thác nước đẹp với hoạt động đu dây trượt và xe trượt núi',
                type: 'natural',
                location: { address: 'Đèo Prenn, Đà Lạt', coordinates: { latitude: 11.9091, longitude: 108.4576 } },
                entryFee: { adult: 50000, currency: 'VND' },
                recommendedDuration: { hours: 2, minutes: 0 },
                ratings: { average: 4.4, count: 2800 },
                facilities: ['Thác', 'Trượt núi', 'Đu dây'],
                status: 'active'
            },
            {
                destinationId: getDestId('Đà Lạt'),
                name: 'Vườn Hoa Thành Phố',
                description: 'Vườn hoa rộng lớn với hàng nghìn loài hoa và điêu khắc nghệ thuật',
                type: 'natural',
                location: { address: 'Đường Trần Quốc Toản, Đà Lạt', coordinates: { latitude: 11.9437, longitude: 108.4420 } },
                entryFee: { adult: 40000, currency: 'VND' },
                recommendedDuration: { hours: 1, minutes: 30 },
                ratings: { average: 4.3, count: 2500 },
                facilities: ['Vườn hoa', 'Điểm chụp ảnh', 'Quán café'],
                status: 'active'
            }
        ];

        const createdPOIs = await PointOfInterest.insertMany(pois);
        console.log(`✅ Đã tạo ${createdPOIs.length} điểm tham quan\n`);

        // Print summary by destination
        console.log('📊 Thống kê theo tỉnh thành:\n');
        for (const dest of createdDestinations) {
            const poiCount = createdPOIs.filter(p => p.destinationId.toString() === dest._id.toString()).length;
            console.log(`   ${dest.name}: ${poiCount} điểm tham quan`);
        }

        console.log('\n🎉 Seed dữ liệu hoàn tất!\n');
        console.log('📌 Tổng cộng:');
        console.log(`   - ${createdDestinations.length} tỉnh thành`);
        console.log(`   - ${createdPOIs.length} điểm tham quan\n`);
        console.log('🧪 Test với:');
        console.log('   curl http://localhost:3000/api/destinations');
        console.log('   curl http://localhost:3000/api/destinations?country=Vietnam');
        console.log('   curl http://localhost:3000/api/poi/destination/DESTINATION_ID');

        await mongoose.disconnect();
        console.log('\n✅ Đã ngắt kết nối MongoDB');

    } catch (error) {
        console.error('❌ Lỗi khi seed dữ liệu:', error);
        process.exit(1);
    }
}

seedVietnamDestinations();
