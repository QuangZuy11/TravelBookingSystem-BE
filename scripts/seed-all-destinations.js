const mongoose = require('mongoose');
require('dotenv').config();

const Destination = require('../models/destination.model');
const PointOfInterest = require('../models/point-of-interest.model');

async function seedDestinationsAndPOIs() {
    try {
        console.log('🌱 Starting comprehensive seeding...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB connected\n');

        // Clear existing data
        console.log('🗑️  Clearing existing data...');
        await Destination.deleteMany({});
        await PointOfInterest.deleteMany({});
        console.log('✅ Cleared all destinations and POIs\n');

        // ========== DESTINATIONS (Vietnam Only) ==========
        console.log('📍 Creating destinations...\n');

        const destinations = [
            // Northern Vietnam
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

            // Central Vietnam
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

            // South Central Coast
            {
                name: 'Nha Trang',
                type: 'city',
                description: 'Thiên đường biển với nước trong xanh, tour tham quan đảo và cuộc sống về đêm sôi động',
                location: {
                    city: 'Nha Trang',
                    country: 'Vietnam',
                    coordinates: { latitude: 12.2388, longitude: 109.1967 }
                },
                languages: ['Vietnamese', 'English', 'Russian'],
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

            // Southern Vietnam
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
        console.log(`✅ Created ${createdDestinations.length} destinations\n`);

        // ========== POIs ==========
        console.log('📍 Creating POIs for each destination...\n');

        // Helper to find destination by name
        const getDestId = (name) => createdDestinations.find(d => d.name === name)._id;

        const pois = [
            // ===== HÀ NỘI POIs =====
            {
                destinationId: getDestId('Hà Nội'),
                name: 'Old Quarter Walking Tour',
                description: 'Explore 36 ancient streets with traditional shops, street food, and colonial architecture',
                type: 'cultural',
                location: { address: 'Old Quarter, Hoan Kiem, Hanoi', coordinates: { latitude: 21.0341, longitude: 105.8516 } },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 3, minutes: 0 },
                ratings: { average: 4.5, count: 2500 },
                facilities: ['Walking paths', 'Street food', 'Shops'],
                status: 'active'
            },
            {
                destinationId: getDestId('Hanoi'),
                name: 'Imperial Citadel of Thang Long',
                description: 'UNESCO World Heritage Site - ancient royal fortress with 1000 years of history',
                type: 'historical',
                location: { address: '9C Hoàng Diệu, Hanoi', coordinates: { latitude: 21.0340, longitude: 105.8372 } },
                entryFee: { adult: 30000, child: 15000, currency: 'VND' },
                recommendedDuration: { hours: 2, minutes: 30 },
                ratings: { average: 4.7, count: 1200 },
                facilities: ['Museum', 'Guided tours', 'Restrooms'],
                status: 'active'
            },
            {
                destinationId: getDestId('Hanoi'),
                name: 'Hoan Kiem Lake',
                description: 'Iconic lake in the heart of Hanoi with Turtle Tower and Ngoc Son Temple',
                type: 'natural',
                location: { address: 'Hoan Kiem District, Hanoi', coordinates: { latitude: 21.0288, longitude: 105.8525 } },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 1, minutes: 0 },
                ratings: { average: 4.6, count: 3000 },
                facilities: ['Walking path', 'Photo spots', 'Cafes nearby'],
                status: 'active'
            },
            {
                destinationId: getDestId('Hanoi'),
                name: 'Vietnam Museum of Ethnology',
                description: 'Comprehensive museum showcasing 54 ethnic groups of Vietnam',
                type: 'cultural',
                location: { address: 'Nguyen Van Huyen, Cau Giay, Hanoi', coordinates: { latitude: 21.0387, longitude: 105.7807 } },
                entryFee: { adult: 40000, child: 20000, currency: 'VND' },
                recommendedDuration: { hours: 2, minutes: 30 },
                ratings: { average: 4.8, count: 1500 },
                facilities: ['Museum', 'Outdoor exhibits', 'Gift shop'],
                status: 'active'
            },
            {
                destinationId: getDestId('Hanoi'),
                name: 'Temple of Literature',
                description: "Vietnam's first national university built in 1070, dedicated to Confucius",
                type: 'historical',
                location: { address: '58 Quoc Tu Giam, Dong Da, Hanoi', coordinates: { latitude: 21.0279, longitude: 105.8352 } },
                entryFee: { adult: 30000, child: 15000, currency: 'VND' },
                recommendedDuration: { hours: 1, minutes: 30 },
                ratings: { average: 4.6, count: 2200 },
                facilities: ['Gardens', 'Guided tours', 'Photo spots'],
                status: 'active'
            },
            {
                destinationId: getDestId('Hanoi'),
                name: 'Ho Chi Minh Mausoleum',
                description: "Final resting place of Ho Chi Minh, Vietnam's revolutionary leader",
                type: 'historical',
                location: { address: '2 Hung Vuong, Ba Dinh, Hanoi', coordinates: { latitude: 21.0369, longitude: 105.8348 } },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 1, minutes: 30 },
                ratings: { average: 4.5, count: 3500 },
                facilities: ['Mausoleum', 'Museum', 'Gardens'],
                status: 'active'
            },
            {
                destinationId: getDestId('Hanoi'),
                name: 'Water Puppet Theatre',
                description: 'Traditional Vietnamese art form with puppets performing on water',
                type: 'entertainment',
                location: { address: '57B Dinh Tien Hoang, Hoan Kiem, Hanoi', coordinates: { latitude: 21.0291, longitude: 105.8524 } },
                entryFee: { adult: 100000, child: 50000, currency: 'VND' },
                recommendedDuration: { hours: 1, minutes: 0 },
                ratings: { average: 4.3, count: 1800 },
                facilities: ['Theatre', 'Gift shop', 'AC'],
                status: 'active'
            },
            {
                destinationId: getDestId('Hanoi'),
                name: 'Tran Quoc Pagoda',
                description: 'Oldest Buddhist temple in Hanoi, located on an island in West Lake',
                type: 'religious',
                location: { address: 'Thanh Nien, Tay Ho, Hanoi', coordinates: { latitude: 21.0465, longitude: 105.8361 } },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 0, minutes: 45 },
                ratings: { average: 4.4, count: 900 },
                facilities: ['Temple', 'Gardens', 'Lake view'],
                status: 'active'
            },

            // ===== HO CHI MINH CITY POIs =====
            {
                destinationId: getDestId('Ho Chi Minh City'),
                name: 'War Remnants Museum',
                description: 'Powerful museum documenting the Vietnam War with photos, military equipment, and artifacts',
                type: 'historical',
                location: { address: '28 Vo Van Tan, District 3, HCMC', coordinates: { latitude: 10.7797, longitude: 106.6918 } },
                entryFee: { adult: 40000, child: 20000, currency: 'VND' },
                recommendedDuration: { hours: 2, minutes: 0 },
                ratings: { average: 4.6, count: 5000 },
                facilities: ['Museum', 'Outdoor exhibits', 'Gift shop'],
                status: 'active'
            },
            {
                destinationId: getDestId('Ho Chi Minh City'),
                name: 'Notre-Dame Cathedral Basilica',
                description: 'Stunning French colonial cathedral built in 1880, iconic landmark of Saigon',
                type: 'historical',
                location: { address: '1 Cong Xa Paris, District 1, HCMC', coordinates: { latitude: 10.7798, longitude: 106.6990 } },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 0, minutes: 30 },
                ratings: { average: 4.5, count: 4200 },
                facilities: ['Cathedral', 'Photo spot'],
                status: 'active'
            },
            {
                destinationId: getDestId('Ho Chi Minh City'),
                name: 'Ben Thanh Market',
                description: 'Famous indoor market for souvenirs, clothes, and Vietnamese street food',
                type: 'shopping',
                location: { address: 'Le Loi, District 1, HCMC', coordinates: { latitude: 10.7722, longitude: 106.6980 } },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 2, minutes: 0 },
                ratings: { average: 4.2, count: 6000 },
                facilities: ['Market', 'Food stalls', 'ATM'],
                status: 'active'
            },
            {
                destinationId: getDestId('Ho Chi Minh City'),
                name: 'Cu Chi Tunnels',
                description: 'Historic underground tunnel network used during the Vietnam War',
                type: 'historical',
                location: { address: 'Cu Chi District, HCMC', coordinates: { latitude: 11.1610, longitude: 106.4601 } },
                entryFee: { adult: 110000, child: 55000, currency: 'VND' },
                recommendedDuration: { hours: 3, minutes: 30 },
                ratings: { average: 4.7, count: 8000 },
                facilities: ['Tunnels', 'Shooting range', 'Restaurant'],
                status: 'active'
            },
            {
                destinationId: getDestId('Ho Chi Minh City'),
                name: 'Independence Palace',
                description: 'Historic palace where the Vietnam War ended in 1975',
                type: 'historical',
                location: { address: '135 Nam Ky Khoi Nghia, District 1, HCMC', coordinates: { latitude: 10.7770, longitude: 106.6958 } },
                entryFee: { adult: 65000, child: 30000, currency: 'VND' },
                recommendedDuration: { hours: 1, minutes: 30 },
                ratings: { average: 4.4, count: 3500 },
                facilities: ['Palace', 'Museum', 'Gardens'],
                status: 'active'
            },

            // ===== DA NANG POIs =====
            {
                destinationId: getDestId('Da Nang'),
                name: 'Marble Mountains',
                description: 'Five marble and limestone hills with caves, tunnels, and Buddhist sanctuaries',
                type: 'natural',
                location: { address: 'Hoa Hai, Ngu Hanh Son, Da Nang', coordinates: { latitude: 16.0017, longitude: 108.2627 } },
                entryFee: { adult: 40000, currency: 'VND' },
                recommendedDuration: { hours: 2, minutes: 0 },
                ratings: { average: 4.6, count: 3200 },
                facilities: ['Elevator', 'Caves', 'Pagodas'],
                status: 'active'
            },
            {
                destinationId: getDestId('Da Nang'),
                name: 'Dragon Bridge',
                description: 'Iconic bridge that breathes fire and water on weekend nights',
                type: 'entertainment',
                location: { address: 'Tran Hung Dao, Da Nang', coordinates: { latitude: 16.0609, longitude: 108.2278 } },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 1, minutes: 0 },
                ratings: { average: 4.5, count: 2800 },
                facilities: ['Bridge', 'Photo spots', 'River view'],
                status: 'active'
            },
            {
                destinationId: getDestId('Da Nang'),
                name: 'My Khe Beach',
                description: 'Beautiful white sand beach, voted one of the most attractive beaches on the planet',
                type: 'natural',
                location: { address: 'Phuoc My, Son Tra, Da Nang', coordinates: { latitude: 16.0471, longitude: 108.2425 } },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 3, minutes: 0 },
                ratings: { average: 4.7, count: 4500 },
                facilities: ['Beach', 'Restaurants', 'Water sports'],
                status: 'active'
            },

            // ===== HOI AN POIs =====
            {
                destinationId: getDestId('Hoi An'),
                name: 'Ancient Town',
                description: 'UNESCO World Heritage Site with well-preserved buildings and lantern-lit streets',
                type: 'historical',
                location: { address: 'Old Town, Hoi An', coordinates: { latitude: 15.8794, longitude: 108.3350 } },
                entryFee: { adult: 120000, currency: 'VND' },
                recommendedDuration: { hours: 3, minutes: 0 },
                ratings: { average: 4.8, count: 6000 },
                facilities: ['Historic buildings', 'Shops', 'Restaurants'],
                status: 'active'
            },
            {
                destinationId: getDestId('Hoi An'),
                name: 'Japanese Covered Bridge',
                description: 'Iconic 400-year-old bridge connecting Japanese and Chinese quarters',
                type: 'historical',
                location: { address: 'Nguyen Thi Minh Khai, Hoi An', coordinates: { latitude: 15.8788, longitude: 108.3279 } },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 0, minutes: 30 },
                ratings: { average: 4.6, count: 3800 },
                facilities: ['Bridge', 'Photo spot'],
                status: 'active'
            },
            {
                destinationId: getDestId('Hoi An'),
                name: 'An Bang Beach',
                description: 'Peaceful beach away from the crowds, perfect for relaxation',
                type: 'natural',
                location: { address: 'An Bang, Cam An, Hoi An', coordinates: { latitude: 15.9158, longitude: 108.3644 } },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 2, minutes: 30 },
                ratings: { average: 4.5, count: 2200 },
                facilities: ['Beach', 'Beach bars', 'Sunbeds'],
                status: 'active'
            },

            // ===== NHA TRANG POIs =====
            {
                destinationId: getDestId('Nha Trang'),
                name: 'Vinpearl Land',
                description: 'Large amusement park and resort on an island, accessible by cable car',
                type: 'entertainment',
                location: { address: 'Hon Tre Island, Nha Trang', coordinates: { latitude: 12.2080, longitude: 109.2211 } },
                entryFee: { adult: 880000, child: 700000, currency: 'VND' },
                recommendedDuration: { hours: 5, minutes: 0 },
                ratings: { average: 4.5, count: 8000 },
                facilities: ['Amusement park', 'Water park', 'Cable car'],
                status: 'active'
            },
            {
                destinationId: getDestId('Nha Trang'),
                name: 'Po Nagar Cham Towers',
                description: 'Ancient Hindu temple complex dating back to 7th-12th century',
                type: 'historical',
                location: { address: '2 Thang 4, Nha Trang', coordinates: { latitude: 12.2652, longitude: 109.1953 } },
                entryFee: { adult: 22000, currency: 'VND' },
                recommendedDuration: { hours: 1, minutes: 0 },
                ratings: { average: 4.3, count: 1800 },
                facilities: ['Temple', 'Museum', 'City view'],
                status: 'active'
            },
            {
                destinationId: getDestId('Nha Trang'),
                name: 'Nha Trang Beach',
                description: '6km stretch of pristine beach with crystal clear water',
                type: 'natural',
                location: { address: 'Tran Phu, Nha Trang', coordinates: { latitude: 12.2388, longitude: 109.1967 } },
                entryFee: { adult: 0, currency: 'VND' },
                recommendedDuration: { hours: 3, minutes: 0 },
                ratings: { average: 4.6, count: 5500 },
                facilities: ['Beach', 'Water sports', 'Restaurants'],
                status: 'active'
            },

            // ===== BANGKOK POIs =====
            {
                destinationId: getDestId('Bangkok'),
                name: 'Grand Palace',
                description: 'Stunning complex of royal buildings, former residence of Thai kings',
                type: 'historical',
                location: { address: 'Na Phra Lan Rd, Phra Nakhon, Bangkok', coordinates: { latitude: 13.7500, longitude: 100.4913 } },
                entryFee: { adult: 500, currency: 'THB' },
                recommendedDuration: { hours: 2, minutes: 30 },
                ratings: { average: 4.7, count: 15000 },
                facilities: ['Palace', 'Temple', 'Dress code enforced'],
                status: 'active'
            },
            {
                destinationId: getDestId('Bangkok'),
                name: 'Wat Pho (Temple of Reclining Buddha)',
                description: '46-meter long golden reclining Buddha and traditional Thai massage school',
                type: 'religious',
                location: { address: '2 Sanam Chai Rd, Phra Nakhon, Bangkok', coordinates: { latitude: 13.7465, longitude: 100.4927 } },
                entryFee: { adult: 200, currency: 'THB' },
                recommendedDuration: { hours: 1, minutes: 30 },
                ratings: { average: 4.8, count: 12000 },
                facilities: ['Temple', 'Massage school', 'Gardens'],
                status: 'active'
            },
            {
                destinationId: getDestId('Bangkok'),
                name: 'Chatuchak Weekend Market',
                description: "World's largest weekend market with 15,000+ stalls",
                type: 'shopping',
                location: { address: 'Kamphaeng Phet 2 Rd, Chatuchak, Bangkok', coordinates: { latitude: 13.7998, longitude: 100.5505 } },
                entryFee: { adult: 0, currency: 'THB' },
                recommendedDuration: { hours: 3, minutes: 0 },
                ratings: { average: 4.6, count: 20000 },
                facilities: ['Market', 'Food stalls', 'ATM'],
                status: 'active'
            },
            {
                destinationId: getDestId('Bangkok'),
                name: 'Wat Arun (Temple of Dawn)',
                description: 'Iconic riverside temple with stunning porcelain-decorated spires',
                type: 'religious',
                location: { address: '158 Thanon Wang Doem, Wat Arun, Bangkok', coordinates: { latitude: 13.7437, longitude: 100.4887 } },
                entryFee: { adult: 100, currency: 'THB' },
                recommendedDuration: { hours: 1, minutes: 0 },
                ratings: { average: 4.7, count: 10000 },
                facilities: ['Temple', 'River view', 'Photo spot'],
                status: 'active'
            },

            // ===== CHIANG MAI POIs =====
            {
                destinationId: getDestId('Chiang Mai'),
                name: 'Doi Suthep Temple',
                description: 'Sacred Buddhist temple on mountain with panoramic city views',
                type: 'religious',
                location: { address: 'Doi Suthep, Chiang Mai', coordinates: { latitude: 18.8047, longitude: 98.9217 } },
                entryFee: { adult: 30, currency: 'THB' },
                recommendedDuration: { hours: 2, minutes: 0 },
                ratings: { average: 4.8, count: 9000 },
                facilities: ['Temple', 'Viewpoint', 'Cable car'],
                status: 'active'
            },
            {
                destinationId: getDestId('Chiang Mai'),
                name: 'Old City Temples',
                description: 'Historic walled city with numerous ancient temples',
                type: 'cultural',
                location: { address: 'Old City, Chiang Mai', coordinates: { latitude: 18.7883, longitude: 98.9853 } },
                entryFee: { adult: 0, currency: 'THB' },
                recommendedDuration: { hours: 3, minutes: 0 },
                ratings: { average: 4.6, count: 6500 },
                facilities: ['Temples', 'Cafes', 'Walking paths'],
                status: 'active'
            },
            {
                destinationId: getDestId('Chiang Mai'),
                name: 'Elephant Nature Park',
                description: 'Ethical elephant sanctuary and rescue center',
                type: 'natural',
                location: { address: 'Mae Taeng, Chiang Mai', coordinates: { latitude: 19.0520, longitude: 98.8630 } },
                entryFee: { adult: 2500, currency: 'THB' },
                recommendedDuration: { hours: 6, minutes: 0 },
                ratings: { average: 4.9, count: 7500 },
                facilities: ['Sanctuary', 'Feeding', 'Guides'],
                status: 'active'
            },

            // ===== PHUKET POIs =====
            {
                destinationId: getDestId('Phuket'),
                name: 'Phi Phi Islands',
                description: 'Stunning island group with crystal clear waters and limestone cliffs',
                type: 'natural',
                location: { address: 'Phi Phi Islands, Krabi', coordinates: { latitude: 7.7407, longitude: 98.7784 } },
                entryFee: { adult: 400, currency: 'THB' },
                recommendedDuration: { hours: 8, minutes: 0 },
                ratings: { average: 4.8, count: 12000 },
                facilities: ['Boat tours', 'Snorkeling', 'Beaches'],
                status: 'active'
            },
            {
                destinationId: getDestId('Phuket'),
                name: 'Big Buddha',
                description: '45-meter tall marble statue on Nakkerd Hill',
                type: 'religious',
                location: { address: 'Karon, Phuket', coordinates: { latitude: 7.8919, longitude: 98.3077 } },
                entryFee: { adult: 0, currency: 'THB' },
                recommendedDuration: { hours: 1, minutes: 0 },
                ratings: { average: 4.5, count: 8500 },
                facilities: ['Statue', 'Viewpoint', 'Parking'],
                status: 'active'
            },
            {
                destinationId: getDestId('Phuket'),
                name: 'Patong Beach',
                description: 'Most famous beach in Phuket with vibrant nightlife',
                type: 'natural',
                location: { address: 'Patong, Phuket', coordinates: { latitude: 7.8968, longitude: 98.2964 } },
                entryFee: { adult: 0, currency: 'THB' },
                recommendedDuration: { hours: 3, minutes: 0 },
                ratings: { average: 4.3, count: 15000 },
                facilities: ['Beach', 'Nightlife', 'Water sports'],
                status: 'active'
            },

            // ===== TOKYO POIs =====
            {
                destinationId: getDestId('Tokyo'),
                name: 'Senso-ji Temple',
                description: "Tokyo's oldest temple with famous Kaminarimon Gate and Nakamise shopping street",
                type: 'religious',
                location: { address: '2-3-1 Asakusa, Taito, Tokyo', coordinates: { latitude: 35.7148, longitude: 139.7967 } },
                entryFee: { adult: 0, currency: 'JPY' },
                recommendedDuration: { hours: 1, minutes: 30 },
                ratings: { average: 4.6, count: 25000 },
                facilities: ['Temple', 'Shopping street', 'Fortune telling'],
                status: 'active'
            },
            {
                destinationId: getDestId('Tokyo'),
                name: 'Tokyo Skytree',
                description: 'Tallest structure in Japan at 634m with observation decks and shopping mall',
                type: 'entertainment',
                location: { address: '1-1-2 Oshiage, Sumida, Tokyo', coordinates: { latitude: 35.7101, longitude: 139.8107 } },
                entryFee: { adult: 2100, child: 950, currency: 'JPY' },
                recommendedDuration: { hours: 2, minutes: 0 },
                ratings: { average: 4.5, count: 30000 },
                facilities: ['Observatory', 'Restaurant', 'Shopping'],
                status: 'active'
            },
            {
                destinationId: getDestId('Tokyo'),
                name: 'Meiji Shrine',
                description: 'Peaceful Shinto shrine in a forested area, dedicated to Emperor Meiji',
                type: 'religious',
                location: { address: '1-1 Yoyogikamizonocho, Shibuya, Tokyo', coordinates: { latitude: 35.6764, longitude: 139.6993 } },
                entryFee: { adult: 0, currency: 'JPY' },
                recommendedDuration: { hours: 1, minutes: 0 },
                ratings: { average: 4.7, count: 18000 },
                facilities: ['Shrine', 'Forest walk', 'Traditional weddings'],
                status: 'active'
            },
            {
                destinationId: getDestId('Tokyo'),
                name: 'Shibuya Crossing',
                description: "World's busiest pedestrian crossing, iconic Tokyo landmark",
                type: 'entertainment',
                location: { address: 'Shibuya, Tokyo', coordinates: { latitude: 35.6595, longitude: 139.7004 } },
                entryFee: { adult: 0, currency: 'JPY' },
                recommendedDuration: { hours: 0, minutes: 30 },
                ratings: { average: 4.4, count: 22000 },
                facilities: ['Crossing', 'Shopping', 'Cafes'],
                status: 'active'
            },

            // ===== KYOTO POIs =====
            {
                destinationId: getDestId('Kyoto'),
                name: 'Fushimi Inari Shrine',
                description: 'Famous for thousands of vermillion torii gates along mountain trails',
                type: 'religious',
                location: { address: '68 Fukakusa Yabunouchicho, Fushimi, Kyoto', coordinates: { latitude: 34.9671, longitude: 135.7727 } },
                entryFee: { adult: 0, currency: 'JPY' },
                recommendedDuration: { hours: 2, minutes: 0 },
                ratings: { average: 4.9, count: 35000 },
                facilities: ['Shrine', 'Hiking trails', 'Photo spots'],
                status: 'active'
            },
            {
                destinationId: getDestId('Kyoto'),
                name: 'Kinkaku-ji (Golden Pavilion)',
                description: 'Stunning gold-leaf covered Zen temple surrounded by gardens',
                type: 'religious',
                location: { address: '1 Kinkakujicho, Kita, Kyoto', coordinates: { latitude: 35.0394, longitude: 135.7292 } },
                entryFee: { adult: 500, currency: 'JPY' },
                recommendedDuration: { hours: 1, minutes: 0 },
                ratings: { average: 4.8, count: 28000 },
                facilities: ['Temple', 'Gardens', 'Gift shop'],
                status: 'active'
            },
            {
                destinationId: getDestId('Kyoto'),
                name: 'Arashiyama Bamboo Grove',
                description: 'Enchanting bamboo forest with towering stalks creating natural tunnels',
                type: 'natural',
                location: { address: 'Arashiyama, Ukyo, Kyoto', coordinates: { latitude: 35.0170, longitude: 135.6719 } },
                entryFee: { adult: 0, currency: 'JPY' },
                recommendedDuration: { hours: 1, minutes: 30 },
                ratings: { average: 4.7, count: 20000 },
                facilities: ['Walking path', 'Temples', 'Restaurants'],
                status: 'active'
            },

            // ===== SINGAPORE POIs =====
            {
                destinationId: getDestId('Singapore'),
                name: 'Gardens by the Bay',
                description: 'Futuristic park with Supertrees, Cloud Forest, and Flower Dome',
                type: 'natural',
                location: { address: '18 Marina Gardens Dr, Singapore', coordinates: { latitude: 1.2816, longitude: 103.8636 } },
                entryFee: { adult: 28, child: 15, currency: 'SGD' },
                recommendedDuration: { hours: 2, minutes: 30 },
                ratings: { average: 4.8, count: 35000 },
                facilities: ['Gardens', 'Conservatories', 'Light show'],
                status: 'active'
            },
            {
                destinationId: getDestId('Singapore'),
                name: 'Marina Bay Sands',
                description: 'Iconic hotel with rooftop infinity pool and observation deck',
                type: 'entertainment',
                location: { address: '10 Bayfront Ave, Singapore', coordinates: { latitude: 1.2834, longitude: 103.8607 } },
                entryFee: { adult: 32, child: 23, currency: 'SGD' },
                recommendedDuration: { hours: 1, minutes: 30 },
                ratings: { average: 4.6, count: 28000 },
                facilities: ['Observation deck', 'Shopping', 'Casino'],
                status: 'active'
            },
            {
                destinationId: getDestId('Singapore'),
                name: 'Universal Studios Singapore',
                description: 'Theme park with rides and attractions based on movies and TV shows',
                type: 'entertainment',
                location: { address: '8 Sentosa Gateway, Sentosa Island, Singapore', coordinates: { latitude: 1.2540, longitude: 103.8238 } },
                entryFee: { adult: 81, child: 62, currency: 'SGD' },
                recommendedDuration: { hours: 5, minutes: 0 },
                ratings: { average: 4.5, count: 40000 },
                facilities: ['Theme park', 'Restaurants', 'Shows'],
                status: 'active'
            },
            {
                destinationId: getDestId('Singapore'),
                name: 'Sentosa Island',
                description: 'Resort island with beaches, attractions, and entertainment',
                type: 'entertainment',
                location: { address: 'Sentosa Island, Singapore', coordinates: { latitude: 1.2494, longitude: 103.8303 } },
                entryFee: { adult: 4, currency: 'SGD' },
                recommendedDuration: { hours: 4, minutes: 0 },
                ratings: { average: 4.6, count: 32000 },
                facilities: ['Beaches', 'Cable car', 'Attractions'],
                status: 'active'
            },

            // ===== KUALA LUMPUR POIs =====
            {
                destinationId: getDestId('Kuala Lumpur'),
                name: 'Petronas Twin Towers',
                description: 'Iconic 88-story twin skyscrapers with sky bridge and observation deck',
                type: 'entertainment',
                location: { address: 'Jalan Ampang, Kuala Lumpur', coordinates: { latitude: 3.1579, longitude: 101.7116 } },
                entryFee: { adult: 85, child: 35, currency: 'MYR' },
                recommendedDuration: { hours: 1, minutes: 30 },
                ratings: { average: 4.7, count: 25000 },
                facilities: ['Observatory', 'Shopping mall', 'Park'],
                status: 'active'
            },
            {
                destinationId: getDestId('Kuala Lumpur'),
                name: 'Batu Caves',
                description: 'Limestone hill with series of caves and Hindu temples, featuring giant golden statue',
                type: 'religious',
                location: { address: 'Batu Caves, Selangor', coordinates: { latitude: 3.2379, longitude: 101.6840 } },
                entryFee: { adult: 0, currency: 'MYR' },
                recommendedDuration: { hours: 2, minutes: 0 },
                ratings: { average: 4.5, count: 18000 },
                facilities: ['Caves', 'Temple', '272 steps'],
                status: 'active'
            },
            {
                destinationId: getDestId('Kuala Lumpur'),
                name: 'Central Market',
                description: 'Cultural landmark with traditional crafts, art, and Malaysian souvenirs',
                type: 'shopping',
                location: { address: 'Jalan Hang Kasturi, Kuala Lumpur', coordinates: { latitude: 3.1440, longitude: 101.6958 } },
                entryFee: { adult: 0, currency: 'MYR' },
                recommendedDuration: { hours: 1, minutes: 30 },
                ratings: { average: 4.3, count: 8500 },
                facilities: ['Market', 'Food court', 'Art gallery'],
                status: 'active'
            }
        ];

        const createdPOIs = await PointOfInterest.insertMany(pois);
        console.log(`✅ Created ${createdPOIs.length} POIs\n`);

        // Print summary by destination
        console.log('📊 Summary by destination:\n');
        for (const dest of createdDestinations) {
            const poiCount = createdPOIs.filter(p => p.destinationId.toString() === dest._id.toString()).length;
            console.log(`   ${dest.name} (${dest.location.country}): ${poiCount} POIs`);
        }

        console.log('\n🎉 Seeding completed successfully!\n');
        console.log('Test with:');
        console.log('  curl http://localhost:3000/api/destinations');
        console.log('  curl http://localhost:3000/api/poi/destination/DESTINATION_ID');

        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error seeding data:', error);
        process.exit(1);
    }
}

seedDestinationsAndPOIs();
