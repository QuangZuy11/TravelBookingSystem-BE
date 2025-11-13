require('dotenv').config();
const mongoose = require('mongoose');
const PointOfInterest = require('../models/point-of-interest.model');
const Destination = require('../models/destination.model');

// Premium POIs - Luxury & High-end attractions
const premiumPOIs = [
    // ===== HÀ NỘI - LUXURY =====
    {
        destination_name: 'Hà Nội',
        pois: [
            {
                name: 'Nhà Hàng Cầu Gỗ - Fine Dining',
                description: 'Nhà hàng cao cấp với view Hồ Tây tuyệt đẹp, phục vụ ẩm thực Pháp-Việt fusion. Không gian sang trọng với thiết kế hiện đại, wine cellar đa dạng và chef nổi tiếng.',
                type: 'dining',
                location: {
                    address: '1 Thanh Niên, Quận Tây Hồ, Hà Nội',
                    coordinates: {
                        latitude: 21.0583,
                        longitude: 105.8213
                    }
                },
                images: ['https://example.com/caugo1.jpg', 'https://example.com/caugo2.jpg'],
                openingHours: {
                    monday: { open: '11:00', close: '23:00' },
                    tuesday: { open: '11:00', close: '23:00' },
                    wednesday: { open: '11:00', close: '23:00' },
                    thursday: { open: '11:00', close: '23:00' },
                    friday: { open: '11:00', close: '23:30' },
                    saturday: { open: '11:00', close: '23:30' },
                    sunday: { open: '11:00', close: '23:00' }
                },
                entryFee: {
                    adult: 2500000, // 2.5M VND average per person
                    child: 1500000,
                    senior: 2500000,
                    currency: 'VND'
                },
                recommendedDuration: { hours: 2, minutes: 30 },
                facilities: ['Private dining rooms', 'Wine cellar', 'Live music', 'Valet parking', 'Garden terrace'],
                accessibility: {
                    wheelchair: true,
                    publicTransport: true,
                    parking: true
                },
                ratings: { average: 4.8, count: 1250 },
                status: 'active'
            },
            {
                name: 'JW Marriott Hotel Hanoi - Spa & Wellness',
                description: 'Spa 5 sao với liệu pháp chăm sóc toàn diện, massage trị liệu cao cấp, sauna, jacuzzi và các dịch vụ làm đẹp premium. Đội ngũ chuyên gia quốc tế.',
                type: 'entertainment',
                location: {
                    address: '8 Đỗ Đức Dục, Mễ Trì, Nam Từ Liêm, Hà Nội',
                    coordinates: {
                        latitude: 21.0133,
                        longitude: 105.7821
                    }
                },
                images: ['https://example.com/jwspa1.jpg'],
                openingHours: {
                    monday: { open: '07:00', close: '22:00' },
                    tuesday: { open: '07:00', close: '22:00' },
                    wednesday: { open: '07:00', close: '22:00' },
                    thursday: { open: '07:00', close: '22:00' },
                    friday: { open: '07:00', close: '23:00' },
                    saturday: { open: '07:00', close: '23:00' },
                    sunday: { open: '07:00', close: '22:00' }
                },
                entryFee: {
                    adult: 3500000, // 3.5M VND full spa package
                    child: 0,
                    senior: 3500000,
                    currency: 'VND'
                },
                recommendedDuration: { hours: 3, minutes: 0 },
                facilities: ['Sauna', 'Steam room', 'Jacuzzi', 'Private treatment rooms', 'Relaxation lounge', 'Yoga studio'],
                accessibility: {
                    wheelchair: true,
                    publicTransport: false,
                    parking: true
                },
                ratings: { average: 4.9, count: 850 },
                status: 'active'
            },
            {
                name: 'Lotte Center Hanoi Observation Deck',
                description: 'Đài quan sát cao 272m tại tòa nhà cao nhất Hà Nội. View 360 độ toàn cảnh thành phố, có khu vực sky bar cao cấp và nhà hàng fine dining.',
                type: 'entertainment',
                location: {
                    address: '54 Liễu Giai, Cống Vị, Ba Đình, Hà Nội',
                    coordinates: {
                        latitude: 21.0314,
                        longitude: 105.8178
                    }
                },
                images: ['https://example.com/lotte1.jpg', 'https://example.com/lotte2.jpg'],
                openingHours: {
                    monday: { open: '09:00', close: '22:00' },
                    tuesday: { open: '09:00', close: '22:00' },
                    wednesday: { open: '09:00', close: '22:00' },
                    thursday: { open: '09:00', close: '22:00' },
                    friday: { open: '09:00', close: '23:00' },
                    saturday: { open: '09:00', close: '23:00' },
                    sunday: { open: '09:00', close: '22:00' }
                },
                entryFee: {
                    adult: 230000,
                    child: 170000,
                    senior: 170000,
                    currency: 'VND'
                },
                recommendedDuration: { hours: 1, minutes: 30 },
                facilities: ['Sky bar', 'Fine dining restaurant', 'Gift shop', 'Photo spots', 'VIP lounge'],
                accessibility: {
                    wheelchair: true,
                    publicTransport: true,
                    parking: true
                },
                ratings: { average: 4.6, count: 3200 },
                status: 'active'
            },
            {
                name: 'La Badiane Restaurant - French Haute Cuisine',
                description: 'Nhà hàng Pháp cổ điển trong biệt thự Pháp cổ, phục vụ món ăn haute cuisine với nguyên liệu nhập khẩu cao cấp. Chef từng làm việc tại nhà hàng Michelin.',
                type: 'dining',
                location: {
                    address: '10 Nam Ngư, Hoàn Kiếm, Hà Nội',
                    coordinates: {
                        latitude: 21.0245,
                        longitude: 105.8412
                    }
                },
                images: ['https://example.com/labadiane1.jpg'],
                openingHours: {
                    monday: { open: '11:30', close: '14:00' },
                    tuesday: { open: '11:30', close: '14:00' },
                    wednesday: { open: '11:30', close: '14:00' },
                    thursday: { open: '11:30', close: '14:00' },
                    friday: { open: '11:30', close: '14:00' },
                    saturday: { open: '11:30', close: '14:00' },
                    sunday: { open: '11:30', close: '14:00' }
                },
                entryFee: {
                    adult: 1800000, // Set lunch menu
                    child: 1000000,
                    senior: 1800000,
                    currency: 'VND'
                },
                recommendedDuration: { hours: 2, minutes: 0 },
                facilities: ['Private dining', 'Wine pairing', 'Chef table', 'Garden seating'],
                accessibility: {
                    wheelchair: false,
                    publicTransport: true,
                    parking: false
                },
                ratings: { average: 4.7, count: 680 },
                status: 'active'
            },
            {
                name: 'Sofitel Legend Metropole - Le Club Bar',
                description: 'Bar cocktail huyền thoại trong khách sạn 5 sao lịch sử hơn 100 năm. Không gian sang trọng kiểu Pháp, cocktail độc đáo và thường có live jazz performance.',
                type: 'entertainment',
                location: {
                    address: '15 Ngô Quyền, Hoàn Kiếm, Hà Nội',
                    coordinates: {
                        latitude: 21.0238,
                        longitude: 105.8535
                    }
                },
                images: ['https://example.com/metropole1.jpg', 'https://example.com/metropole2.jpg'],
                openingHours: {
                    monday: { open: '17:00', close: '01:00' },
                    tuesday: { open: '17:00', close: '01:00' },
                    wednesday: { open: '17:00', close: '01:00' },
                    thursday: { open: '17:00', close: '01:00' },
                    friday: { open: '17:00', close: '02:00' },
                    saturday: { open: '17:00', close: '02:00' },
                    sunday: { open: '17:00', close: '01:00' }
                },
                entryFee: {
                    adult: 800000, // Average drink + cover charge
                    child: 0,
                    senior: 800000,
                    currency: 'VND'
                },
                recommendedDuration: { hours: 2, minutes: 0 },
                facilities: ['Live jazz', 'Premium cocktails', 'Cigar lounge', 'Private booths', 'Valet parking'],
                accessibility: {
                    wheelchair: true,
                    publicTransport: true,
                    parking: true
                },
                ratings: { average: 4.8, count: 1540 },
                status: 'active'
            },
            {
                name: 'Vincom Center Ba Trieu - Luxury Shopping',
                description: 'Trung tâm mua sắm cao cấp với các thương hiệu quốc tế: Louis Vuitton, Gucci, Hermès, Chanel. Có khu ẩm thực fine dining và cinema premium.',
                type: 'shopping',
                location: {
                    address: '191 Bà Triệu, Hai Bà Trưng, Hà Nội',
                    coordinates: {
                        latitude: 21.0149,
                        longitude: 105.8477
                    }
                },
                images: ['https://example.com/vincom1.jpg'],
                openingHours: {
                    monday: { open: '09:30', close: '22:00' },
                    tuesday: { open: '09:30', close: '22:00' },
                    wednesday: { open: '09:30', close: '22:00' },
                    thursday: { open: '09:30', close: '22:00' },
                    friday: { open: '09:30', close: '22:00' },
                    saturday: { open: '09:30', close: '22:00' },
                    sunday: { open: '09:30', close: '22:00' }
                },
                entryFee: {
                    adult: 5000000, // Average shopping budget
                    child: 1000000,
                    senior: 3000000,
                    currency: 'VND'
                },
                recommendedDuration: { hours: 3, minutes: 0 },
                facilities: ['Luxury boutiques', 'Personal shopping service', 'VIP lounge', 'Fine dining', 'Premium cinema', 'Valet parking'],
                accessibility: {
                    wheelchair: true,
                    publicTransport: true,
                    parking: true
                },
                ratings: { average: 4.5, count: 2800 },
                status: 'active'
            }
        ]
    },

    // ===== TP HỒ CHÍ MINH - LUXURY =====
    {
        destination_name: 'TP Hồ Chí Minh',
        pois: [
            {
                name: 'Nobu Restaurant Saigon',
                description: 'Nhà hàng Nhật Bản cao cấp nổi tiếng thế giới, phục vụ món ăn fusion Nhật-Peru độc đáo. View đẹp từ tầng cao, không gian sang trọng và sushi premium.',
                type: 'dining',
                location: {
                    address: 'Tầng 26, Saigon Centre, 67 Lê Lợi, Quận 1, TP.HCM',
                    coordinates: {
                        latitude: 10.7769,
                        longitude: 106.7009
                    }
                },
                images: ['https://example.com/nobu1.jpg', 'https://example.com/nobu2.jpg'],
                openingHours: {
                    monday: { open: '11:30', close: '23:00' },
                    tuesday: { open: '11:30', close: '23:00' },
                    wednesday: { open: '11:30', close: '23:00' },
                    thursday: { open: '11:30', close: '23:00' },
                    friday: { open: '11:30', close: '00:00' },
                    saturday: { open: '11:30', close: '00:00' },
                    sunday: { open: '11:30', close: '23:00' }
                },
                entryFee: {
                    adult: 3500000, // Omakase menu
                    child: 1500000,
                    senior: 3500000,
                    currency: 'VND'
                },
                recommendedDuration: { hours: 2, minutes: 30 },
                facilities: ['Sushi bar', 'Private dining', 'Sake collection', 'City view', 'Valet parking'],
                accessibility: {
                    wheelchair: true,
                    publicTransport: true,
                    parking: true
                },
                ratings: { average: 4.9, count: 2100 },
                status: 'active'
            },
            {
                name: 'The Reverie Saigon - Spa by Guerlain',
                description: 'Spa siêu sang trọng sử dụng sản phẩm Guerlain Paris cao cấp. Liệu pháp độc quyền, phòng trị liệu riêng tư với view panoramic thành phố.',
                type: 'entertainment',
                location: {
                    address: 'Tầng 8, The Reverie Saigon, 22-36 Nguyễn Huệ, Quận 1, TP.HCM',
                    coordinates: {
                        latitude: 10.7739,
                        longitude: 106.7044
                    }
                },
                images: ['https://example.com/reverie1.jpg'],
                openingHours: {
                    monday: { open: '09:00', close: '22:00' },
                    tuesday: { open: '09:00', close: '22:00' },
                    wednesday: { open: '09:00', close: '22:00' },
                    thursday: { open: '09:00', close: '22:00' },
                    friday: { open: '09:00', close: '22:00' },
                    saturday: { open: '09:00', close: '22:00' },
                    sunday: { open: '09:00', close: '22:00' }
                },
                entryFee: {
                    adult: 5500000, // Signature treatment
                    child: 0,
                    senior: 5500000,
                    currency: 'VND'
                },
                recommendedDuration: { hours: 3, minutes: 0 },
                facilities: ['Private suites', 'Hammam', 'Vitality pool', 'Relaxation lounge', 'Champagne bar', 'Personal therapist'],
                accessibility: {
                    wheelchair: true,
                    publicTransport: true,
                    parking: true
                },
                ratings: { average: 5.0, count: 420 },
                status: 'active'
            },
            {
                name: 'Bitexco Financial Tower - Saigon Skydeck',
                description: 'Tòa nhà cao nhất Sài Gòn với đài quan sát tầng 49. View 360 độ toàn cảnh thành phố, có helipad cafe độc đáo và không gian sự kiện cao cấp.',
                type: 'entertainment',
                location: {
                    address: '36 Hồ Tùng Mậu, Quận 1, TP.HCM',
                    coordinates: {
                        latitude: 10.7717,
                        longitude: 106.7038
                    }
                },
                images: ['https://example.com/bitexco1.jpg', 'https://example.com/bitexco2.jpg'],
                openingHours: {
                    monday: { open: '09:30', close: '21:30' },
                    tuesday: { open: '09:30', close: '21:30' },
                    wednesday: { open: '09:30', close: '21:30' },
                    thursday: { open: '09:30', close: '21:30' },
                    friday: { open: '09:30', close: '21:30' },
                    saturday: { open: '09:30', close: '21:30' },
                    sunday: { open: '09:30', close: '21:30' }
                },
                entryFee: {
                    adult: 200000,
                    child: 130000,
                    senior: 130000,
                    currency: 'VND'
                },
                recommendedDuration: { hours: 1, minutes: 30 },
                facilities: ['Observatory', 'Helipad cafe', 'Photo service', 'Gift shop', 'VR experience'],
                accessibility: {
                    wheelchair: true,
                    publicTransport: true,
                    parking: true
                },
                ratings: { average: 4.6, count: 5600 },
                status: 'active'
            },
            {
                name: 'Saigon Centre & Takashimaya - Luxury Mall',
                description: 'Trung tâm mua sắm cao cấp với Takashimaya Nhật Bản, các thương hiệu xa xỉ quốc tế và khu ẩm thực fine dining. Dịch vụ personal shopping VIP.',
                type: 'shopping',
                location: {
                    address: '65 Lê Lợi, Quận 1, TP.HCM',
                    coordinates: {
                        latitude: 10.7770,
                        longitude: 106.7010
                    }
                },
                images: ['https://example.com/takashimaya1.jpg'],
                openingHours: {
                    monday: { open: '09:30', close: '22:00' },
                    tuesday: { open: '09:30', close: '22:00' },
                    wednesday: { open: '09:30', close: '22:00' },
                    thursday: { open: '09:30', close: '22:00' },
                    friday: { open: '09:30', close: '22:00' },
                    saturday: { open: '09:30', close: '22:00' },
                    sunday: { open: '09:30', close: '22:00' }
                },
                entryFee: {
                    adult: 8000000, // Average luxury shopping
                    child: 1500000,
                    senior: 5000000,
                    currency: 'VND'
                },
                recommendedDuration: { hours: 4, minutes: 0 },
                facilities: ['International brands', 'Personal shopping', 'VIP lounge', 'Fine dining', 'Beauty salons', 'Concierge service'],
                accessibility: {
                    wheelchair: true,
                    publicTransport: true,
                    parking: true
                },
                ratings: { average: 4.7, count: 3400 },
                status: 'active'
            },
            {
                name: 'L\'Usine Le Loi - Premium Concept Store',
                description: 'Concept store cao cấp kết hợp fashion boutique, home décor và specialty coffee. Thiết kế industrial-chic độc đáo, bán các thương hiệu designer và craft products.',
                type: 'shopping',
                location: {
                    address: '151/6 Đồng Khởi, Quận 1, TP.HCM',
                    coordinates: {
                        latitude: 10.7756,
                        longitude: 106.7024
                    }
                },
                images: ['https://example.com/lusine1.jpg'],
                openingHours: {
                    monday: { open: '08:00', close: '22:00' },
                    tuesday: { open: '08:00', close: '22:00' },
                    wednesday: { open: '08:00', close: '22:00' },
                    thursday: { open: '08:00', close: '22:00' },
                    friday: { open: '08:00', close: '23:00' },
                    saturday: { open: '08:00', close: '23:00' },
                    sunday: { open: '08:00', close: '22:00' }
                },
                entryFee: {
                    adult: 2000000, // Average shopping + café
                    child: 500000,
                    senior: 1500000,
                    currency: 'VND'
                },
                recommendedDuration: { hours: 2, minutes: 0 },
                facilities: ['Designer boutique', 'Specialty coffee', 'Art gallery', 'Workshop space', 'WiFi'],
                accessibility: {
                    wheelchair: false,
                    publicTransport: true,
                    parking: false
                },
                ratings: { average: 4.8, count: 1890 },
                status: 'active'
            }
        ]
    },

    // ===== ĐÀ NẴNG - LUXURY =====
    {
        destination_name: 'Đà Nẵng',
        pois: [
            {
                name: 'InterContinental Danang - La Maison 1888',
                description: 'Nhà hàng fine dining với chef Michelin, phục vụ ẩm thực Pháp hiện đại. Không gian villa sang trọng bên bờ biển, wine cellar đẳng cấp.',
                type: 'dining',
                location: {
                    address: 'InterContinental Danang Sun Peninsula Resort, Bãi Bắc, Sơn Trà, Đà Nẵng',
                    coordinates: {
                        latitude: 16.1029,
                        longitude: 108.2527
                    }
                },
                images: ['https://example.com/lamaison1.jpg', 'https://example.com/lamaison2.jpg'],
                openingHours: {
                    monday: { open: '18:30', close: '22:30' },
                    tuesday: { open: '18:30', close: '22:30' },
                    wednesday: { open: '18:30', close: '22:30' },
                    thursday: { open: '18:30', close: '22:30' },
                    friday: { open: '18:30', close: '22:30' },
                    saturday: { open: '18:30', close: '22:30' },
                    sunday: { open: '18:30', close: '22:30' }
                },
                entryFee: {
                    adult: 4500000, // Tasting menu
                    child: 2000000,
                    senior: 4500000,
                    currency: 'VND'
                },
                recommendedDuration: { hours: 3, minutes: 0 },
                facilities: ['Chef table', 'Wine cellar tour', 'Private dining', 'Ocean view', 'Sommelier service'],
                accessibility: {
                    wheelchair: true,
                    publicTransport: false,
                    parking: true
                },
                ratings: { average: 4.9, count: 780 },
                status: 'active'
            },
            {
                name: 'Four Seasons Resort The Nam Hai - The Spa',
                description: 'Spa 5 sao với kiến trúc villa riêng biệt, liệu pháp truyền thống Việt Nam kết hợp kỹ thuật hiện đại. Có khu yoga view biển và meditation garden.',
                type: 'entertainment',
                location: {
                    address: 'Hà My Đông, Điện Bàn, Quảng Nam (gần Đà Nẵng)',
                    coordinates: {
                        latitude: 15.9396,
                        longitude: 108.1145
                    }
                },
                images: ['https://example.com/namhai1.jpg'],
                openingHours: {
                    monday: { open: '08:00', close: '21:00' },
                    tuesday: { open: '08:00', close: '21:00' },
                    wednesday: { open: '08:00', close: '21:00' },
                    thursday: { open: '08:00', close: '21:00' },
                    friday: { open: '08:00', close: '21:00' },
                    saturday: { open: '08:00', close: '21:00' },
                    sunday: { open: '08:00', close: '21:00' }
                },
                entryFee: {
                    adult: 6000000, // Full day spa package
                    child: 0,
                    senior: 6000000,
                    currency: 'VND'
                },
                recommendedDuration: { hours: 4, minutes: 0 },
                facilities: ['Private villa treatments', 'Hydrotherapy pools', 'Yoga pavilion', 'Meditation garden', 'Healthy cuisine', 'Beach access'],
                accessibility: {
                    wheelchair: true,
                    publicTransport: false,
                    parking: true
                },
                ratings: { average: 5.0, count: 560 },
                status: 'active'
            },
            {
                name: 'Yacht Charter Da Nang - Private Sunset Cruise',
                description: 'Thuê du thuyền riêng khám phá vịnh Đà Nẵng, ngắm hoàng hôn trên biển. Có dịch vụ fine dining onboard, DJ và butler service.',
                type: 'entertainment',
                location: {
                    address: 'Marina Complex, Bạch Đằng, Hải Châu, Đà Nẵng',
                    coordinates: {
                        latitude: 16.0544,
                        longitude: 108.2272
                    }
                },
                images: ['https://example.com/yacht1.jpg', 'https://example.com/yacht2.jpg'],
                openingHours: {
                    monday: { open: '14:00', close: '21:00' },
                    tuesday: { open: '14:00', close: '21:00' },
                    wednesday: { open: '14:00', close: '21:00' },
                    thursday: { open: '14:00', close: '21:00' },
                    friday: { open: '14:00', close: '22:00' },
                    saturday: { open: '14:00', close: '22:00' },
                    sunday: { open: '14:00', close: '21:00' }
                },
                entryFee: {
                    adult: 15000000, // 3-hour private charter (up to 12 pax)
                    child: 0,
                    senior: 15000000,
                    currency: 'VND'
                },
                recommendedDuration: { hours: 3, minutes: 0 },
                facilities: ['Private yacht', 'Fine dining', 'DJ/music system', 'Butler service', 'Water sports equipment', 'Bar'],
                accessibility: {
                    wheelchair: false,
                    publicTransport: false,
                    parking: true
                },
                ratings: { average: 4.9, count: 340 },
                status: 'active'
            },
            {
                name: 'Ba Na Hills - VIP Cable Car & French Village',
                description: 'Trải nghiệm VIP tại Bà Nà Hills với fast-track cable car, access to exclusive areas, fine dining và private tour guide. Khám phá làng Pháp cổ kính.',
                type: 'entertainment',
                location: {
                    address: 'Hòa Ninh, Hòa Vang, Đà Nẵng',
                    coordinates: {
                        latitude: 15.9959,
                        longitude: 107.9958
                    }
                },
                images: ['https://example.com/banahills1.jpg'],
                openingHours: {
                    monday: { open: '07:00', close: '22:00' },
                    tuesday: { open: '07:00', close: '22:00' },
                    wednesday: { open: '07:00', close: '22:00' },
                    thursday: { open: '07:00', close: '22:00' },
                    friday: { open: '07:00', close: '22:00' },
                    saturday: { open: '07:00', close: '22:00' },
                    sunday: { open: '07:00', close: '22:00' }
                },
                entryFee: {
                    adult: 2500000, // VIP package with meals
                    child: 1500000,
                    senior: 2000000,
                    currency: 'VND'
                },
                recommendedDuration: { hours: 6, minutes: 0 },
                facilities: ['VIP cable car', 'Private guide', 'Fine dining', 'Fast-track access', 'Lounge', 'Photography service'],
                accessibility: {
                    wheelchair: true,
                    publicTransport: false,
                    parking: true
                },
                ratings: { average: 4.7, count: 4200 },
                status: 'active'
            }
        ]
    },

    // ===== THỪA THIÊN HUẾ - LUXURY & CULTURAL =====
    {
        destination_name: 'Thừa Thiên Huế',
        pois: [
            {
                name: 'Ancient Hue Garden Houses - Private Royal Dinner',
                description: 'Trải nghiệm bữa tối hoàng gia trong nhà vườn cổ Huế, phục vụ ẩm thực cung đình với đội ngũ đầu bếp chuyên nghiệp. Có biểu diễn nhã nhạc cung đình UNESCO.',
                type: 'dining',
                location: {
                    address: 'Kim Long, Thành phố Huế',
                    coordinates: {
                        latitude: 16.4637,
                        longitude: 107.5909
                    }
                },
                images: ['https://example.com/hueroyaldinner1.jpg', 'https://example.com/hueroyaldinner2.jpg'],
                openingHours: {
                    monday: { open: '17:00', close: '21:00' },
                    tuesday: { open: '17:00', close: '21:00' },
                    wednesday: { open: '17:00', close: '21:00' },
                    thursday: { open: '17:00', close: '21:00' },
                    friday: { open: '17:00', close: '21:00' },
                    saturday: { open: '17:00', close: '21:00' },
                    sunday: { open: '17:00', close: '21:00' }
                },
                entryFee: {
                    adult: 3000000, // Royal dinner with performance
                    child: 1500000,
                    senior: 3000000,
                    currency: 'VND'
                },
                recommendedDuration: { hours: 3, minutes: 0 },
                facilities: ['Ancient garden house', 'Royal cuisine', 'Court music performance', 'Traditional costumes', 'Private dining', 'Cultural guide'],
                accessibility: {
                    wheelchair: false,
                    publicTransport: false,
                    parking: true
                },
                ratings: { average: 4.9, count: 520 },
                status: 'active'
            },
            {
                name: 'Azerai La Residence Hue - Le Parfum Restaurant',
                description: 'Nhà hàng fine dining trong khách sạn 5 sao bên sông Hương. Phục vụ ẩm thực fusion Việt-Pháp với nguyên liệu cao cấp, không gian art deco sang trọng.',
                type: 'dining',
                location: {
                    address: '5 Lê Lợi, Thành phố Huế',
                    coordinates: {
                        latitude: 16.4689,
                        longitude: 107.5932
                    }
                },
                images: ['https://example.com/leparfum1.jpg'],
                openingHours: {
                    monday: { open: '06:30', close: '22:30' },
                    tuesday: { open: '06:30', close: '22:30' },
                    wednesday: { open: '06:30', close: '22:30' },
                    thursday: { open: '06:30', close: '22:30' },
                    friday: { open: '06:30', close: '22:30' },
                    saturday: { open: '06:30', close: '22:30' },
                    sunday: { open: '06:30', close: '22:30' }
                },
                entryFee: {
                    adult: 2200000, // Set dinner menu
                    child: 1200000,
                    senior: 2200000,
                    currency: 'VND'
                },
                recommendedDuration: { hours: 2, minutes: 30 },
                facilities: ['Riverside dining', 'Wine cellar', 'Live music', 'Art deco décor', 'Valet parking'],
                accessibility: {
                    wheelchair: true,
                    publicTransport: true,
                    parking: true
                },
                ratings: { average: 4.8, count: 890 },
                status: 'active'
            },
            {
                name: 'Private Dragon Boat - Perfume River Cruise',
                description: 'Thuê thuyền rồng riêng khám phá sông Hương với dịch vụ VIP. Có ca Huế truyền thống, fine dining onboard và tham quan chùa Thiên Mụ.',
                type: 'cultural',
                location: {
                    address: 'Bến thuyền Tòa Khâm, Thành phố Huế',
                    coordinates: {
                        latitude: 16.4708,
                        longitude: 107.5775
                    }
                },
                images: ['https://example.com/dragonboat1.jpg', 'https://example.com/dragonboat2.jpg'],
                openingHours: {
                    monday: { open: '08:00', close: '20:00' },
                    tuesday: { open: '08:00', close: '20:00' },
                    wednesday: { open: '08:00', close: '20:00' },
                    thursday: { open: '08:00', close: '20:00' },
                    friday: { open: '08:00', close: '20:00' },
                    saturday: { open: '08:00', close: '20:00' },
                    sunday: { open: '08:00', close: '20:00' }
                },
                entryFee: {
                    adult: 5000000, // Private boat (up to 15 pax)
                    child: 0,
                    senior: 5000000,
                    currency: 'VND'
                },
                recommendedDuration: { hours: 4, minutes: 0 },
                facilities: ['Private dragon boat', 'Traditional music', 'Fine dining', 'Professional guide', 'Photo service', 'Temple visit'],
                accessibility: {
                    wheelchair: false,
                    publicTransport: false,
                    parking: true
                },
                ratings: { average: 4.8, count: 410 },
                status: 'active'
            }
        ]
    },

    // ===== KHÁNH HÒA (NHA TRANG) - LUXURY =====
    {
        destination_name: 'Khánh Hòa',
        pois: [
            {
                name: 'Six Senses Ninh Van Bay - Dining by Design',
                description: 'Trải nghiệm ăn tối riêng tư trên bãi biển hoặc trên đảo, với chef riêng và menu tùy chỉnh. Có thể chọn setup trên thuyền, trong hang động hoặc jungle.',
                type: 'dining',
                location: {
                    address: 'Ninh Vân Bay, Ninh Hòa, Khánh Hòa',
                    coordinates: {
                        latitude: 12.4583,
                        longitude: 109.1833
                    }
                },
                images: ['https://example.com/sixsenses1.jpg', 'https://example.com/sixsenses2.jpg'],
                openingHours: {
                    monday: { open: '00:00', close: '23:59' },
                    tuesday: { open: '00:00', close: '23:59' },
                    wednesday: { open: '00:00', close: '23:59' },
                    thursday: { open: '00:00', close: '23:59' },
                    friday: { open: '00:00', close: '23:59' },
                    saturday: { open: '00:00', close: '23:59' },
                    sunday: { open: '00:00', close: '23:59' }
                },
                entryFee: {
                    adult: 8000000, // Private dining experience for 2
                    child: 4000000,
                    senior: 8000000,
                    currency: 'VND'
                },
                recommendedDuration: { hours: 3, minutes: 0 },
                facilities: ['Private beach setup', 'Personal chef', 'Custom menu', 'Butler service', 'Romantic décor', 'Photography'],
                accessibility: {
                    wheelchair: false,
                    publicTransport: false,
                    parking: true
                },
                ratings: { average: 5.0, count: 290 },
                status: 'active'
            },
            {
                name: 'Vinpearl Luxury Nha Trang - Vincharm Spa',
                description: 'Spa 5 sao trên đảo riêng với liệu pháp cao cấp, sử dụng sản phẩm Aromatherapy Associates. Có phòng couple suite với view biển panoramic.',
                type: 'entertainment',
                location: {
                    address: 'Đảo Hòn Tre, Vĩnh Nguyên, Nha Trang',
                    coordinates: {
                        latitude: 12.2146,
                        longitude: 109.1864
                    }
                },
                images: ['https://example.com/vincharmspa1.jpg'],
                openingHours: {
                    monday: { open: '09:00', close: '21:00' },
                    tuesday: { open: '09:00', close: '21:00' },
                    wednesday: { open: '09:00', close: '21:00' },
                    thursday: { open: '09:00', close: '21:00' },
                    friday: { open: '09:00', close: '21:00' },
                    saturday: { open: '09:00', close: '21:00' },
                    sunday: { open: '09:00', close: '21:00' }
                },
                entryFee: {
                    adult: 4500000, // Premium spa package
                    child: 0,
                    senior: 4500000,
                    currency: 'VND'
                },
                recommendedDuration: { hours: 3, minutes: 0 },
                facilities: ['Ocean view suites', 'Hydrotherapy', 'Sauna & steam', 'Relaxation lounge', 'Premium products', 'Couple treatments'],
                accessibility: {
                    wheelchair: true,
                    publicTransport: false,
                    parking: true
                },
                ratings: { average: 4.8, count: 1120 },
                status: 'active'
            },
            {
                name: 'Scuba Diving & Underwater Photography - Professional',
                description: 'Lặn biển chuyên nghiệp với hướng dẫn viên PADI, khám phá rạn san hô và đại dương sâu. Có dịch vụ chụp ảnh dưới nước chuyên nghiệp và equipment cao cấp.',
                type: 'entertainment',
                location: {
                    address: 'Sailing Club, 72-74 Trần Phú, Nha Trang',
                    coordinates: {
                        latitude: 12.2388,
                        longitude: 109.1967
                    }
                },
                images: ['https://example.com/scuba1.jpg', 'https://example.com/scuba2.jpg'],
                openingHours: {
                    monday: { open: '07:00', close: '18:00' },
                    tuesday: { open: '07:00', close: '18:00' },
                    wednesday: { open: '07:00', close: '18:00' },
                    thursday: { open: '07:00', close: '18:00' },
                    friday: { open: '07:00', close: '18:00' },
                    saturday: { open: '07:00', close: '18:00' },
                    sunday: { open: '07:00', close: '18:00' }
                },
                entryFee: {
                    adult: 3500000, // Advanced diving + photography
                    child: 2500000,
                    senior: 3500000,
                    currency: 'VND'
                },
                recommendedDuration: { hours: 5, minutes: 0 },
                facilities: ['PADI instructors', 'Professional equipment', 'Underwater photography', 'Boat transfer', 'Lunch included', 'Safety gear'],
                accessibility: {
                    wheelchair: false,
                    publicTransport: true,
                    parking: true
                },
                ratings: { average: 4.9, count: 780 },
                status: 'active'
            }
        ]
    }
];

