const Itinerary = require('../models/itinerary.model');
const AiItineraryRequest = require('../models/ai_itinerary_request.model');
const AiGeneratedItinerary = require('../models/ai_generated_itineraries.model');
const aiService = require('../services/ai.service');

const aiItineraryController = {
  // Get all AI itineraries for a user
  async getUserItineraries(req, res) {
    try {
      const { userId } = req.params;

      console.log('🔍 Getting AI itineraries for user:', userId);

      // Find all AI generated itineraries for this user
      const aiItineraries = await AiGeneratedItinerary.find({ user_id: userId })
        .populate('request_id') // Populate full request data
        .populate('destination_id', 'name country province image_url')
        .sort({ created_at: -1 }); // Most recent first

      // Get all requests for this user
      const requests = await AiItineraryRequest.find({ user_id: userId })
        .sort({ created_at: -1 });

      if (!aiItineraries || aiItineraries.length === 0) {
        return res.json({
          success: true,
          message: 'No AI itineraries found for this user',
          data: {
            requests: requests || [],
            itineraries: []
          }
        });
      }

      // For each AI itinerary, check if it has customized version and format for frontend
      const itinerariesWithStatus = await Promise.all(
        aiItineraries.map(async (aiItinerary) => {
          // Check if user has customized this itinerary
          const customizedItinerary = await Itinerary.findOne({
            origin_id: aiItinerary._id,
            user_id: userId,
            type: 'customized'
          });

          return {
            _id: aiItinerary._id, // Frontend expects _id field
            aiGeneratedId: aiItinerary._id,
            request_id: aiItinerary.request_id || null, // Nested request info
            destination: aiItinerary.destination || aiItinerary.destination_id?.name || aiItinerary.request_id?.destination || 'Unknown',
            duration_days: aiItinerary.duration_days || aiItinerary.request_id?.duration_days || 'N/A',
            budget_total: aiItinerary.budget_total || aiItinerary.request_id?.budget_total || 0,
            budget_level: aiItinerary.request_id?.budget_level || 'medium',
            participant_number: aiItinerary.participant_number || aiItinerary.request_id?.participant_number || 1,
            preferences: aiItinerary.preferences || aiItinerary.request_id?.preferences || [],
            summary: aiItinerary.summary || `${aiItinerary.duration_days || aiItinerary.request_id?.duration_days || 'N/A'} days trip`,
            created_at: aiItinerary.created_at,
            updated_at: aiItinerary.updated_at,
            hasCustomized: !!customizedItinerary,
            customizedId: customizedItinerary?._id || null,
            status: aiItinerary.status || 'done'
          };
        })
      );

      res.json({
        success: true,
        message: `Found ${itinerariesWithStatus.length} AI itineraries`,
        data: {
          requests: requests || [],
          itineraries: itinerariesWithStatus
        }
      });

    } catch (error) {
      console.error('❌ Error getting user AI itineraries:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user AI itineraries',
        error: error.message
      });
    }
  },

  // Get AI itinerary details (combines original and request info for frontend)
  async getItineraryDetails(req, res) {
    try {
      const { aiGeneratedId } = req.params;
      const userId = req.user.id;

      console.log('🔍 Getting AI itinerary details for:', aiGeneratedId);

      // Get AI generated itinerary with request info
      const aiItinerary = await AiGeneratedItinerary.findById(aiGeneratedId)
        .populate('request_id')
        .populate('destination_id', 'name country province image_url');

      if (!aiItinerary) {
        return res.status(404).json({
          success: false,
          message: 'AI itinerary not found'
        });
      }

      // Check if user owns this itinerary
      if (aiItinerary.user_id.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view your own itineraries.'
        });
      }

      // Check if this is original or customized AI record
      const isCustomized = aiItinerary.status === 'custom';

      if (isCustomized) {
        // This is a customized AI record - get its days directly
        const customizedDays = await Itinerary.find({
          origin_id: aiGeneratedId,
          type: 'customized'
        }).sort({ day_number: 1 });

        const customizedTotalCost = customizedDays.reduce((sum, day) => sum + day.day_total, 0);

        // Set cache control headers to ensure fresh data
        res.set({
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Surrogate-Control': 'no-store'
        });

        return res.json({
          success: true,
          data: {
            aiGeneratedId: aiItinerary._id,
            request: aiItinerary.request_id,
            destination: aiItinerary.destination || aiItinerary.destination_id?.name || aiItinerary.request_id?.destination || 'Unknown',
            duration: aiItinerary.duration_days || aiItinerary.request_id?.duration_days || 0,
            budget: aiItinerary.budget_total || aiItinerary.request_id?.budget_total || 0,
            participants: aiItinerary.participant_number || aiItinerary.request_id?.participant_number || 1,
            preferences: aiItinerary.preferences || aiItinerary.request_id?.preferences || [],
            summary: aiItinerary.summary,
            status: aiItinerary.status,
            created_at: aiItinerary.created_at,
            isOriginal: false,
            isCustomizable: true,
            totalCost: customizedTotalCost,
            lastUpdated: new Date().toISOString(), // Add timestamp for cache busting
            days: customizedDays.map(day => {
              const formatted = Itinerary.formatResponse(day);
              return {
                dayNumber: day.day_number,
                dayId: day._id,
                theme: day.title,
                description: day.description,
                activities: formatted.activities, // ✅ Use unified formatting
                dayTotal: day.day_total,
                type: day.type,
                originId: day.origin_id,
                userModified: day.user_modified
              };
            })
          }
        });
      }

      // This is an original AI record - get original days and check for customized version
      const originalDays = await Itinerary.find({
        origin_id: aiGeneratedId,
        type: 'ai_gen'
      }).sort({ day_number: 1 });

      // Find customized version by matching request_id
      const customizedAiRecord = await AiGeneratedItinerary.findOne({
        request_id: aiItinerary.request_id,
        status: 'custom'
      });

      let customizedDays = [];
      if (customizedAiRecord) {
        customizedDays = await Itinerary.find({
          origin_id: customizedAiRecord._id,
          type: 'customized'
        }).sort({ day_number: 1 });
      }

      const totalCost = originalDays.reduce((sum, day) => sum + day.day_total, 0);
      const customizedTotalCost = customizedDays.reduce((sum, day) => sum + day.day_total, 0);

      const response = {
        aiGeneratedId: aiItinerary._id,
        request: aiItinerary.request_id,
        destination: aiItinerary.destination || aiItinerary.destination_id?.name || aiItinerary.request_id?.destination || 'Unknown',
        duration: aiItinerary.duration_days || aiItinerary.request_id?.duration_days || 0,
        budget: aiItinerary.budget_total || aiItinerary.request_id?.budget_total || 0,
        participants: aiItinerary.participant_number || aiItinerary.request_id?.participant_number || 1,
        preferences: aiItinerary.preferences || aiItinerary.request_id?.preferences || [],
        summary: aiItinerary.summary,
        status: aiItinerary.status,
        created_at: aiItinerary.created_at,
        isOriginal: true,
        isCustomizable: true,

        // Original AI version
        original: {
          totalCost: totalCost,
          days: originalDays.map(day => {
            const formatted = Itinerary.formatResponse(day);
            return {
              dayNumber: day.day_number,
              dayId: day._id,
              theme: day.title,
              description: day.description,
              activities: formatted.activities, // ✅ Use unified formatting
              dayTotal: day.day_total,
              type: day.type,
              originId: day.origin_id
            };
          })
        },

        // Customization status
        hasCustomized: customizedDays.length > 0,
        customized: customizedDays.length > 0 ? {
          totalCost: customizedTotalCost,
          days: customizedDays.map(day => {
            const formatted = Itinerary.formatResponse(day);
            return {
              dayNumber: day.day_number,
              dayId: day._id,
              theme: day.title,
              description: day.description,
              activities: formatted.activities, // ✅ Use unified formatting
              dayTotal: day.day_total,
              type: day.type,
              originId: day.origin_id,
              userModified: day.user_modified
            };
          })
        } : null
      };

      res.json({
        success: true,
        data: response
      });

    } catch (error) {
      console.error('❌ Error getting AI itinerary details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get AI itinerary details',
        error: error.message
      });
    }
  },

  // Generate AI itinerary following new architecture:
  // AI_ITINERARY_REQUESTS → AI_GENERATED_ITINERARIES → ITINERARIES (origin_id = AI_GENERATED_ITINERARIES._id, type = ai_gen)
  async generateFromPayload(req, res) {
    try {
      const userId = req.user.id;

      // Support both frontend formats:
      // Format 1: { destination, duration, budget, travelers, preferences }
      // Format 2: { destination, duration_days, budget_level, participant_number, preferences }
      const destination = req.body.destination;
      const duration = req.body.duration || req.body.duration_days;
      const travelers = req.body.travelers || req.body.participant_number;
      const preferences = req.body.preferences || [];

      // Handle budget: convert budget_level to actual budget or use provided budget
      let budget = req.body.budget;
      if (!budget && req.body.budget_level) {
        const budgetMapping = {
          'low': 2000000,
          'medium': 5000000,
          'high': 10000000
        };
        budget = budgetMapping[req.body.budget_level] || 5000000;
      }
      budget = budget || 5000000; // Default budget

      console.log('🚀 Generating AI itinerary with final unified architecture...');
      console.log('📋 Request data:', { destination, duration, budget, travelers, preferences });

      // Step 1: Create AI request record
      const aiRequest = new AiItineraryRequest({
        user_id: userId,
        destination: destination,
        duration_days: duration,
        participant_number: travelers,
        budget_total: budget,
        preferences: preferences || [],
        status: 'processing'
      });

      await aiRequest.save();

      // Step 2: Generate AI response
      const aiResponse = await aiService.generateItinerary({
        destination,
        duration,
        budget,
        interests: preferences || [],
        participant_number: travelers,
        user_id: userId
      });

      // Step 3: Create AI_GENERATED_ITINERARIES record
      const aiGeneratedItinerary = new AiGeneratedItinerary({
        request_id: aiRequest._id,
        user_id: userId, // Add user_id for getUserItineraries query
        destination: destination,
        duration_days: duration,
        budget_total: budget,
        participant_number: travelers,
        preferences: preferences || [],
        itinerary_data: aiResponse,
        summary: `${duration} days in ${destination}`,
        status: 'done'
      });

      await aiGeneratedItinerary.save();

      // Step 4: Create ITINERARIES records with origin_id = AI_GENERATED_ITINERARIES._id, type = ai_gen
      const dayRecords = [];
      let totalCost = 0;

      for (let dayIndex = 0; dayIndex < aiResponse.days.length; dayIndex++) {
        const dayData = aiResponse.days[dayIndex];
        const dayNumber = dayIndex + 1;

        const itinerary = Itinerary.createFromAIGenerated(
          aiGeneratedItinerary._id, // origin_id = AI_GENERATED_ITINERARIES._id
          dayNumber,
          dayData
        );

        await itinerary.save();
        dayRecords.push(itinerary);
        totalCost += itinerary.day_total;
      }

      // Step 5: Update request as completed
      aiRequest.status = 'completed';
      aiRequest.ai_response = {
        destination,
        duration,
        totalCost,
        generatedAt: new Date()
      };
      await aiRequest.save();

      console.log(`✅ Generated ${dayRecords.length} day records with origin_id=${aiGeneratedItinerary._id}, type=ai_gen`);

      const response = {
        requestId: aiRequest._id,
        aiGeneratedId: aiGeneratedItinerary._id,
        destination: destination,
        duration: duration,
        totalCost: totalCost,
        days: dayRecords.map(day => ({
          dayNumber: day.day_number,
          dayId: day._id,
          theme: day.title,
          description: day.description,
          activities: day.activities,
          dayTotal: day.day_total,
          type: day.type,
          originId: day.origin_id
        }))
      };

      res.json({
        success: true,
        message: 'Tạo lịch trình AI thành công',
        data: response
      });

    } catch (error) {
      console.error('❌ Error generating AI itinerary:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi tạo lịch trình AI',
        error: error.message
      });
    }
  },

  // Get original AI itinerary (type='ai_gen')
  async getOriginalItinerary(req, res) {
    try {
      const { aiGeneratedId } = req.params;

      const originalDays = await Itinerary.find({
        origin_id: aiGeneratedId,
        type: 'ai_gen'
      }).sort({ day_number: 1 });

      if (!originalDays.length) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy lịch trình AI'
        });
      }

      const totalCost = originalDays.reduce((sum, day) => sum + day.day_total, 0);

      res.json({
        success: true,
        data: {
          aiGeneratedId: aiGeneratedId,
          isOriginal: true,
          isCustomizable: false,
          totalCost: totalCost,
          days: originalDays.map(day => ({
            dayNumber: day.day_number,
            dayId: day._id,
            theme: day.title,
            description: day.description,
            activities: day.activities,
            dayTotal: day.day_total,
            type: day.type,
            originId: day.origin_id,
            userModified: day.user_modified
          }))
        }
      });

    } catch (error) {
      console.error('❌ Error getting original itinerary:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy lịch trình gốc',
        error: error.message
      });
    }
  },

  // Get customizable version (type='customized')
  async getCustomizableItinerary(req, res) {
    try {
      const { aiGeneratedId } = req.params;

      const customizedDays = await Itinerary.find({
        origin_id: aiGeneratedId,
        type: 'customized'
      }).sort({ day_number: 1 });

      if (!customizedDays.length) {
        return res.status(404).json({
          success: false,
          message: 'Chưa có phiên bản tùy chỉnh',
          needsInitialization: true
        });
      }

      const totalCost = customizedDays.reduce((sum, day) => sum + day.day_total, 0);

      res.json({
        success: true,
        data: {
          aiGeneratedId: aiGeneratedId,
          isOriginal: false,
          isCustomizable: true,
          totalCost: totalCost,
          days: customizedDays.map(day => {
            const formatted = Itinerary.formatResponse(day);
            return {
              dayNumber: day.day_number,
              dayId: day._id,
              theme: day.title,
              description: day.description,
              activities: formatted.activities, // ✅ Use unified formatting
              dayTotal: day.day_total,
              type: day.type,
              originId: day.origin_id,
              userModified: day.user_modified
            };
          })
        }
      });

    } catch (error) {
      console.error('❌ Error getting customizable itinerary:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy phiên bản tùy chỉnh',
        error: error.message
      });
    }
  },

  // Initialize customization (clone ai_gen → customized with same origin_id)
  async initializeCustomization(req, res) {
    try {
      const { aiGeneratedId } = req.params;

      // Check if customized version already exists
      const existingCustomized = await Itinerary.findOne({
        origin_id: aiGeneratedId,
        type: 'customized'
      });

      if (existingCustomized) {
        return res.json({
          success: true,
          message: 'Phiên bản tùy chỉnh đã tồn tại',
          data: { aiGeneratedId, alreadyExists: true }
        });
      }

      // Get original AI days (type='ai_gen')
      const originalDays = await Itinerary.find({
        origin_id: aiGeneratedId,
        type: 'ai_gen'
      }).sort({ day_number: 1 });

      if (!originalDays.length) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy lịch trình AI gốc'
        });
      }

      // Create customized copies (same origin_id, type='customized')
      const customizedDays = [];
      for (const originalDay of originalDays) {
        const customizedDay = Itinerary.createCustomizedCopy(originalDay);
        await customizedDay.save();
        customizedDays.push(customizedDay);
      }

      console.log(`✅ Cloned ${customizedDays.length} ai_gen → customized records (same origin_id: ${aiGeneratedId})`);

      res.json({
        success: true,
        message: 'Khởi tạo phiên bản tùy chỉnh thành công',
        data: {
          aiGeneratedId: aiGeneratedId,
          customizableDays: customizedDays.length,
          message: 'Bạn có thể bắt đầu tùy chỉnh lịch trình'
        }
      });

    } catch (error) {
      console.error('❌ Error initializing customization:', error);

      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Phiên bản tùy chỉnh đã tồn tại',
          error: 'Duplicate customization'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Lỗi khi khởi tạo tùy chỉnh',
        error: error.message
      });
    }
  },

  // Unified customize endpoint - handles both initialization, retrieval, and UPDATE
  async customizeItinerary(req, res) {
    try {
      const { aiGeneratedId } = req.params;
      const hasUpdateData = req.body && Object.keys(req.body).length > 0;

      console.log('🔧 customizeItinerary called:', { aiGeneratedId, hasUpdateData, bodyKeys: Object.keys(req.body || {}) });

      // First, check if the provided ID is already a customized AI record
      const providedAiRecord = await AiGeneratedItinerary.findById(aiGeneratedId);
      if (providedAiRecord && providedAiRecord.status === 'custom') {
        // This is already a customized AI record, return it directly
        const customizedDays = await Itinerary.find({
          origin_id: aiGeneratedId,
          type: 'customized'
        }).sort({ day_number: 1 });

        const totalCost = customizedDays.reduce((sum, day) => sum + day.day_total, 0);

        // Try to find original AI record by request_id
        let originalAiGeneratedId = null;
        if (providedAiRecord.request_id) {
          const originalAiRecord = await AiGeneratedItinerary.findOne({
            request_id: providedAiRecord.request_id,
            status: 'done'
          });
          originalAiGeneratedId = originalAiRecord ? originalAiRecord._id : null;
        }

        // Handle UPDATE for customized AI record if payload provided
        if (hasUpdateData && req.body.itinerary_data) {
          console.log('🔄 Updating existing customized itinerary...');

          const updatedDays = req.body.itinerary_data;

          // Update each day's data
          for (const dayUpdate of updatedDays) {
            console.log('🔍 Processing dayUpdate:', {
              dayId: dayUpdate.dayId,
              theme: dayUpdate.theme,
              activitiesCount: dayUpdate.activities?.length
            });

            const dayToUpdate = await Itinerary.findById(dayUpdate.dayId);
            if (dayToUpdate && dayToUpdate.origin_id.toString() === aiGeneratedId) {
              console.log('📝 Found day to update:', dayToUpdate._id);

              // Update day fields
              if (dayUpdate.theme) {
                console.log(`🔄 Updating theme: "${dayToUpdate.title}" → "${dayUpdate.theme}"`);
                dayToUpdate.title = dayUpdate.theme;
              }
              if (dayUpdate.description !== undefined) dayToUpdate.description = dayUpdate.description;

              // Handle activities array update carefully
              if (dayUpdate.activities && Array.isArray(dayUpdate.activities)) {
                console.log('🔄 Updating activities for day', dayUpdate.dayNumber);
                console.log('📊 Activities data:', dayUpdate.activities.map(a => ({
                  activityId: a.activityId,
                  activity: a.activity,
                  duration: a.duration,
                  cost: a.cost,
                  type: a.type
                })));

                // ✅ UNIFIED VALIDATION: Use schema static method
                const validation = Itinerary.validateActivities(dayUpdate.activities, 'ai_gen');
                if (!validation.valid) {
                  console.log('❌ Activities validation failed:', validation.error);
                  throw new Error(`Activities validation failed: ${validation.error}`);
                }

                // ✅ UNIFIED NORMALIZATION: Use schema static method  
                const normalizedActivities = Itinerary.normalizeActivities(dayUpdate.activities, 'ai_gen');

                console.log('✅ Activities normalized:', normalizedActivities.map(a => ({
                  activityId: a.activityId,
                  activity: a.activity,
                  activityType: a.activityType,
                  duration: a.duration,
                  cost: a.cost,
                  userModified: a.userModified
                })));

                dayToUpdate.activities = normalizedActivities;

                // ✅ AUTO-CALCULATE dayTotal from activities
                const calculatedDayTotal = normalizedActivities.reduce((sum, activity) => {
                  return sum + (activity.cost || 0);
                }, 0);
                dayToUpdate.day_total = calculatedDayTotal;

                console.log(`💰 Auto-calculated dayTotal: ${calculatedDayTotal} (from ${normalizedActivities.length} activities)`);
              }

              // If dayTotal is explicitly provided, use it (override auto-calculation)
              if (dayUpdate.dayTotal !== undefined && dayUpdate.dayTotal !== null) {
                dayToUpdate.day_total = dayUpdate.dayTotal;
                console.log(`💰 Using explicit dayTotal: ${dayUpdate.dayTotal}`);
              }

              // Mark as user modified
              dayToUpdate.user_modified = true;
              dayToUpdate.updated_at = new Date();

              try {
                await dayToUpdate.save();
                console.log(`✅ Updated customized day ${dayUpdate.dayNumber}: ${dayUpdate.theme}`);
                console.log(`💾 Saved with ${dayToUpdate.activities?.length || 0} activities`);
              } catch (saveError) {
                console.error(`❌ Error saving day ${dayUpdate.dayNumber}:`, saveError.message);
                throw saveError;
              }
            } else {
              console.log('❌ Day not found or wrong origin_id:', {
                dayId: dayUpdate.dayId,
                found: !!dayToUpdate,
                expectedOrigin: aiGeneratedId,
                actualOrigin: dayToUpdate?.origin_id
              });
            }
          }

          // Update AI record summary if provided
          if (req.body.summary) {
            providedAiRecord.summary = req.body.summary;
            providedAiRecord.updated_at = new Date();
            await providedAiRecord.save();
            console.log('✅ Updated customized AI record summary');
          }

          // Get fresh updated data
          const updatedCustomizedDays = await Itinerary.find({
            origin_id: aiGeneratedId,
            type: 'customized'
          }).sort({ day_number: 1 });

          const updatedTotalCost = updatedCustomizedDays.reduce((sum, day) => sum + day.day_total, 0);

          // Set cache control headers to prevent caching
          res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Surrogate-Control': 'no-store'
          });

          return res.json({
            success: true,
            message: 'Cập nhật lịch trình tùy chỉnh thành công',
            data: {
              aiGeneratedId: aiGeneratedId,
              originalAiGeneratedId: originalAiGeneratedId,
              isOriginal: false,
              isCustomizable: true,
              totalCost: updatedTotalCost,
              destination: providedAiRecord.destination,
              duration_days: providedAiRecord.duration_days,
              days: updatedCustomizedDays.map(day => ({
                dayNumber: day.day_number,
                dayId: day._id,
                theme: day.title,
                description: day.description,
                activities: day.activities,
                dayTotal: day.day_total,
                type: day.type,
                originId: day.origin_id,
                userModified: day.user_modified
              }))
            }
          });
        }

        // Set cache control headers to prevent caching
        res.set({
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Surrogate-Control': 'no-store'
        });

        return res.json({
          success: true,
          message: 'Lấy phiên bản tùy chỉnh thành công',
          data: {
            aiGeneratedId: aiGeneratedId,
            originalAiGeneratedId: originalAiGeneratedId, // Track the original AI record
            isOriginal: false,
            isCustomizable: true,
            totalCost: totalCost,
            destination: providedAiRecord.destination,
            duration_days: providedAiRecord.duration_days,
            days: customizedDays.map(day => ({
              dayNumber: day.day_number,
              dayId: day._id,
              theme: day.title,
              description: day.description,
              activities: day.activities,
              dayTotal: day.day_total,
              type: day.type,
              originId: day.origin_id,
              userModified: day.user_modified
            }))
          }
        });
      }

      // Check if customized AI record already exists (based on request_id)
      const originalAiRecord = await AiGeneratedItinerary.findById(aiGeneratedId);
      if (!originalAiRecord) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy bản ghi AI gốc'
        });
      }

      // Find existing customized AI record with same request_id but status 'custom'
      let customizedAiRecord = await AiGeneratedItinerary.findOne({
        request_id: originalAiRecord.request_id,
        status: 'custom'
      });

      let customizedDays = [];

      // If no customized version exists, initialize it
      if (!customizedAiRecord) {
        console.log(`🔄 No customized version found for ${aiGeneratedId}, initializing...`);

        // Get original AI days (type='ai_gen')
        const originalDays = await Itinerary.find({
          origin_id: aiGeneratedId,
          type: 'ai_gen'
        }).sort({ day_number: 1 });

        if (!originalDays.length) {
          return res.status(404).json({
            success: false,
            message: 'Không tìm thấy lịch trình AI gốc'
          });
        }

        // 1. Clone AI_GENERATED_ITINERARIES record (create new record with custom status)
        const customizedAiData = {
          ...originalAiRecord.toObject(),
          _id: undefined, // Remove _id to create new record
          status: 'custom', // Change status to indicate customized version
          created_at: new Date(),
          updated_at: new Date()
        };
        customizedAiRecord = new AiGeneratedItinerary(customizedAiData);
        await customizedAiRecord.save();

        console.log(`✅ Created customized AI record: ${customizedAiRecord._id}`);

        // 2. Clone ITINERARIES records (keep original, create new customized versions)
        customizedDays = []; // Initialize array for customized days
        for (const originalDay of originalDays) {
          const customizedDay = Itinerary.createCustomizedCopy(originalDay);
          customizedDay.origin_id = customizedAiRecord._id; // Point to new customized AI record
          customizedDay.type = 'customized';
          await customizedDay.save();
          customizedDays.push(customizedDay);
        }

        console.log(`✅ Cloned ${customizedDays.length} ITINERARIES records to customized AI record: ${customizedAiRecord._id}`);
      } else {
        // Get existing customized days
        customizedDays = await Itinerary.find({
          origin_id: customizedAiRecord._id,
          type: 'customized'
        }).sort({ day_number: 1 });

        console.log(`✅ Found existing customized version: ${customizedAiRecord._id} with ${customizedDays.length} days`);
      }

      // Handle UPDATE request if payload provided
      if (hasUpdateData && req.body.itinerary_data) {
        console.log('🔄 Updating customized itinerary with new data...');

        const updatedDays = req.body.itinerary_data;

        // Update each day's data
        for (const dayUpdate of updatedDays) {
          const dayToUpdate = await Itinerary.findById(dayUpdate.dayId);
          if (dayToUpdate && dayToUpdate.origin_id.toString() === (customizedAiRecord ? customizedAiRecord._id.toString() : aiGeneratedId)) {
            // Update day fields
            if (dayUpdate.theme) dayToUpdate.title = dayUpdate.theme;
            if (dayUpdate.description !== undefined) dayToUpdate.description = dayUpdate.description;

            // ✅ UNIFIED ACTIVITIES HANDLING: Use schema static methods
            if (dayUpdate.activities && Array.isArray(dayUpdate.activities)) {
              // Validate activities using unified validation
              const validation = Itinerary.validateActivities(dayUpdate.activities, dayToUpdate.type);
              if (!validation.valid) {
                return res.status(400).json({
                  success: false,
                  message: validation.error,
                  error: validation.error
                });
              }

              // Normalize activities using unified normalization
              const normalizedActivities = Itinerary.normalizeActivities(dayUpdate.activities, dayToUpdate.type);
              dayToUpdate.activities = normalizedActivities;
            }

            if (dayUpdate.dayTotal !== undefined) dayToUpdate.day_total = dayUpdate.dayTotal;

            // Mark as user modified
            dayToUpdate.user_modified = true;
            dayToUpdate.updated_at = new Date();

            await dayToUpdate.save();
            console.log(`✅ Updated day ${dayUpdate.dayNumber}: ${dayUpdate.theme}`);
          }
        }

        // Update AI record summary if provided
        if (customizedAiRecord && req.body.summary) {
          customizedAiRecord.summary = req.body.summary;
          customizedAiRecord.updated_at = new Date();
          await customizedAiRecord.save();
          console.log('✅ Updated AI record summary');
        }

        // Get updated data
        customizedDays = await Itinerary.find({
          origin_id: customizedAiRecord ? customizedAiRecord._id : aiGeneratedId,
          type: 'customized'
        }).sort({ day_number: 1 });
      }

      // Return the customized version (updated or existing)
      const totalCost = customizedDays.reduce((sum, day) => sum + day.day_total, 0);

      // Set cache control headers to prevent caching
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      });

      res.json({
        success: true,
        message: hasUpdateData ? 'Cập nhật lịch trình tùy chỉnh thành công' : 'Lấy phiên bản tùy chỉnh thành công',
        data: {
          aiGeneratedId: customizedAiRecord ? customizedAiRecord._id : aiGeneratedId, // Use customized AI record ID
          originalAiGeneratedId: aiGeneratedId, // Keep reference to original
          isOriginal: false,
          isCustomizable: true,
          totalCost: totalCost,
          destination: customizedAiRecord ? customizedAiRecord.destination : null,
          duration_days: customizedAiRecord ? customizedAiRecord.duration_days : null,
          lastUpdated: new Date().toISOString(), // Add timestamp to force refresh
          updated: hasUpdateData, // Flag to indicate if this was an update
          days: customizedDays.map(day => {
            const formattedDay = Itinerary.formatResponse(day);
            return {
              dayNumber: day.day_number,
              dayId: day._id,
              theme: day.title,
              description: day.description,
              activities: formattedDay.activities, // Use formatted activities
              dayTotal: day.day_total,
              type: day.type,
              originId: day.origin_id,
              userModified: day.user_modified
            };
          })
        }
      });

    } catch (error) {
      console.error('❌ Error in customizeItinerary:', error);

      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Phiên bản tùy chỉnh đã tồn tại',
          error: 'Duplicate customization'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Lỗi khi xử lý tùy chỉnh lịch trình',
        error: error.message
      });
    }
  },

  // Delete AI itinerary (both AI record and associated day records)
  async deleteItinerary(req, res) {
    try {
      const { aiGeneratedId } = req.params;
      const userId = req.user.id;

      // Get AI record to verify ownership and check type
      const aiRecord = await AiGeneratedItinerary.findById(aiGeneratedId);
      if (!aiRecord) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy lịch trình AI'
        });
      }

      // Verify ownership
      if (aiRecord.user_id.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền xóa lịch trình này'
        });
      }

      // Delete associated ITINERARIES records
      const deleteResult = await Itinerary.deleteMany({
        origin_id: aiGeneratedId
      });

      // Delete AI_GENERATED_ITINERARIES record
      await AiGeneratedItinerary.findByIdAndDelete(aiGeneratedId);

      console.log(`✅ Deleted AI itinerary ${aiGeneratedId} and ${deleteResult.deletedCount} associated day records`);

      res.json({
        success: true,
        message: 'Xóa lịch trình thành công',
        data: {
          deletedAiRecord: aiGeneratedId,
          deletedDayRecords: deleteResult.deletedCount
        }
      });

    } catch (error) {
      console.error('❌ Error deleting itinerary:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi xóa lịch trình',
        error: error.message
      });
    }
  }
};

module.exports = aiItineraryController;