#!/bin/bash

# Backup existing .model.js files if needed
# Then rename all CamelCase.js to lowercase.model.js

mv -f Booking.js booking.model.js 2>/dev/null
mv -f BookingPassenger.js booking-passenger.model.js 2>/dev/null
mv -f BudgetBreakdown.js budget-breakdown.model.js 2>/dev/null
mv -f Destination.js destination.model.js 2>/dev/null
mv -f Flight.js flight.model.js 2>/dev/null
mv -f FlightBooking.js flight-booking.model.js 2>/dev/null
mv -f FlightClass.js flight-class.model.js 2>/dev/null
mv -f FlightSchedule.js flight-schedule.model.js 2>/dev/null
mv -f FlightSeat.js flight-seat.model.js 2>/dev/null
mv -f Itinerary.js itinerary.model.js 2>/dev/null
mv -f ItineraryActivity.js itinerary-activity.model.js 2>/dev/null
mv -f Payment.js payment.model.js 2>/dev/null
mv -f PointOfInterest.js point-of-interest.model.js 2>/dev/null
mv -f Review.js review.model.js 2>/dev/null
mv -f Room.js room.model.js 2>/dev/null
mv -f ServiceProcess.js service-process.model.js 2>/dev/null
mv -f ServiceProvider.js service-provider.model.js 2>/dev/null
mv -f Tour.js tour.model.js 2>/dev/null
mv -f TourBooking.js tour-booking.model.js 2>/dev/null
mv -f User.js user-main.model.js 2>/dev/null

# Remove old Hotel.js, keep hotel.model.js
rm -f Hotel.js 2>/dev/null

echo "✅ All models renamed successfully!"
ls -1 *.model.js