async function seedPremiumPOIs() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        let totalCreated = 0;
        let totalSkipped = 0;

        for (const destinationData of premiumPOIs) {
            // Find destination by name
            const destination = await Destination.findOne({
                destination_name: destinationData.destination_name
            });

            if (!destination) {
                console.log(`❌ Destination not found: ${destinationData.destination_name}`);
                continue;
            }

            console.log(`\n🏙️  Processing: ${destinationData.destination_name} (ID: ${destination._id})`);

            for (const poiData of destinationData.pois) {
                // Check if POI already exists
                const existingPOI = await PointOfInterest.findOne({
                    destinationId: destination._id,
                    name: poiData.name
                });

                if (existingPOI) {
                    console.log(`   ⏭️  Skipped (exists): ${poiData.name}`);
                    totalSkipped++;
                    continue;
                }

                // Create new POI
                const newPOI = new PointOfInterest({
                    ...poiData,
                    destinationId: destination._id
                });

                await newPOI.save();
                console.log(`   ✅ Created: ${poiData.name} (${poiData.entryFee.adult.toLocaleString()} VND)`);
                totalCreated++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 SEEDING SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Total POIs created: ${totalCreated}`);
        console.log(`⏭️  Total POIs skipped: ${totalSkipped}`);
        console.log('='.repeat(60));

        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        await mongoose.connection.close();
        process.exit(1);
    }
}

// Run seeder
seedPremiumPOIs();
