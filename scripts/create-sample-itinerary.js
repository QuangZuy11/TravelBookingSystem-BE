const mongoose = require('mongoose');
const Tour = require('../models/tour.model');
const Itinerary = require('../models/itinerary.model');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/TravelBookingSystem', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function createSampleItinerary() {
  try {
    console.log('🔍 Finding tours without itineraries...');
    
    // Find a tour that doesn't have itineraries
    const tours = await Tour.find({}).limit(5);
    console.log(`Found ${tours.length} tours`);
    
    for (const tour of tours) {
      console.log(`\n📋 Processing tour: ${tour.title} (ID: ${tour._id})`);
      
      // Check if tour already has itineraries
      const existingItineraries = await Itinerary.find({ tour_id: tour._id });
      console.log(`  - Existing itineraries: ${existingItineraries.length}`);
      
      if (existingItineraries.length === 0) {
        console.log('  - Creating sample itineraries...');
        
        // Create sample itineraries for this tour
        const sampleItineraries = [
          {
            tour_id: tour._id,
            day: 1,
            title: "Ngày 1 - Khởi hành và tham quan",
            description: "Bắt đầu hành trình khám phá với những điểm đến hấp dẫn nhất",
            activities: [
              "Đón khách tại sân bay/khách sạn",
              "Tham quan khu vực trung tâm thành phố",
              "Ăn trưa tại nhà hàng địa phương",
              "Tham quan di tích lịch sử",
              "Nghỉ ngơi tại khách sạn"
            ]
          },
          {
            tour_id: tour._id,
            day: 2,
            title: "Ngày 2 - Khám phá văn hóa",
            description: "Tìm hiểu về văn hóa và truyền thống địa phương",
            activities: [
              "Ăn sáng tại khách sạn",
              "Tham quan bảo tàng văn hóa",
              "Tham gia workshop truyền thống",
              "Ăn trưa với món ăn đặc sản",
              "Mua sắm tại chợ địa phương",
              "Thưởng thức show văn hóa buổi tối"
            ]
          },
          {
            tour_id: tour._id,
            day: 3,
            title: "Ngày 3 - Thiên nhiên và cảnh quan",
            description: "Khám phá vẻ đẹp thiên nhiên và cảnh quan tuyệt đẹp",
            activities: [
              "Khởi hành sớm đi tham quan thiên nhiên",
              "Trekking/đi bộ khám phá",
              "Ăn trưa picnic ngoài trời",
              "Chụp ảnh tại các điểm check-in",
              "Trở về khách sạn",
              "Ăn tối và nghỉ ngơi"
            ]
          }
        ];
        
        // Create itineraries
        for (const itineraryData of sampleItineraries) {
          const itinerary = new Itinerary(itineraryData);
          await itinerary.save();
          console.log(`    ✅ Created itinerary: ${itinerary.title}`);
        }
        
        console.log(`  ✅ Created ${sampleItineraries.length} itineraries for tour: ${tour.title}`);
        break; // Only create for one tour
      } else {
        console.log(`  - Tour already has ${existingItineraries.length} itineraries`);
      }
    }
    
    console.log('\n🎉 Sample itinerary creation completed!');
    
  } catch (error) {
    console.error('❌ Error creating sample itineraries:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the script
createSampleItinerary();
